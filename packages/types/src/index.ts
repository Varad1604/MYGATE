/**
 * SocietyOS shared domain types: enums, state machines and API envelope
 * types. These mirror the Prisma schema enums; the API validates that both
 * stay in sync via generated types.
 */

export * from "./contact";

// ─── Money ────────────────────────────────────────────────────────────────────

/** All monetary values are integers in the smallest currency unit (paise). */
export type Paise = number;

export const formatPaise = (paise: Paise): string =>
  (paise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" });

export const rupeesToPaise = (rupees: number): Paise => Math.round(rupees * 100);

// ─── Community structure ──────────────────────────────────────────────────────

export const UNIT_STATUSES = [
  "VACANT",
  "OWNER_OCCUPIED",
  "TENANT_OCCUPIED",
  "UNDER_MAINTENANCE",
  "INACTIVE",
] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export type OccupancyKind = "OWNER" | "TENANT" | "FAMILY";

export const COMMUNITY_STATUSES = ["ONBOARDING", "ACTIVE", "SUSPENDED"] as const;
export type CommunityStatus = (typeof COMMUNITY_STATUSES)[number];

// ─── Visitors & gate security ─────────────────────────────────────────────────

export const VISITOR_TYPES = [
  "GUEST",
  "DELIVERY",
  "CAB",
  "SERVICE_PROVIDER",
  "CONTRACTOR",
  "DOMESTIC_HELP",
  "UTILITY_VEHICLE",
  "EVENT_GUEST",
  "OTHER",
] as const;
export type VisitorType = (typeof VISITOR_TYPES)[number];

export const VISITOR_STATUSES = [
  "CREATED",
  "WAITING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "EXPIRED",
  "CANCELLED",
  "DENIED",
  "OVERRIDDEN",
] as const;
export type VisitorStatus = (typeof VISITOR_STATUSES)[number];

/** Visitor lifecycle state machine. Enforced server-side (ADR-006). */
export const VISITOR_TRANSITIONS: Record<VisitorStatus, VisitorStatus[]> = {
  CREATED: ["WAITING_APPROVAL", "APPROVED", "CANCELLED", "EXPIRED"],
  WAITING_APPROVAL: ["APPROVED", "REJECTED", "EXPIRED", "CANCELLED", "OVERRIDDEN"],
  APPROVED: ["CHECKED_IN", "EXPIRED", "CANCELLED", "OVERRIDDEN"],
  // Explicit resident rejection is honored — not silently overridable.
  REJECTED: [],
  CHECKED_IN: ["CHECKED_OUT"],
  CHECKED_OUT: [],
  EXPIRED: ["OVERRIDDEN"],
  CANCELLED: [],
  DENIED: [],
  OVERRIDDEN: ["CHECKED_IN"],
};

export type ApprovalMethod = "PRE_APPROVED_TOKEN" | "RESIDENT_APPROVAL" | "SECURITY_OVERRIDE";

export const DELIVERY_PREFERENCES = ["ALLOW_ENTRY", "LEAVE_AT_GATE", "REJECT"] as const;
export type DeliveryPreference = (typeof DELIVERY_PREFERENCES)[number];

export const DOMESTIC_HELP_CATEGORIES = [
  "MAID", "COOK", "DRIVER", "NANNY", "CLEANER", "ELECTRICIAN",
  "PLUMBER", "GARDENER", "TRAINER", "OTHER",
] as const;
export type DomesticHelpCategory = (typeof DOMESTIC_HELP_CATEGORIES)[number];

export const PARCEL_STATUSES = ["HELD_AT_GATE", "COLLECTED"] as const;
export type ParcelStatus = (typeof PARCEL_STATUSES)[number];

// ─── Helpdesk ────────────────────────────────────────────────────────────────

export const TICKET_STATUSES = [
  "OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD",
  "RESOLVED", "CLOSED", "REOPENED", "CANCELLED",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["ASSIGNED", "IN_PROGRESS", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "ON_HOLD", "RESOLVED", "OPEN", "CANCELLED"],
  IN_PROGRESS: ["ON_HOLD", "RESOLVED", "CANCELLED"],
  ON_HOLD: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["ASSIGNED", "IN_PROGRESS", "RESOLVED"],
  CANCELLED: [],
};

export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

// ─── Billing & payments ───────────────────────────────────────────────────────

export const INVOICE_STATUSES = [
  "DRAFT", "APPROVED", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ["APPROVED", "ISSUED", "CANCELLED"],
  APPROVED: ["ISSUED", "CANCELLED"],
  ISSUED: ["PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"],
  PARTIALLY_PAID: ["PAID", "OVERDUE"],
  PAID: [],
  OVERDUE: ["PARTIALLY_PAID", "PAID"],
  CANCELLED: [],
};

export const CHARGE_CALC_METHODS = [
  "FIXED", "AREA_BASED", "UNIT_TYPE_BASED", "METERED", "MANUAL",
] as const;
export type ChargeCalcMethod = (typeof CHARGE_CALC_METHODS)[number];

export const PAYMENT_STATUSES = [
  "INITIATED", "PENDING", "SUCCESS", "FAILED", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = [
  "UPI", "CARD", "NETBANKING", "WALLET", "BANK_TRANSFER", "CHEQUE", "CASH",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_PROVIDERS = ["MOCK", "RAZORPAY", "CASHFREE"] as const;
export type PaymentProviderName = (typeof PAYMENT_PROVIDERS)[number];

export const BILL_FREQUENCIES = ["ONE_TIME", "MONTHLY", "QUARTERLY", "ANNUAL"] as const;
export type BillFrequency = (typeof BILL_FREQUENCIES)[number];

// ─── Amenities ────────────────────────────────────────────────────────────────

export const BOOKING_STATUSES = [
  "PENDING", "CONFIRMED", "REJECTED", "CANCELLED", "COMPLETED", "NO_SHOW",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  REJECTED: [],
  CANCELLED: [],
  COMPLETED: [],
  NO_SHOW: [],
};

// ─── Notices & communication ──────────────────────────────────────────────────

export const NOTICE_TYPES = [
  "ANNOUNCEMENT", "EMERGENCY", "MAINTENANCE", "EVENT", "BILLING_REMINDER", "SECURITY",
] as const;
export type NoticeType = (typeof NOTICE_TYPES)[number];

export const NOTICE_AUDIENCES = ["ALL", "TOWER", "FLOOR", "UNIT", "OWNERS", "TENANTS", "CUSTOM_GROUP"] as const;
export type NoticeAudience = (typeof NOTICE_AUDIENCES)[number];

export const NOTICE_STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "EXPIRED"] as const;
export type NoticeStatus = (typeof NOTICE_STATUSES)[number];

export const NOTIFICATION_CHANNELS = ["IN_APP", "PUSH", "EMAIL", "SMS"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

// ─── Vehicles & parking ───────────────────────────────────────────────────────

export const VEHICLE_TYPES = ["TWO_WHEELER", "FOUR_WHEELER", "COMMERCIAL", "OTHER"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const PARKING_SLOT_KINDS = ["RESIDENT", "VISITOR", "DISABLED", "STAFF", "TWO_WHEELER"] as const;
export type ParkingSlotKind = (typeof PARKING_SLOT_KINDS)[number];

// ─── Feature flags (tenant-level) ─────────────────────────────────────────────

export interface CommunityFeatureFlags {
  visitorManagement: boolean;
  helpdesk: boolean;
  billing: boolean;
  amenities: boolean;
  parking: boolean;
  notices: boolean;
  accounting: boolean;
  inventory: boolean;
  advancedSecurity: boolean;
}

export const DEFAULT_FEATURE_FLAGS: CommunityFeatureFlags = {
  visitorManagement: true,
  helpdesk: true,
  billing: true,
  amenities: true,
  parking: true,
  notices: true,
  accounting: false,
  inventory: false,
  advancedSecurity: false,
};

// ─── API envelope ─────────────────────────────────────────────────────────────

export interface PageRequest {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;

/** Normalize a page request defensively (server-side clamp). */
export function normalizePage(req: PageRequest): { skip: number; take: number; page: number; pageSize: number } {
  const pageSize = Math.min(Math.max(1, req.pageSize ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const page = Math.max(1, req.page ?? 1);
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}
