# SECURITY.md — Security & privacy posture

## Implemented controls (Release 1)

- Argon2id password hashing; OTPs hashed at rest, TTL + attempt limits + per-target throttle.
- Short-lived JWT access tokens; rotating refresh tokens with server-side revocation; logout revokes session.
- Brute-force/rate limiting on auth and OTP endpoints.
- Server-side authorization on every endpoint (`PermissionsGuard` + tenant scope). IDOR regression tests in CI.
- Standardized error envelope; no stack traces to clients.
- Zod validation on every input boundary (frontend forms mirror `packages/validation`).
- File uploads: type allowlist, size limits, stored outside webroot, access via short-lived signed URLs only.
- Webhook signature verification; idempotent handlers; client payment "success" screens are never trusted.
- Money as integer paise; invoice state machine; issued documents immutable.
- Audit events for high-risk actions (permission change, visitor override, invoice create/cancel, financial posting, reconciliation, resident deactivation, PII export, admin login, tenant config change). Audit rows are append-only (no update/delete endpoints).
- Secrets only via environment; `.env` gitignored; `.env.example` documents every variable.

## Privacy by design

Data minimization (guards never see resident phone numbers), masking of
sensitive fields in ordinary screens, resident data export & correction
workflows, configurable retention, deactivation over deletion, audit of
privileged reads (Release 2 for full field-level read auditing), signed
temporary download URLs.

## Compliance honesty

Tax/GST/TDS/late-fee thresholds are configuration surfaces. The software
enables compliance but does **not** guarantee it; rule changes require review
by qualified finance/legal professionals. No automatic legal-compliance claims
are made anywhere in the product.

## Reporting

Security issues: open a private advisory; do not open public issues with
exploit details.
