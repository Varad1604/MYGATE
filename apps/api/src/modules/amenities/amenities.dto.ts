import { z } from "zod";

export const CreateAmenitySchema = z.object({
  name: z.string().trim().min(2).max(60),
  locationText: z.string().trim().max(120).optional(),
  capacity: z.number().int().min(1).max(2000).default(20),
  slotMinutes: z.number().int().min(15).max(720).default(60),
  openTimeMinutes: z.number().int().min(0).max(1439).default(360),
  closeTimeMinutes: z.number().int().min(1).max(1440).default(1320),
  availableDays: z.string().regex(/^\d(,\d)*$/).default("0,1,2,3,4,5,6"),
  bookingWindowDays: z.number().int().min(1).max(365).default(30),
  pricePaise: z.number().int().min(0).default(0),
  depositPaise: z.number().int().min(0).default(0),
  maxBookingsPerMonth: z.number().int().min(1).max(60).default(4),
  requiresApproval: z.boolean().default(false),
  cancellationCutoffHours: z.number().int().min(0).max(168).default(24),
}).refine((v) => v.closeTimeMinutes > v.openTimeMinutes, {
  message: "closeTimeMinutes must be after openTimeMinutes.",
});

export const CreateBookingSchema = z.object({
  amenityId: z.string().uuid(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  guests: z.number().int().min(0).max(2000).default(0),
}).refine((v) => v.endAt > v.startAt, { message: "endAt must be after startAt." })
  .refine((v) => v.startAt.getTime() < v.endAt.getTime(), { message: "Empty slot." });

export const BookingDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(300).optional(),
});

export const CancelBookingSchema = z.object({
  reason: z.string().trim().min(3).max(300),
});
