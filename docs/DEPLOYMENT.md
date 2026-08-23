# DEPLOYMENT.md

## Environments

| Component | Dev (this repo, no Docker) | Dev (Docker compose) | Production |
|---|---|---|---|
| Postgres | Embedded binaries, port 55432 | `societyos-postgres` | Managed Postgres |
| Queue | DbQueueDriver (Postgres) | Redis + BullMQ | Redis + BullMQ |
| Storage | Local disk `.localdata/storage` | MinIO | S3-compatible |
| OTP/SMS/Email | Mock (console) | Mock | Provider adapters |

## Build & run

```bash
pnpm install && pnpm build
# API
node apps/api/dist/main.js
# Admin web
pnpm --filter @societyos/admin-web build && pnpm --filter @societyos/admin-web start
# PWAs are static builds — serve behind CDN/static host with HTTPS (required for PWA).
```

## Production checklist

- Set strong `JWT_*_SECRETS`; rotate periodically.
- `OTP_PROVIDER`/`EMAIL_PROVIDER` must NOT be `mock`.
- Terminate TLS; set HSTS at the edge; CORS_ORIGINS locked to real domains.
- Run migrations via `pnpm db:migrate` in a release job (never auto on boot).
- Configure log drain + error-monitor adapter; alert on webhook failure logs.
- Schedule recurring jobs (bill runs, SLA sweeps, notice publishing) on workers.
- Backups: managed PITR for Postgres; object storage versioning on.

## CI

GitHub Actions: install → lint → typecheck → unit → integration → build.
A broken build fails CI (see `.github/workflows/ci.yml`).
