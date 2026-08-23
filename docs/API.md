# API.md — Conventions

Base URL: `http://localhost:4000/api/v1`. OpenAPI: `http://localhost:4000/docs`.

## Error envelope

```json
{
  "error": {
    "code": "VISITOR_ALREADY_CHECKED_IN",
    "message": "Visitor is already checked in.",
    "requestId": "8f14e45f-..."
  }
}
```

Raw DB errors and stack traces never reach clients; they are logged with the
`requestId`.

## Pagination / filtering / sorting

List endpoints accept `?page=1&pageSize=25` (max 100), `?sortBy=&sortDir=`,
plus module-specific filters. Response envelope:

```json
{ "items": [...], "page": 1, "pageSize": 25, "total": 132 }
```

No endpoint returns unbounded datasets.

## Auth

`Authorization: Bearer <accessToken>` (15-min TTL). Refresh via
`POST /auth/refresh` with rotating refresh token (cookie or body).
`POST /auth/logout` revokes the session.

## Tenant context

Never accepted from client payloads. Derived from membership claims; admin
acting across communities must switch active community via
`POST /auth/switch-community` (re-issues token with new tenant claim).

## Idempotency

Mutations that create financial or gate records accept
`Idempotency-Key` header; replays return the original result.

## Realtime

`GET /realtime/stream` (SSE; Last-Event-ID respected). Event names:
`visitor.approval_requested`, `visitor.approved`, `visitor.rejected`,
`visitor.expired`, `visitor.checked_in`, `visitor.checked_out`,
`ticket.updated`, `notification.new`, `notice.published`.
