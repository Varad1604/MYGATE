# Deploying SocietyOS

Target: a single Linux host (2 vCPU / 4 GB is comfortable for a pilot) with
Docker + the compose plugin. Everything runs in containers; no Node on host.

## 1. Prerequisites

- Docker Engine 24+ with `docker compose`
- A domain with DNS pointed at the host (TLS via your proxy/CDN of choice)
- Generate two JWT secrets and one webhook secret:

```bash
openssl rand -hex 32   # JWT_ACCESS_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
openssl rand -hex 32   # MOCK_PAYMENT_WEBHOOK_SECRET (rename var once real gateway lands)
```

## 2. Configure

```bash
cp .env.example .env
# Edit .env — production block at the bottom. The API refuses to boot if you
# leave dev conveniences (mock OTP, demo webhook secret) in place.
```

## 3. Boot

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

What comes up:

| Service | Purpose |
|---|---|
| postgres:17 | data (volume `pgdata`) |
| redis:7 | queue broker (falls back to Postgres queue if absent) |
| api | NestJS; **runs `prisma migrate deploy` on every start** |
| admin | Next.js standalone; serves console **and** proxies `/api`, `/files` to api |

Migrations are automatic. Seeding is deliberately manual (`docker compose -f
docker-compose.prod.yml exec api npx prisma db seed`) — never automatic.

## 4. Verify

```bash
curl http://localhost/api/v1/health/ready      # {"status":"ok"}
open https://your-domain/login                 # admin console
```

## 5. PWAs (resident / guard)

They build to static bundles (`apps/*/dist`). Host them anywhere static:
same nginx box, S3+CloudFront, Netlify — they need only their `/api` path to
reach the API. For same-origin hosting behind one nginx, see
`deploy/edge.nginx.conf` for the subpath pattern (`/r/`, `/g/`).

## 6. Upgrades & rollback

```bash
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d        # migrates forward
docker compose -f docker-compose.prod.yml down          # rollback = redeploy previous tag/image
```

## 7. Backups

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U societyos societyos > backup-$(date +%F).sql
```

Schedule daily via cron/systemd-timer; test restores quarterly.

## Not included here (deliberate)

Real SMS/email delivery, real payment capture, TLS termination, log
aggregation and uptime monitoring are environment concerns — wire them at the
proxy/provider level before inviting real societies.
