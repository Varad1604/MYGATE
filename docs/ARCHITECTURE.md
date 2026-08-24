# ARCHITECTURE.md — SocietyOS System Architecture

## Monorepo layout

```text
/apps
  /api            NestJS REST API (+ SSE realtime), Prisma, domain modules
  /admin-web      Next.js society-admin dashboard
  /resident-pwa   Vite React PWA for residents
  /guard-pwa      Vite React PWA for gate security
/packages
  /types          Shared TypeScript domain types & enums
  /validation     Zod schemas shared by API and frontends
  /permissions    Permission catalog + role→permission matrix (single source)
  /api-client     Typed API client for all frontends
  /ui             Shared design-system components (later phase)
  /config         Shared eslint/ts config (later phase)
```

## Backend

- **NestJS 11** modular monolith organized by bounded domains. Implemented
  today: `auth (+OTP/JWT/refresh rotation), communities, residents, visitors
  (+domestic help), helpdesk (SLA engine), billing, payments (mock gateway,
  ADR-004), amenities (race-safe booking), notices (audience targeting +
  scheduled publish), parking, notifications, realtime (SSE), audit
  (append-only), platform (super-admin), queue, storage, files`.
- **REST + OpenAPI**; consistent envelope, pagination, filtering, errors.
  Zod-per-route validation (`ZodValidationPipe`), no global pipe.
- **Realtime**: Server-Sent Events per authenticated principal
  (`/realtime/stream`) — visitor approvals, ticket updates, notifications.
  Chosen over WebSockets for proxy-friendliness and simplicity; transport can
  be swapped behind `RealtimeGateway`. EventSource clients authenticate via a
  short-lived `?access_token=` accepted on this route only.
- **Recurring sweeps** (visitor expiry, ticket SLA, notice publish/expire)
  run as in-process timers; one-shot work (notice fan-out) travels through
  the durable queue. The queue driver reaps stale PROCESSING claims so
  crashed workers cannot wedge dedupe keys.

## Multi-tenancy model (ADR-001)

Shared database, shared schema, `community_id` column on every tenant-owned
table. Tenant context is **never** taken from the client body/query — it is
derived from the authenticated principal's community memberships and attached
to the request by `TenantContextMiddleware`. All repository access goes through
services that require an explicit tenant scope. IDOR tests are part of CI.

## State machines (ADR-006)

Visitor, ticket, invoice, payment, booking and move-in/out transitions are
enforced in the domain layer via explicit transition maps
(`packages/types/src/state-machines.ts` consumed server-side). The frontend
cannot drive an invalid transition because the API rejects it and audits it.

## Money & time

- Money: integer smallest currency unit (paise) end-to-end. Never floats.
- Time: `timestamptz` UTC in DB; each Community stores an IANA timezone;
  display layers format in community/user timezone.

## Infrastructure adapters

Every infra dependency sits behind an interface with two drivers:

| Concern | Production driver | Dev fallback (no Docker needed) |
|---|---|---|
| Database | PostgreSQL (any host) | Embedded Postgres binaries run from `.localdata` (`pnpm db:up`) |
| Queue/jobs | BullMQ + Redis (`REDIS_URL`) | Postgres-backed polling queue (`DbQueueDriver`) |
| Object storage | S3-compatible (`@aws-sdk/client-s3`) | Local disk + HMAC-signed URLs (`LocalStorageDriver`) |
| OTP/SMS/Email | Provider adapters | `mock` providers (console/log; never enabled in production paths) |
| Payments | Razorpay/Cashfree adapters (webhook-verified) | `MockPaymentProvider` with simulated webhooks |

Business modules depend only on interfaces (`IQueue`, `IStorage`,
`IOtpSender`, `IPaymentProvider`, `INotificationChannel`). See ADR-002/004.

## Observability

Structured JSON logs with `requestId` propagation, `/health` (liveness),
`/health/ready` (DB + queue checks), error-monitor adapter hook
(OpenTelemetry-compatible later).

## Frontends

- Admin: Next.js App Router + Tailwind + TanStack Query + RHF + Zod.
- Resident/Guard: Vite React PWAs (installable, offline-capable guard queue
  via IndexedDB + sync engine with client-generated event IDs; ADR-005).
- All frontends use `packages/api-client`; authorization is always
  server-enforced — client-side checks are UX only.

## Testing strategy

Unit (domain rules), integration (services+DB against embedded Postgres),
API (authz/IDOR), E2E Playwright for scenarios A–J (see docs/IMPLEMENTATION_PLAN.md).
