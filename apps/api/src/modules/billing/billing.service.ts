import { BadRequestException, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { Invoice, Prisma } from "@prisma/client";
import { INVOICE_TRANSITIONS, type InvoiceStatus } from "@societyos/types";
import { PrismaService } from "../../prisma/prisma.service";
import { Errors } from "../../common/app-exception";
import { AuditService } from "../../audit/audit.service";

function assertInvoiceTransition(from: InvoiceStatus, to: InvoiceStatus) {
  if (!(INVOICE_TRANSITIONS[from] ?? []).includes(to)) {
    throw new BadRequestException(`Cannot move invoice from ${from} to ${to}.`);
  }
}

/** Integer-only money math (spec: paise everywhere). */
function lineAmountPaise(input: { quantity: number; unitPricePaise: number }): number {
  // quantity may be fractional (sqft/100 etc.) — compute in paise with rounding
  // at the LINE level so invoice totals are exact integer sums.
  const exact = input.quantity * input.unitPricePaise;
  return Math.round(exact);
}

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private newReference(prefix: string): string {
    return `${prefix}-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
  }

  async createChargeHead(communityId: string, dto: {
    name: string; calcMethod: string; defaultAmountPaise: number; taxable: boolean; taxRateBps: number;
  }) {
    const head = await this.prisma.chargeHead.create({
      data: {
        communityId,
        name: dto.name,
        calcMethod: dto.calcMethod as never,
        defaultAmountPaise: dto.defaultAmountPaise,
        taxable: dto.taxable,
        taxRateBps: dto.taxRateBps,
      },
    });
    await this.audit.record({
      action: "billing.charge_head_created", entityType: "charge_head", entityId: head.id,
      communityId, after: { name: dto.name },
    });
    return head;
  }

  listChargeHeads(communityId: string) {
    return this.prisma.chargeHead.findMany({ where: { communityId, isActive: true }, orderBy: { name: "asc" } });
  }

  /** Resolve the units covered by a bill-run scope. */
  private async scopeUnits(communityId: string, scope: {
    kind: "ALL_UNITS" | "TOWER" | "SELECTED_UNITS"; towerId?: string; unitIds?: string[];
  }) {
    if (scope.kind === "SELECTED_UNITS") {
      if (!scope.unitIds?.length) throw new BadRequestException("SELECTED_UNITS requires unitIds.");
      return this.prisma.unit.findMany({
        where: { id: { in: scope.unitIds }, communityId, deletedAt: null },
        select: { id: true },
      });
    }
    if (scope.kind === "TOWER") {
      if (!scope.towerId) throw new BadRequestException("TOWER scope requires towerId.");
      return this.prisma.unit.findMany({
        where: { communityId, towerId: scope.towerId, deletedAt: null },
        select: { id: true },
      });
    }
    return this.prisma.unit.findMany({
      where: { communityId, deletedAt: null },
      select: { id: true },
    });
  }

  async createBillRun(communityId: string, userId: string, dto: {
    name: string; frequency: string; periodLabel: string; dueDate: Date;
    scope: { kind: "ALL_UNITS" | "TOWER" | "SELECTED_UNITS"; towerId?: string; unitIds?: string[] };
    lines: Array<{ chargeHeadId: string; amountPaise: number; description?: string }>;
  }) {
    // Validate charge heads up front.
    const headIds = dto.lines.map((l) => l.chargeHeadId);
    const heads = await this.prisma.chargeHead.findMany({
      where: { id: { in: headIds }, communityId, isActive: true },
    });
    if (heads.length !== new Set(headIds).size) throw Errors.notFound("Charge head");

    const run = await this.prisma.billRun.create({
      data: {
        communityId,
        name: dto.name,
        frequency: dto.frequency as never,
        periodLabel: dto.periodLabel,
        scope: dto.scope,
        lineTemplate: dto.lines,
        dueDate: dto.dueDate,
        createdByUserId: userId,
      },
    });
    await this.audit.record({
      action: "billing.bill_run_created", entityType: "bill_run", entityId: run.id,
      communityId, actorUserId: userId,
      after: { name: dto.name, period: dto.periodLabel },
    });
    return run;
  }

  /**
   * Generates DRAFT invoices for every scoped unit. Idempotent per
   * (billRun, unit): re-running never duplicates.
   * AREA_BASED lines use amountPaise as PAISE-PER-SQFT × unit area.
   */
  async generateInvoices(communityId: string, billRunId: string) {
    const run = await this.prisma.billRun.findFirst({ where: { id: billRunId, communityId } });
    if (!run) throw Errors.notFound("Bill run");
    if (run.status !== "DRAFT") throw Errors.conflict("BILL_RUN_NOT_DRAFT", `Run is ${run.status}.`);

    const units = await this.scopeUnits(communityId, run.scope as never);
    const heads = await this.prisma.chargeHead.findMany({ where: { communityId, isActive: true } });
    const headById = new Map(heads.map((h) => [h.id, h]));
    const runLines = (run.lineTemplate ?? []) as Array<{ chargeHeadId: string; amountPaise: number; description?: string }>;

    let generated = 0;
    for (const u of units) {
      const existing = await this.prisma.invoice.findFirst({
        where: { billRunId: run.id, unitId: u.id },
      });
      if (existing) continue;

      const unit = await this.prisma.unit.findUniqueOrThrow({
        where: { id: u.id },
        select: { areaSqft: true },
      });

      const lineData = runLines.map((rl) => {
        const head = headById.get(rl.chargeHeadId);
        if (!head) throw Errors.notFound(`Charge head ${rl.chargeHeadId}`);
        let qty = 1;
        const unitPrice = rl.amountPaise;
        if (head.calcMethod === "AREA_BASED") {
          qty = unit.areaSqft ? Number(unit.areaSqft) : 0; // paise-per-sqft × sqft
        }
        const amount = lineAmountPaise({ quantity: qty, unitPricePaise: unitPrice });
        const tax = head.taxable ? Math.round((amount * head.taxRateBps) / 10_000) : 0;
        return {
          chargeHeadId: head.id,
          description: rl.description ?? head.name,
          quantity: qty,
          unitPricePaise: unitPrice,
          amountPaise: amount,
          taxRateBps: head.taxable ? head.taxRateBps : 0,
          taxPaise: tax,
          calcMethodSnapshot: head.calcMethod,
        };
      });
      if (!lineData.length) continue;

      const subtotal = lineData.reduce((s, l) => s + l.amountPaise, 0);
      const tax = lineData.reduce((s, l) => s + l.taxPaise, 0);

      await this.prisma.invoice.create({
        data: {
          communityId,
          reference: this.newReference("INV"),
          unitId: u.id,
          billRunId: run.id,
          periodLabel: run.periodLabel,
          dueDate: run.dueDate,
          subtotalPaise: subtotal,
          taxPaise: tax,
          totalPaise: subtotal + tax,
          lines: { create: lineData },
        },
      });
      generated++;
    }

    await this.prisma.billRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED", generatedCount: generated },
    });
    await this.audit.record({
      action: "billing.bill_run_generated", entityType: "bill_run", entityId: run.id,
      communityId, after: { invoices: generated },
    });
    return { generated };
  }

  async issueInvoice(communityId: string, userId: string, invoiceId: string): Promise<Invoice> {
    const inv = await this.getCommunityInvoice(communityId, invoiceId);
    assertInvoiceTransition(inv.status, "ISSUED");
    const updated = await this.prisma.invoice.update({
      where: { id: inv.id },
      data: { status: "ISSUED", issuedAt: new Date() },
    });
    await this.audit.record({
      action: "billing.invoice_issued", entityType: "invoice", entityId: inv.id,
      communityId, actorUserId: userId,
      before: { status: inv.status }, after: { status: "ISSUED", totalPaise: inv.totalPaise },
    });
    return updated;
  }

  async cancelInvoice(communityId: string, userId: string, invoiceId: string, reason: string) {
    const inv = await this.getCommunityInvoice(communityId, invoiceId);
    assertInvoiceTransition(inv.status, "CANCELLED");
    if (inv.paidPaise > 0) throw Errors.conflict("INVOICE_HAS_PAYMENTS", "Cancel only unpaid invoices.");
    const updated = await this.prisma.invoice.update({
      where: { id: inv.id },
      data: { status: "CANCELLED", cancelReason: reason, cancelledAt: new Date() },
    });
    await this.audit.record({
      action: "billing.invoice_cancelled", entityType: "invoice", entityId: inv.id,
      communityId, actorUserId: userId,
      before: { status: inv.status }, after: { reason },
    });
    return updated;
  }

  async getCommunityInvoice(communityId: string, invoiceId: string): Promise<Invoice> {
    const inv = await this.prisma.invoice.findFirst({ where: { id: invoiceId, communityId } });
    if (!inv) throw Errors.notFound("Invoice");
    return inv;
  }

  async listInvoices(communityId: string, q: {
    status?: string; unitId?: string; periodLabel?: string; overdueOnly?: boolean;
    skip: number; take: number;
  }) {
    const where: Prisma.InvoiceWhereInput = {
      communityId,
      ...(q.status ? { status: { equals: q.status as InvoiceStatus } } : {}),
      ...(q.unitId ? { unitId: q.unitId } : {}),
      ...(q.periodLabel ? { periodLabel: q.periodLabel } : {}),
      ...(q.overdueOnly ? { status: { in: ["ISSUED", "PARTIALLY_PAID"] }, dueDate: { lt: new Date() } } : {}),
    };
    const [items, total, totals] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: { unit: { select: { label: true, tower: { select: { code: true } } } } },
        orderBy: { createdAt: "desc" },
        skip: q.skip,
        take: q.take,
      }),
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.aggregate({ where, _sum: { totalPaise: true, paidPaise: true } }),
    ]);
    return {
      items,
      total,
      summary: { billedPaise: totals._sum.totalPaise ?? 0, collectedPaise: totals._sum.paidPaise ?? 0 },
    };
  }

  /** Applies a successful payment across the payer's open invoices (oldest due first). */
  async allocatePayment(tx: Prisma.TransactionClient, params: {
    communityId: string; unitId: string; paymentId: string; amountPaise: number;
  }) {
    let remaining = params.amountPaise;
    const open = await tx.invoice.findMany({
      where: {
        communityId: params.communityId,
        unitId: params.unitId,
        status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
      },
      orderBy: { dueDate: "asc" },
    });
    for (const inv of open) {
      if (remaining <= 0) break;
      const outstanding = inv.totalPaise - inv.paidPaise;
      const applied = Math.min(outstanding, remaining);
      const paidTotal = inv.paidPaise + applied;
      const newStatus: InvoiceStatus = paidTotal >= inv.totalPaise ? "PAID" : "PARTIALLY_PAID";
      assertInvoiceTransition(inv.status as InvoiceStatus, newStatus);
      await tx.invoice.update({
        where: { id: inv.id },
        data: { paidPaise: paidTotal, status: newStatus },
      });
      await tx.paymentAllocation.create({
        data: { paymentId: params.paymentId, invoiceId: inv.id, amountPaise: applied },
      });
      remaining -= applied;
    }
    return remaining; // excess stays on the payment as credit
  }
}
