# PERMISSIONS.md — RBAC model

Single source of truth: `packages/permissions`. The API imports the same
catalog used by docs/tests — no duplicated logic. Enforcement is server-side
(`PermissionsGuard`); frontend checks are cosmetic.

## Roles (initial)

Platform: `PLATFORM_SUPER_ADMIN`.

Community staff: `COMMUNITY_SUPER_ADMIN`, `COMMUNITY_ADMIN`,
`COMMITTEE_MEMBER`, `FACILITY_MANAGER`, `ACCOUNTANT`, `TREASURER`,
`HELPDESK_MANAGER`, `SECURITY_MANAGER`, `AUDITOR`, `VIEW_ONLY_ADMIN`
(+ custom roles composed from the permission catalog).

Resident side: `RESIDENT_OWNER`, `RESIDENT_TENANT`, `FAMILY_MEMBER`.
Operations: `GUARD`, `STAFF`, `VENDOR_USER`.

## Permission catalog (grows per module)

`resident.read/write`, `visitor.read/create/approve/override`,
`billing.read/create/approve`, `payment.read/reconcile`,
`helpdesk.read/assign/resolve`, `amenity.manage/book`, `notice.publish`,
`parking.manage`, `reports.view/export`, `audit.view`,
`admin.users.manage`, `admin.roles.manage`, `admin.settings.manage`,
`platform.communities.manage`.

## Matrix highlights

| Action | AUDITOR | SECURITY_MANAGER | ACCOUNTANT | RESIDENT_* | GUARD |
|---|---|---|---|---|---|
| Read visitors | ✅ | ✅ | ❌ | own unit | ✅ (minimal PII) |
| Override approval | ❌ | ✅ (audited, reason required) | ❌ | ❌ | ❌ |
| Create invoices | ❌ | ❌ | create | ❌ | ❌ |
| Reconcile payments | ❌ | ❌ | reconcile | ❌ | ❌ |
| Resolve tickets | ❌ | ❌ | ❌ | own tickets | ❌ |
| Audit log view | ✅ | ❌ | ❌ | ❌ | ❌ |

Custom roles: community admins compose permissions into new roles;
system roles cannot be edited. Every permission check is evaluated inside the
requester's community scope only.

Guard PII rule: guards see destination label (e.g. "A-101"), visitor name,
type, photo, vehicle — never phone numbers, occupancy history or dues.
