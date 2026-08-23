# PRODUCT.md — SocietyOS Product Definition

SocietyOS is a multi-tenant Community Management ERP & Gate Security SaaS for
residential societies, apartment complexes, gated communities and townships.
It is an original implementation of the product category exemplified by
MyGate / NoBrokerHood / ADDA — no proprietary code, assets or branding are used.

## Product concept

One centralized operating system for residential communities:

```text
SaaS Platform → Organization → Community → Tower → Floor → Unit → Residents
```

Every module references the same shared hierarchy: the same `CommunityId`,
`UnitId`, `ResidentId` and `UserId` flow through visitors, billing, helpdesk,
amenities, parking, notices, reports and audit.

## Personas / interfaces

| Interface | Users | Notes |
|---|---|---|
| Platform Super Admin | SaaS operator | Onboard societies, plans, feature flags, tenant health, audit |
| Admin Web Dashboard | Society admin, committee, facility manager, accountant, treasurer, helpdesk/security managers, auditor | Full ERP surface |
| Resident PWA | Owners, tenants, family members | Approvals, dues, complaints, bookings, notices |
| Guard PWA | Gate security staff | Large touch targets, minimal typing, offline-tolerant |

## Release plan

### Release 1 — Core Commercial MVP (this codebase's target)

1. Authentication & multi-tenancy
2. Society / tower / unit management
3. Resident / owner / tenant management
4. Roles & permissions (server-enforced RBAC)
5. Visitor & gate security management
6. Helpdesk & complaint management
7. Maintenance billing & payment collection
8. Amenity booking
9. Notice board & notifications
10. Vehicle & parking management
11. Dashboards & reports (from persisted data only)
12. Audit logs

### Release 2 — ERP expansion (post-MVP)

Double-entry accounting (chart of accounts, journals, vouchers, credit notes,
bank reconciliation), vendors, staff attendance, procurement (PR/PO/expenses),
assets, inventory, document management, polls, move-in/out workflow, security
deposits, committee management, recurring tasks.

### Release 3 — Advanced platform (later)

QR gate passes, ANPR/barrier integration adapters, IoT metering, AI helpdesk
assistant, OCR, advanced analytics, marketplace, patrol checkpoints, advanced
workflow engine.

## Demo story (Definition of Done for MVP)

See IMPLEMENTATION_PLAN.md §"Demo script". The MVP is done when this 25-step
story can be demonstrated without touching the database manually.

## Non-goals for MVP

- No native mobile apps (PWA-first; backend contracts stay transport-agnostic).
- No real payment gateway credentials wired (MockPaymentProvider in dev;
  Razorpay/Cashfree adapters are architecture-ready but disabled).
- No legal-compliance claims: tax/GST/TDS rules are configuration surfaces,
  flagged for review by qualified professionals (see SECURITY.md §Compliance).
