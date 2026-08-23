# Architecture Decision Records

## ADR-001 Multi-tenancy model
**Decision:** Shared DB, shared schema, `communityId` on every tenant-owned row.
Tenant scope derived from authenticated membership, never from client input.
**Why:** Cheapest to operate at this scale, single migration path, easy
cross-tenant analytics for platform admin. Isolation enforced by a mandatory
tenant guard + repository scoping + dedicated IDOR tests.

## ADR-002 Authentication strategy
**Decision:** Email+password (argon2id) for admins; phone OTP for
residents/guards; JWT short-lived access tokens + rotating refresh tokens with
revocation; provider abstraction (`IOtpSender`, mock in dev). OTP throttled and
attempt-limited. MFA hooks for privileged roles (Release 2 enforcement).
**Why:** Matches Indian market norms (phone-first residents), keeps provider
swappability, avoids hardcoding OTPs in production paths.

## ADR-003 Realtime visitor approvals
**Decision:** Server-Sent Events over an authenticated `/realtime/stream`
endpoint; events fan out per community with audience filters.
**Why:** SSE survives restrictive proxies, auto-reconnects, needs no extra
infra; WebSockets can be added later behind the same gateway interface.

## ADR-004 Payment abstraction
**Decision:** `IPaymentProvider` interface; `MockPaymentProvider` in dev;
Razorpay/Cashfree adapters behind config. Server verifies webhooks with
signature validation; order status is never trusted from the client; webhook
handling is idempotent (unique event id per provider).
**Why:** Sandbox-friendly development, production-ready seams.

## ADR-005 Offline gate synchronization
**Decision:** Guard PWA queues actions in IndexedDB with client-generated
`eventId` (UUIDv7); sync engine replays in order; server handlers idempotent
per `eventId`; UI shows explicit offline/syncing/pending states.
**Why:** Gate connectivity is unreliable; silent data loss is unacceptable.

## ADR-006 State machines in the domain layer
**Decision:** Explicit transition maps per aggregate (visitor, ticket,
invoice, payment, booking, move); transitions validated server-side and audited.
**Why:** Prevents UI-driven invalid jumps; single source of truth.

## ADR-007 Dev infrastructure without Docker (this machine)
**Decision:** Embedded Postgres (npm-managed binaries, data in `.localdata/`,
localhost trust auth on port 55432) when Docker/Postgres service is
unavailable; Postgres-backed `DbQueueDriver` fallback for jobs; local-disk
storage driver with HMAC-signed URLs. Production/compose path unchanged
(Redis/BullMQ, MinIO/S3).
**Why:** Keeps the product runnable end-to-end on this Windows machine without
admin rights; all fallbacks are adapters, not forks.
