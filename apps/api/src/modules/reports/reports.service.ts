import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

function dayBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Headline KPIs for the admin dashboard. */
  async summary(communityId: string) {
    const now = new Date();
    const { start, end } = dayBounds(now);

    const [residents, units, ticketsByStatus, visitsToday, invoices, openTickets] =
      await Promise.all([
        this.prisma.unitOccupancy.count({
          where: { effectiveTo: null, unit: { communityId, deletedAt: null } },
        }),
        this.prisma.unit.count({ where: { communityId, deletedAt: null } }),
        this.prisma.ticket.groupBy({
          by: ["status"],
          where: { communityId },
          _count: { _all: true },
        }),
        this.prisma.visit.count({
          where: { communityId, checkedInAt: { gte: start, lt: end } },
        }),
        this.prisma.invoice.aggregate({
          where: { communityId, status: { notIn: ["DRAFT", "CANCELLED"] } },
          _sum: { totalPaise: true, paidPaise: true },
        }),
        this.prisma.ticket.count({
          where: { communityId, status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "REOPENED"] } },
        }),
      ]);

    const billedPaise = invoices._sum.totalPaise ?? 0;
    const collectedPaise = invoices._sum.paidPaise ?? 0;

    return {
      residents,
      units,
      occupiedUnits: await this.prisma.unit.count({
        where: { communityId, deletedAt: null, occupancies: { some: { effectiveTo: null } } },
      }),
      visitsToday,
      openTickets,
      ticketsByStatus: Object.fromEntries(ticketsByStatus.map((t) => [t.status, t._count._all])),
      dues: { billedPaise, collectedPaise, outstandingPaise: Math.max(0, billedPaise - collectedPaise) },
      generatedAt: now.toISOString(),
    };
  }

  /** Billed vs collected grouped by billing period label. */
  async collections(communityId: string, opts?: { from?: string; to?: string }) {
    const rows = await this.prisma.invoice.groupBy({
      by: ["periodLabel"],
      where: {
        communityId,
        status: { notIn: ["DRAFT", "CANCELLED"] },
        ...(opts?.from || opts?.to
          ? { periodLabel: { gte: opts.from, lte: opts.to } }
          : {}),
      },
      _sum: { totalPaise: true, paidPaise: true },
      _count: { _all: true },
      orderBy: { periodLabel: "desc" },
    });
    return rows.map((r) => ({
      periodLabel: r.periodLabel,
      invoices: r._count._all,
      billedPaise: r._sum.totalPaise ?? 0,
      collectedPaise: r._sum.paidPaise ?? 0,
      outstandingPaise: Math.max(0, (r._sum.totalPaise ?? 0) - (r._sum.paidPaise ?? 0)),
    }));
  }

  /** Helpdesk performance over a window. */
  async helpdesk(communityId: string, days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const [byStatus, byCategory, sla] = await Promise.all([
      this.prisma.ticket.groupBy({ by: ["status"], where: { communityId, createdAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.ticket.groupBy({
        by: ["categoryId"],
        where: { communityId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.ticket.aggregate({
        where: { communityId, createdAt: { gte: since }, firstResponseAt: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const totalTickets = byStatus.reduce((s, x) => s + x._count._all, 0);
    const categoryIds = byCategory.map((c) => c.categoryId).filter((x): x is string => !!x);
    const cats = categoryIds.length
      ? await this.prisma.ticketCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
      : [];
    const catName = new Map(cats.map((c) => [c.id, c.name]));
    // SLA breach = resolved late or still open past resolution due date.
    const breached = await this.prisma.ticket.count({
      where: {
        communityId,
        OR: [
          { slaFirstResponseDueAt: { lt: new Date() }, firstResponseAt: null },
          { slaResolutionDueAt: { lt: new Date() }, resolvedAt: null },
        ],
      },
    });
    return {
      windowDays: days,
      totalTickets,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      byCategory: byCategory.map((c) => ({ name: catName.get(c.categoryId ?? "") ?? "â€”", count: c._count._all })),
      respondedWithinSla: sla._count._all,
      currentlyBreached: breached,
    };
  }

  /** Visitor traffic per day with approval-method split. */
  async visitorReport(communityId: string, days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const visits = await this.prisma.visit.findMany({
      where: { communityId, checkedInAt: { gte: since } },
      select: { checkedInAt: true, approvalMethod: true, status: true },
    });
    const perDay = new Map<string, number>();
    const byMethod = new Map<string, number>();
    let checkedOut = 0;
    for (const v of visits) {
      const key = (v.checkedInAt ?? new Date()).toISOString().slice(0, 10);
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
      const m = v.approvalMethod ?? "UNKNOWN";
      byMethod.set(m, (byMethod.get(m) ?? 0) + 1);
      if (v.status === "CHECKED_OUT") checkedOut++;
    }
    return {
      windowDays: days,
      totalVisits: visits.length,
      checkedOut,
      perDay: [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
      byApprovalMethod: Object.fromEntries(byMethod),
    };
  }
}
