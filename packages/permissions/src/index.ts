/**
 * SocietyOS permission catalog — SINGLE SOURCE OF TRUTH.
 * Imported by the API (server-side enforcement), frontends (UX only),
 * docs and tests. Never duplicate permission logic elsewhere.
 */

export const PERMISSION_GROUPS = {
  community: ["society.read", "society.write", "community.settings.manage"],
  residents: ["resident.read", "resident.write"],
  visitors: [
    "visitor.read",
    "visitor.create",
    "visitor.approve",
    "visitor.override",
    "visitor.gate.operations",
    "visitor.staff.manage",
  ],
  helpdesk: ["helpdesk.read", "helpdesk.create", "helpdesk.assign", "helpdesk.resolve"],
  billing: ["billing.read", "billing.create", "billing.approve"],
  payments: ["payment.read", "payment.pay", "payment.reconcile", "payment.method.manage"],
  amenities: ["amenity.read", "amenity.book", "amenity.manage"],
  notices: ["notice.read", "notice.publish"],
  parking: ["parking.read", "parking.manage"],
  reports: ["reports.view", "reports.export"],
  audit: ["audit.view"],
  administration: ["admin.users.manage", "admin.roles.manage", "admin.settings.manage"],
  platform: ["platform.communities.manage"],
} as const;

export type Permission = (typeof PERMISSION_GROUPS)[keyof typeof PERMISSION_GROUPS][number];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSION_GROUPS).flat() as Permission[];

export const SYSTEM_ROLES = [
  "PLATFORM_SUPER_ADMIN",
  "COMMUNITY_SUPER_ADMIN",
  "COMMUNITY_ADMIN",
  "COMMITTEE_MEMBER",
  "FACILITY_MANAGER",
  "ACCOUNTANT",
  "TREASURER",
  "HELPDESK_MANAGER",
  "SECURITY_MANAGER",
  "AUDITOR",
  "VIEW_ONLY_ADMIN",
  "RESIDENT_OWNER",
  "RESIDENT_TENANT",
  "FAMILY_MEMBER",
  "GUARD",
  "STAFF",
  "VENDOR_USER",
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

const p = (...perms: Permission[]): Permission[] => perms;

/** Role → permission matrix. Resident/guard/staff scopes are further narrowed by ownership rules in services. */
export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  PLATFORM_SUPER_ADMIN: [...ALL_PERMISSIONS],

  COMMUNITY_SUPER_ADMIN: [...ALL_PERMISSIONS.filter((x) => !x.startsWith("platform."))],
  COMMUNITY_ADMIN: p(
    "society.read", "society.write", "community.settings.manage",
    "resident.read", "resident.write",
    "visitor.read", "visitor.create", "visitor.approve", "visitor.override", "visitor.staff.manage",
    "helpdesk.read", "helpdesk.assign", "helpdesk.resolve",
    "billing.read", "billing.create", "billing.approve",
    "payment.read", "payment.reconcile",
    "amenity.read", "amenity.book", "amenity.manage",
    "notice.read", "notice.publish",
    "parking.read", "parking.manage",
    "reports.view", "reports.export",
    "audit.view",
    "admin.users.manage", "admin.roles.manage",
  ),
  COMMITTEE_MEMBER: p(
    "society.read", "resident.read",
    "visitor.read",
    "helpdesk.read",
    "billing.read", "payment.read",
    "amenity.read", "notice.read",
    "parking.read",
    "reports.view", "audit.view",
  ),
  FACILITY_MANAGER: p(
    "society.read", "resident.read",
    "visitor.read", "visitor.approve", "visitor.staff.manage",
    "helpdesk.read", "helpdesk.assign", "helpdesk.resolve",
    "amenity.read", "amenity.manage",
    "parking.read", "parking.manage",
    "notice.read", "notice.publish",
    "reports.view",
  ),
  ACCOUNTANT: p(
    "society.read", "resident.read",
    "billing.read", "billing.create", "billing.approve",
    "payment.read", "payment.reconcile",
    "reports.view", "reports.export",
  ),
  TREASURER: p(
    "billing.read", "billing.approve",
    "payment.read", "payment.reconcile",
    "reports.view", "reports.export", "audit.view",
  ),
  HELPDESK_MANAGER: p(
    "society.read", "resident.read",
    "helpdesk.read", "helpdesk.assign", "helpdesk.resolve",
    "reports.view",
  ),
  SECURITY_MANAGER: p(
    "society.read",
    "visitor.read", "visitor.approve", "visitor.override", "visitor.staff.manage",
    "parking.read", "parking.manage",
    "reports.view",
  ),
  AUDITOR: p("society.read", "resident.read", "visitor.read", "billing.read", "payment.read",
    "helpdesk.read", "amenity.read", "notice.read", "parking.read", "audit.view"),
  VIEW_ONLY_ADMIN: p("society.read", "resident.read", "visitor.read", "billing.read",
    "payment.read", "helpdesk.read", "amenity.read", "notice.read", "parking.read"),

  RESIDENT_OWNER: p(
    "resident.read",
    "visitor.read", "visitor.create", "visitor.approve", "visitor.staff.manage",
    "helpdesk.create", "helpdesk.read",
    "billing.read", "payment.read", "payment.pay",
    "amenity.read", "amenity.book",
    "notice.read",
    "parking.read",
  ),
  // Tenants get the same resident surface; owner-only data (ownership history,
  // ownership documents) is filtered in services, not via permissions.
  RESIDENT_TENANT: p(
    "resident.read",
    "visitor.read", "visitor.create", "visitor.approve", "visitor.staff.manage",
    "helpdesk.create", "helpdesk.read",
    "billing.read", "payment.read", "payment.pay",
    "amenity.read", "amenity.book",
    "notice.read",
    "parking.read",
  ),
  FAMILY_MEMBER: p(
    "resident.read",
    "visitor.read", "visitor.create", "visitor.approve",
    "helpdesk.create", "helpdesk.read",
    "amenity.read", "amenity.book",
    "notice.read",
  ),

  GUARD: p("visitor.read", "visitor.create", "visitor.gate.operations"),
  STAFF: p("helpdesk.read"),
  VENDOR_USER: [],
};

export function permissionsForRole(role: SystemRole): Permission[] {
  return [...SYSTEM_ROLE_PERMISSIONS[role]];
}

export function hasPermission(granted: Iterable<string>, needed: string | string[]): boolean {
  const set = granted instanceof Set ? granted : new Set(granted);
  const list = Array.isArray(needed) ? needed : [needed];
  return list.every((n) => set.has(n));
}

export function hasAnyPermission(granted: Iterable<string>, needed: string[]): boolean {
  const set = granted instanceof Set ? granted : new Set(granted);
  return needed.some((n) => set.has(n));
}
