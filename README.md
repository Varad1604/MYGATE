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

Full Docker parity (Postgres/Redis/MinIO): `docker compose up -d` then set
`REDIS_URL` / S3 vars in `.env`.

## Repository map

See `docs/ARCHITECTURE.md`. Docs index: `docs/PRODUCT.md`,
`docs/DATABASE.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/ADR.md`,
`docs/API.md`, `docs/PERMISSIONS.md`, `docs/SECURITY.md`, `docs/DEPLOYMENT.md`.

## License / provenance

Proprietary sample project. All product naming, design and code are original.
