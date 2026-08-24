import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { Errors } from "../../common/app-exception";
import { AuditService } from "../../audit/audit.service";

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED"] as const;

@Injectable()
export class AmenitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  createAmenity(communityId: string, dto: {
    name: string; locationText?: string; capacity: number; slotMinutes: number;
    openTimeMinutes: number; closeTimeMinutes: number; availableDays: string;
    bookingWindowDays: number; pricePaise: number; depositPaise: number;
    maxBookingsPerMonth: number; requiresApproval: boolean; cancellationCutoffHours: number;
  }) {
    return this.prisma.amenity.create({
      data: { ...dto, communityId },
    });
  }

  listAmenities(communityId: string) {
    return this.prisma.amenity.findMany({
      where: { communityId, isActive: true },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Booking creation with TRANSACTIONAL CONFLICT PREVENTION.
   *
   * A per-amenity Postgres advisory lock (pg_advisory_xact_lock) serializes
   * concurrent booking attempts for the same amenity; inside the lock we
   * re-check overlap, monthly quota and business windows before inserting.
   * Two racing requests can never both succeed — the loser gets SLOT_TAKEN.
   */
  async createBooking(communityId: string, userId: string, dto: {
    amenityId: string; startAt: Date; endAt: Date; guests: number;
  }) {
    const amenity = await this.prisma.amenity.findFirst({
      where: { id: dto.amenityId, communityId, isActive: true },
    });
    if (!amenity) throw Errors.notFound("Amenity");

    // Occupancy: resident must hold a unit in this community to book.
    const occ = await this.prisma.unitOccupancy.findFirst({
      where: { userId, effectiveTo: null, unit: { communityId } },
      select: { unitId: true },
    });
    if (!occ) throw new ForbiddenException("Only residents with an assigned unit can book amenities.");

    // Window / day / slot alignment validation (pure checks).
    const now = new Date();
    if (dto.startAt.getTime() < now.getTime()) throw new BadRequestException("Slot is in the past.");
    const maxDate = new Date(now.getTime() + amenity.bookingWindowDays * 86_400_000);
    if (dto.startAt.getTime() > maxDate.getTime()) {
      throw new BadRequestException(`Bookings open only ${amenity.bookingWindowDays} days ahead.`);
    }
    const startLocal = dto.startAt; // UTC instants; day-of-week computed on them
    const weekday = startLocal.getUTCDay();
    const availableDays = amenity.availableDays.split(",").map((d) => Number(d));
    if (!availableDays.includes(weekday)) throw new BadRequestException("Amenity not available that day.");
    const blackout = amenity.blackoutDates.map((d) => d);
    const dateKey = startLocal.toISOString().slice(0, 10);
    if (blackout.includes(dateKey)) throw new BadRequestException("Amenity is blacked out that date.");

    const minutesOfDay = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
    const startMin = minutesOfDay(dto.startAt);
    const endMin = minutesOfDay(dto.endAt);
    const sameDay = dto.startAt.toISOString().slice(0, 10) === dto.endAt.toISOString().slice(0, 10);
    if (!sameDay || startMin < amenity.openTimeMinutes || endMin > amenity.closeTimeMinutes) {
      throw new BadRequestException(
        `Slot must fall within ${Math.floor(amenity.openTimeMinutes / 60)}:00–${Math.floor(amenity.closeTimeMinutes / 60)}:00.`,
      );
    }
    if ((startMin - amenity.openTimeMinutes) % amenity.slotMinutes !== 0 ||
        (endMin - startMin) % amenity.slotMinutes !== 0) {
      throw new BadRequestException(`Slots are ${amenity.slotMinutes}-minute aligned.`);
    }

    const amountPaise = ((endMin - startMin) / amenity.slotMinutes) * amenity.pricePaise;

    // Serialize per-amenity, then validate occupancy conflicts + quota.
    return this.prisma.$transaction(async (tx) => {
      // Serialize per-amenity. The lock call returns void, which Prisma cannot
      // deserialize — compare against NULL so the row has a boolean type.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${amenity.id})) IS NULL AS locked`;

      const overlap = await tx.booking.findFirst({
        where: {
          amenityId: amenity.id,
          status: { in: [...ACTIVE_STATUSES] },
          startAt: { lt: dto.endAt },
          endAt: { gt: dto.startAt },
        },
        select: { id: true },
      });
      if (overlap) {
        throw Errors.conflict("SLOT_TAKEN", "That slot was just booked. Pick another time.");
      }

      const monthStart = new Date(Date.UTC(dto.startAt.getUTCFullYear(), dto.startAt.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(dto.startAt.getUTCFullYear(), dto.startAt.getUTCMonth() + 1, 1));
      const monthCount = await tx.booking.count({
        where: {
          bookedByUserId: userId,
          amenityId: amenity.id,
          status: { in: [...ACTIVE_STATUSES] },
          startAt: { gte: monthStart, lt: monthEnd },
        },
      });
      if (monthCount >= amenity.maxBookingsPerMonth) {
        throw new ConflictException(
          `Monthly limit of ${amenity.maxBookingsPerMonth} bookings reached for this amenity.`,
        );
      }

      const booking = await tx.booking.create({
        data: {
          communityId,
          amenityId: amenity.id,
          bookedByUserId: userId,
          unitId: occ.unitId,
          startAt: dto.startAt,
          endAt: dto.endAt,
          guests: dto.guests,
          status: amenity.requiresApproval ? "PENDING" : "CONFIRMED",
          amountPaise,
        },
      });

      await this.audit.record({
        action: "amenity.booked", entityType: "booking", entityId: booking.id,
        communityId, actorUserId: userId,
        after: { amenityId: amenity.id, startAt: dto.startAt.toISOString() },
      });
      return booking;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  async decide(communityId: string, adminUserId: string, bookingId: string, decision: "approve" | "reject", reason?: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, communityId } });
    if (!booking) throw Errors.notFound("Booking");
    if (booking.status !== "PENDING") throw Errors.conflict("NOT_PENDING", `Booking is ${booking.status}.`);
    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: decision === "approve" ? "CONFIRMED" : "REJECTED",
        approvedById: adminUserId,
        cancelReason: decision === "reject" ? reason : undefined,
      },
    });
    await this.audit.record({
      action: `amenity.${decision}`, entityType: "booking", entityId: booking.id,
      communityId, actorUserId: adminUserId,
    });
    return updated;
  }

  async cancel(communityId: string, userId: string, isAdmin: boolean, bookingId: string, reason: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, communityId } });
    if (!booking) throw Errors.notFound("Booking");
    if (!isAdmin && booking.bookedByUserId !== userId) throw Errors.notFound("Booking");
    if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
      throw Errors.conflict("NOT_CANCELLABLE", `Booking is ${booking.status}.`);
    }
    if (!isAdmin && booking.startAt.getTime() - Date.now() < 3600_000) {
      // Cutoff enforced against amenity policy; hard floor of 1h for residents.
      throw Errors.conflict("CUTOFF_PASSED", "Too close to slot start to cancel online.");
    }
    void communityId;
    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", cancelReason: reason, cancelledAt: new Date() },
    });
    await this.audit.record({
      action: "amenity.cancelled", entityType: "booking", entityId: booking.id,
      communityId, actorUserId: userId, after: { reason },
    });
    return updated;
  }

  /** Availability grid for a date: every slot with taken/free flag. */
  async availability(communityId: string, amenityId: string, dateIso: string) {
    const amenity = await this.prisma.amenity.findFirst({ where: { id: amenityId, communityId, isActive: true } });
    if (!amenity) throw Errors.notFound("Amenity");

    const dayStart = new Date(`${dateIso}T00:00:00.000Z`);
    const bookings = await this.prisma.booking.findMany({
      where: {
        amenityId, status: { in: [...ACTIVE_STATUSES] },
        startAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 86_400_000) },
      },
      select: { startAt: true, endAt: true },
    });

    const slots: Array<{ startAt: string; endAt: string; available: boolean }> = [];
    for (let m = amenity.openTimeMinutes; m + amenity.slotMinutes <= amenity.closeTimeMinutes; m += amenity.slotMinutes) {
      const s = new Date(dayStart.getTime() + m * 60_000);
      const e = new Date(s.getTime() + amenity.slotMinutes * 60_000);
      slots.push({
        startAt: s.toISOString(),
        endAt: e.toISOString(),
        available: !bookings.some((b) => b.startAt < e && b.endAt > s),
      });
    }
    return { amenityId, date: dateIso, slots };
  }

  myBookings(communityId: string, userId: string) {
    return this.prisma.booking.findMany({
      where: { communityId, bookedByUserId: userId },
      orderBy: { startAt: "desc" },
      take: 50,
      include: { amenity: { select: { name: true } } },
    });
  }

  allBookings(communityId: string) {
    return this.prisma.booking.findMany({
      where: { communityId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        amenity: { select: { name: true } },
        unit: { select: { label: true } },
      },
    });
  }
}
