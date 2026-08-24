# IMPLEMENTATION_PLAN.md

Status tracker. Updated as phases complete (Definition of Done per feature:
schema+migration, API, validation, server-side authz, UI, loading/error/empty
states, audit where needed, tests, docs, green build).

## Phases

| Phase | Scope | Status |
|---|---|---|
| 0 | Monorepo, docs, ADRs, compose, CI | ✅ |
| 1 | Embedded PG runner, Prisma core schema, auth+tenancy+RBAC+audit API | ✅ |
| 2 | Society structure + residents slice (API + admin UI) | ✅ |
| 3 | Visitor security + guard PWA + resident approvals + SSE | ✅ |
| 4 | Helpdesk (tickets, categories, SLA engine) | ✅ |
| 5 | Billing + payments + receipts (+ mock provider webhooks) | ✅ |
| 6 | Amenities + transactional booking | ✅ |
| 7 | Notices + notification service | ✅ |
| 8 | Vehicles + parking | ✅ |
| 9 | Dashboards/reports + audit UI + platform super admin | ✅ reports API + Reports page; platform console live |
| 10 | E2E A–J, hardening, seed data finalization, docs | ✅ scripts/e2e-scenarios.ps1 green; ESLint 9; graceful shutdown |

Release 2 items start only after Phase 10 is green.

## Vertical-slice rule

Each module ships DB→API→permissions→UI→realtime(when relevant)→tests as one
slice. No "all tables first, UI later".

## Demo script (MVP exit criterion)

1. Platform admin creates community → society admin onboarded.
2. Society admin configures towers/units.
3. Admin adds residents (owner + tenant).
4. Resident signs in (OTP mock).
5. Resident pre-approves a visitor → QR/OTP token issued.
6. Guard validates token → check-in logged.
7. Spot visitor → guard requests approval.
8. Resident approves from phone (SSE push).
9. Guard screen updates in real time.
10. Visitor exits → log closed.
11. Resident raises plumbing complaint.
12. Helpdesk assigns it (SLA clock starts).
13. Staff resolves; resident reopens/rates path verified.
14. Admin runs recurring maintenance bill run → invoices issued.
15. Resident sees outstanding dues.
16. Resident pays via MockPaymentProvider → webhook verified server-side.
17. Invoice marked paid; receipt PDF generated.
18. Resident books amenity.
19. Conflicting booking rejected (transactional test).
20. Admin publishes notice → in-app notification to targeted audience.
21. Admin views dashboards (all values from persisted data).
22. Auditor role can read but not write (server-enforced).
23. Cross-community access attempts denied (IDOR test).
24. Security override requires reason and lands in audit log.
25. All key operations appear in AuditEvent history.

## E2E scenarios (Playwright)

A setup chain · B pre-approved visitor · C spot approval realtime · D reject ·
E ticket lifecycle · F recurring billing · G payment webhook → receipt ·
H amenity conflict race · I cross-tenant denial · J auditor write denial.
