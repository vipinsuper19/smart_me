# API Conventions

**Base path:** `/api/v1`  
**Protocol:** HTTPS in deployed environments  
**Style:** REST with JSON request/response bodies  
**Status:** Initial conventions for the MVP

## 1. URL conventions

- Use plural nouns for collections: `/courses`, `/lessons`, `/quizzes`.
- Use path parameters for resource identifiers: `/courses/:courseId`.
- Use nested routes when the relationship is clear: `/courses/:courseId/lessons`.
- Use HTTP methods according to their semantics.
- Do not expose database table names or ORM implementation details in public URLs.
- Version breaking API changes through a new API version rather than silently changing behavior.

Examples:
- `GET /api/v1/learning-paths`
- `GET /api/v1/courses/:courseId`
- `GET /api/v1/lessons/:lessonId`
- `POST /api/v1/lessons/:lessonId/complete`

## 2. HTTP methods

| Method | Intended use |
|---|---|
| GET | Read a resource or collection |
| POST | Create a resource or execute a non-idempotent action |
| PUT | Replace a resource representation when appropriate |
| PATCH | Partially update a resource |
| DELETE | Delete a resource or initiate a documented deletion workflow |

Use `201 Created` for successful creation where appropriate. Use `204 No Content` only when the response has no body.

## 3. JSON conventions

- Use `camelCase` property names.
- Use ISO 8601 UTC timestamps for API timestamps, e.g. `2026-10-21T10:30:00Z`.
- Use stable opaque IDs in public API contracts.
- Represent money as integer minor units plus currency, or a documented decimal string; never use floating-point values for monetary calculations.
- Keep API DTOs independent from raw database objects.
- Do not return secrets or fields that clients do not need.
- Document nullable fields and optional fields distinctly.
- Represent enums as documented strings.

Example response:

```json
{
  "data": {
    "id": "lesson_123",
    "title": "Introduce Yourself in an Interview",
    "durationMinutes": 8,
    "accessLevel": "free"
  }
}
```

The IDs above are illustrative only.

## 4. Success response conventions

For a single resource or action, use a consistent envelope:

```json
{
  "data": {
    "id": "resource_123"
  }
}
```

For collections:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

Choose either pagination by page or cursor pagination for each endpoint family and document it. Do not mix styles without a clear reason.

## 5. Error response conventions

Use a consistent error envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the submitted information.",
    "details": [
      {
        "field": "title",
        "code": "REQUIRED"
      }
    ],
    "requestId": "req_example"
  }
}
```

Rules:
- `code` is a stable machine-readable value.
- `message` is safe for display and does not expose internal implementation details.
- `details` is optional and should not contain sensitive values.
- `requestId` supports troubleshooting.
- Never return stack traces or SQL details in production.

Suggested status mapping:
- `400 Bad Request`: malformed request or invalid business input.
- `401 Unauthorized`: missing or invalid authentication.
- `403 Forbidden`: authenticated but not permitted.
- `404 Not Found`: resource not found or intentionally concealed.
- `409 Conflict`: state conflict, duplicate resource or invalid transition.
- `422 Unprocessable Content`: optional for well-formed requests that fail semantic validation; use consistently if adopted.
- `429 Too Many Requests`: rate limit exceeded.
- `500 Internal Server Error`: unexpected failure.
- `503 Service Unavailable`: temporary dependency/service unavailability.

## 6. Validation

- Validate path parameters, query parameters and request bodies.
- Reject unexpected or invalid fields according to the configured policy.
- Normalize input only where doing so is safe and documented.
- Validate pagination bounds.
- Validate content-block JSON against a versioned schema.
- Validate ownership and resource state in the service layer as well as authentication at the controller boundary.

## 7. Authentication and authorization

- Protected endpoints require the agreed authentication mechanism.
- Derive user identity from the validated principal.
- Never trust `userId` in the request body to decide ownership.
- Enforce admin roles on the server.
- Apply ownership checks to lessons, attempts, progress and subscriptions.
- Define token expiry, refresh and revocation behavior before implementing authentication.

## 8. Idempotency and duplicate requests

Operations that can award XP, complete a lesson, submit a quiz, verify a purchase or process provider notifications must be safe against retries.

Use one or more of:
- Unique database constraints.
- Explicit state transitions.
- Idempotency keys where appropriate.
- Provider event IDs.
- Transactions.

Repeated requests should return a stable result or a documented conflict, not duplicate side effects.

## 9. Lesson progress conventions

A progress payload may contain the current content block, completion percentage and last-accessed position. The server must validate the lesson and user relationship.

Example:

```json
{
  "currentBlockIndex": 3,
  "completionPercent": 45
}
```

Do not trust client-supplied XP, quiz scores or premium status. Lesson completion is accepted only when the configured server-side rules are satisfied.

## 10. Quiz conventions

- Create an attempt before accepting answers.
- Associate every answer with the authenticated user's attempt.
- Verify attempt ownership and status on every mutation.
- Compute final scores on the server.
- Prevent answers or rewards from being submitted repeatedly after finalization.
- Avoid exposing correct answers before the intended reveal point if the quiz design requires withholding them.

## 11. Pagination, filtering and sorting

For collection endpoints:
- Document supported filters.
- Set a default page size and maximum page size.
- Validate sort fields against an allowlist.
- Use stable ordering, including a tie-breaker.
- Do not accept raw SQL fragments or arbitrary ORM field names from clients.

## 12. API documentation

- Publish OpenAPI/Swagger documentation for the API.
- Document authentication requirements, request schemas, response schemas and error codes.
- Include representative success and failure examples.
- Keep API documentation synchronized with DTOs and implementation.
- Add contract tests for critical endpoints.

## 13. Endpoint acceptance checklist

Before considering an endpoint complete, verify:
- Request validation.
- Authentication requirement.
- Authorization and ownership checks.
- Correct HTTP status.
- Consistent response/error shape.
- Safe logging.
- Duplicate/retry behavior where relevant.
- Unit/integration tests.
- OpenAPI documentation.
