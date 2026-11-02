# ADR 0004 — API and Error Conventions

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

The Android client, admin panel and backend must agree on URL structure, payload shape and failure behaviour. Inconsistent errors are the most common cause of poor mobile UX.

## Decision

### URLs

- All learner and admin routes live under `/api/v1`.
- Resource names are plural kebab-case: `/learning-paths`, `/quiz-attempts`.
- Actions that are not plain CRUD use explicit sub-paths: `/lessons/:id/complete`.
- Admin routes are namespaced under `/api/v1/admin`.

### Payloads

- JSON only, `camelCase` field names.
- Timestamps are ISO-8601 UTC strings (`2026-10-21T10:15:30.000Z`); local-day logic is computed server-side using the configured time zone.
- IDs are opaque strings (cuid/uuid), never auto-increment integers exposed to clients.
- Lists are paginated with `?page=1&pageSize=20` (max 100); responses include `{ items, page, pageSize, total }`.

### Errors

Single envelope:

```json
{
  "error": {
    "code": "LESSON_NOT_FOUND",
    "message": "Lesson not found.",
    "details": [{ "field": "id", "message": "Unknown lesson" }]
  }
}
```

- Stable machine-readable `code`; human `message`; optional `details`.
- `400` validation, `401` unauthenticated/expired, `403` forbidden, `404` not found, `409` conflict/idempotency, `422` business-rule failure, `429` rate limited, `5xx` unexpected.
- Never expose stack traces, SQL, tokens or secrets in responses.

### Idempotency

- Lesson completion, quiz submission and billing events accept an `Idempotency-Key` header or natural key.
- Repeated requests return the original result with `200`, not a duplicate reward.
- Server-side uniqueness constraints back the idempotency logic.

### Versioning

- `/api/v1` is frozen for MVP. Breaking changes require `/api/v2`; additive fields are allowed.

## Consequences

- A shared NestJS exception filter and response interceptor implement this once.
- Android maps `code` values to localized messages and never parses `message` text.
