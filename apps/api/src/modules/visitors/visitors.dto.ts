import { z } from "zod";

const VISITOR_TYPES = [
  "GUEST", "DELIVERY", "CAB", "SERVICE_PROVIDER", "CONTRACTOR",
  "DOMESTIC_HELP", "UTILITY_VEHICLE", "EVENT_GUEST", "OTHER",
] as const;

/** Resident pre-approves a visitor. */
export const CreateInvitationSchema = z.object({
  unitId: z.string().uuid(),
  visitorName: z.string().trim().min(2).max(80),
  visitorPhone: z.string().trim().regex(/^(\+?\d[\d\s-]{7,17})$/, "Invalid phone."),
  visitorType: z.enum(VISITOR_TYPES),
  expectedAt: z.coerce.date().optional(),
  vehicleNumber: z.string().trim().max(20).optional(),
  deliveryPreference: z.enum(["ALLOW_ENTRY", "LEAVE_AT_GATE", "REJECT"]).optional(),
  notes: z.string().trim().max(300).optional(),
});

/** Guard logs an unexpected visitor → resident approval requested. */
export const SpotRequestSchema = z.object({
  unitId: z.string().uuid(),
  gateId: z.string().uuid(),
  visitorName: z.string().trim().min(2).max(80),
  visitorPhone: z.string().trim().regex(/^(\+?\d[\d\s-]{7,17})$/).optional(),
  visitorType: z.enum(VISITOR_TYPES),
  vehicleNumber: z.string().trim().max(20).optional(),
  photoDataUrl: z.string().max(1_500_000).optional(), // small JPEG data URL from guard camera
  remarks: z.string().trim().max(200).optional(),
});

export const ApprovalDecisionSchema = z.object({ reason: z.string().trim().max(200).optional() });

export const OverrideSchema = z.object({
  reason: z.string().trim().min(5, "Override requires a reason.").max(300),
});

/** Guard check-in: by pre-approved token, OTP short code, or already-approved invitation id. */
export const CheckInSchema = z.object({
  invitationId: z.string().uuid().optional(),
  token: z.string().trim().min(10).max(120).optional(),
  otp: z.string().trim().regex(/^\d{6}$/).optional(),
  clientEventId: z.string().uuid().optional(), // offline-sync dedupe
  vehicleNumber: z.string().trim().max(20).optional(),
}).refine((v) => Boolean(v.invitationId || v.token || v.otp), {
  message: "One of invitationId, token or otp is required.",
});

export const CheckOutSchema = z.object({
  visitId: z.string().uuid(),
  clientEventId: z.string().uuid().optional(),
});

export const ListVisitsQuerySchema = z.object({
  gateId: z.string().uuid().optional(),
  visitorType: z.enum(VISITOR_TYPES).optional(),
  towerId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  status: z.string().trim().max(20).optional(),
  inside: z.enum(["true", "false"]).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const HoldParcelSchema = z.object({
  courierName: z.string().trim().max(60).optional(),
  description: z.string().trim().max(200).optional(),
});

export const CollectParcelSchema = z.object({
  pickupToken: z.string().trim().min(6).max(64),
});
