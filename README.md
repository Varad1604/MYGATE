# SocietyOS

**Multi-tenant Community Management ERP & Gate Security SaaS** — an original
implementation of the MyGate-category product for residential societies.
Not a clone: original architecture, UI and code.

## Quick start (development)

Prerequisites: Node ≥ 22, pnpm ≥ 10 (`corepack enable`).

```bash
pnpm install
pnpm setup        # writes .env from template, boots embedded Postgres, runs migrations + seed
pnpm dev:api      # http://localhost:4000  (OpenAPI at /docs)
pnpm dev:admin    # http://localhost:3000  society admin dashboard
pnpm dev:resident # http://localhost:3001  resident PWA
pnpm dev:guard    # http://localhost:3002  guard PWA
```

Demo logins after seeding are printed by `pnpm db:seed` (dev OTPs appear in the
API console when `OTP_PROVIDER=mock`).

### Demo accounts (Greenview Residency, seeded)

| Who | Login | Notes |
| --- | --- | --- |
| Community admin | `admin@greenview.test` / `Demo#Pass1` | password login |
| Resident (owner, A-101) | `anita@example.com` or `+9911100101` | OTP; dev autofill via `/api/v1/__dev/last-otp` |
| Tenant (A-201) | `+9911100201` | OTP |
| Security manager | `+9900000010`, guard `+9900000011` | OTP |
| Field staff (plumber) | `+9900000020` | OTP |

### End-to-end suites (all passing)

```bash
scripts/e2e-visitors.ps1    # gate check-in/out, resident approvals, overrides
scripts/e2e-billing.ps1     # bill runs, invoices, signed webhooks, receipts
scripts/e2e-amenities.ps1   # booking race test (concurrency-safe)
scripts/e2e-notices.ps1     # audience targeting, scheduled publish, acks
scripts/e2e-parking.ps1     # slots, allocation guards, gate lookup
```

Run them against a live dev API (`pnpm dev:api`). The billing suite signs real
HMAC webhook payloads and asserts replay-idempotency + tamper rejection.

Full Docker parity (Postgres/Redis/MinIO): `docker compose up -d` then set
`REDIS_URL` / S3 vars in `.env`.

## Repository map

See `docs/ARCHITECTURE.md`. Docs index: `docs/PRODUCT.md`,
`docs/DATABASE.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/ADR.md`,
`docs/API.md`, `docs/PERMISSIONS.md`, `docs/SECURITY.md`, `docs/DEPLOYMENT.md`.

## License / provenance

Proprietary sample project. All product naming, design and code are original.
