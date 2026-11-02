# Authentication & Account API

- **Status:** Implemented in Task 3
- **Base path:** `/api/v1`
- **Related:** [ADR 0002](adr/0002-authentication-strategy.md), [ADR 0004](adr/0004-api-and-error-conventions.md)

All learner auth routes use the standard error envelope. Access tokens are sent as
`Authorization: Bearer <accessToken>`. Refresh tokens are opaque values returned in
the JSON body and stored by the Android client in Keystore-backed storage.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/auth/register` | — | Create an email/password account and sign in |
| `POST` | `/auth/login` | — | Sign in with email/password |
| `POST` | `/auth/google` | — | Sign in or sign up with a Google ID token |
| `POST` | `/auth/refresh` | refresh token | Rotate the refresh token and issue a new access token |
| `POST` | `/auth/logout` | refresh token | Revoke the current refresh session |
| `GET` | `/auth/me` | access token | Return the authenticated learner |
| `POST` | `/account/deletion-request` | access token | Schedule account deletion |
| `DELETE` | `/account` | access token | Alias for the PRD's deletion request route |
| `GET` | `/account/deletion-request` | access token | Read the latest deletion request |
| `DELETE` | `/account/deletion-request` | access token | Cancel a pending deletion request |

### Register

```json
{
  "email": "learner@example.com",
  "password": "Password123",
  "name": "Asha",
  "acceptTerms": true,
  "acceptPrivacy": true
}
```

- Email is trimmed and lower-cased.
- Password must be 8–128 characters and contain at least one letter and one number.
- Terms and privacy acceptance are required and recorded with `TERMS_VERSION`.
- Returns `201` with the same shape as login. Registration signs the learner in.

### Login

```json
{ "email": "learner@example.com", "password": "Password123" }
```

Returns `200`:

```json
{
  "user": {
    "id": "cm...",
    "email": "learner@example.com",
    "name": "Asha",
    "avatarUrl": null,
    "emailVerifiedAt": null,
    "status": "ACTIVE",
    "timeZone": "Asia/Kolkata",
    "locale": "en-IN",
    "onboardingCompletedAt": null,
    "createdAt": "2026-10-21T09:15:00.000Z",
    "hasPassword": true,
    "authProviders": ["EMAIL"]
  },
  "tokens": {
    "accessToken": "...",
    "refreshToken": "rt_...",
    "accessTokenExpiresAt": "2026-10-21T09:30:00.000Z",
    "refreshTokenExpiresAt": "2026-11-20T09:15:00.000Z",
    "tokenType": "Bearer"
  }
}
```

### Refresh and rotation

```json
{ "refreshToken": "rt_..." }
```

- The old session is marked `ROTATED` and linked to the replacement.
- A new access token and refresh token are returned.
- The session is claimed with a conditional `updateMany`, so only one of two
  overlapping refresh requests can rotate it. The losing request returns `401`
  without invalidating the winner's replacement session.
- Replaying the just-rotated token within a **10-second grace window** also
  returns `401` without revoking the family. This absorbs duplicate refresh
  requests caused by several simultaneous `401` responses; clients should still
  single-flight refresh requests.
- After the grace window, replaying an already-rotated refresh token is treated
  as theft: the whole `familyId` is revoked with `REUSE_DETECTED`, and the request
  returns `401`.
- The previous access token is tied to the now-revoked session, so clients must
  switch to the access token returned by the refresh response.

### Logout

```json
{ "refreshToken": "rt_..." }
```

Returns `204` even if the token is already invalid, making the operation
idempotent. The access token immediately stops working because the auth guard
checks the session row.

### Google

```json
{
  "idToken": "eyJ...",
  "acceptTerms": true,
  "acceptPrivacy": true
}
```

- Disabled by default. Set `AUTH_GOOGLE_ENABLED=true` and `GOOGLE_CLIENT_ID`.
- The backend verifies the ID token with `google-auth-library`, including the
  audience and `email_verified`.
- Existing Google identities sign in directly.
- A verified Google email is linked to an existing email account automatically.
- New Google-only accounts have `passwordHash = null`.
- Consent flags are required only when a new account is created.

### Me

Returns the user view used by login/register, including `hasPassword` and
`authProviders`. It never returns password hashes, refresh hashes, or tokens.

## Sessions and tokens

- **Access token:** JWT, 15 minutes by default (`JWT_ACCESS_TTL`), issuer and
  audience checked.
- **Refresh token:** 256-bit random opaque token, 30 days by default
  (`JWT_REFRESH_TTL`). Only a SHA-256 hash is stored.
- Every login creates a new session family. Refresh rotation keeps the same
  family.
- The guard checks the JWT, the session row, session expiry, and user status on
  every protected request. This makes logout and account deletion immediate.
- Passwords use Argon2id with OWASP-recommended parameters (19 MiB, t=2, p=1).
  A transparent rehash occurs on login if parameters have been raised.
- Failed logins do a dummy Argon2 verification to reduce email-enumeration timing
  differences.

## Account deletion

`POST /account/deletion-request` (or `DELETE /account`) creates a `PENDING`
record with `scheduledFor = now + ACCOUNT_DELETION_GRACE_DAYS` (default 30) and
revokes every active session immediately.

```json
{
  "id": "cm...",
  "status": "PENDING",
  "reason": "No longer using the app",
  "requestedAt": "2026-10-21T09:15:00.000Z",
  "scheduledFor": "2026-11-20T09:15:00.000Z",
  "completedAt": null,
  "canceledAt": null,
  "retentionNotice": "Your account is scheduled for deletion on 2026-11-20. ..."
}
```

- Repeating the request is idempotent and returns the existing pending request;
  any sessions created since the first request are revoked too.
- The account remains active during the grace period so the learner can sign in
  again and cancel.
- Cancellation returns `200` and marks the request `CANCELED`. Because sessions
  were revoked, the learner must sign in again after requesting deletion.
- `GET /account/deletion-request` returns `{ "request": null }` when there is no
  request.
- The actual purge/anonymisation job is **not** part of Task 3. A scheduled job
  must process `PENDING` requests whose `scheduledFor` has passed, preserve
  legally required billing records, and revoke/anonymise the rest.

## Error codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid or unknown fields; `details` contains field paths |
| 401 | `INVALID_CREDENTIALS` | Wrong email/password |
| 401 | `UNAUTHENTICATED` | Missing bearer token |
| 401 | `INVALID_ACCESS_TOKEN` | Expired or revoked access token |
| 401 | `INVALID_REFRESH_TOKEN` | Expired, revoked, or reused refresh token |
| 401 | `INVALID_GOOGLE_TOKEN` | Google ID token could not be verified |
| 403 | `ACCOUNT_UNAVAILABLE` | Account is suspended/deleted |
| 403 | `GOOGLE_AUTH_DISABLED` | Google sign-in is switched off |
| 404 | `NO_PENDING_DELETION_REQUEST` | No pending request to cancel |
| 409 | `EMAIL_ALREADY_REGISTERED` | Email already has an account |
| 409 | `GOOGLE_ACCOUNT_ALREADY_LINKED` | Email is linked to another Google account |
| 422 | `TERMS_ACCEPTANCE_REQUIRED` | New Google account without consent flags |
| 429 | `RATE_LIMITED` | Throttle exceeded |
| 500 | `INTERNAL_ERROR` | Unexpected failure; details are logged, not returned |
| 503 | `GOOGLE_AUTH_NOT_CONFIGURED` | Google sign-in is enabled but `GOOGLE_CLIENT_ID` is missing |

## Rate limits

Global default: **100 requests/minute** per IP. Sensitive routes override it:

| Route | Limit |
|---|---|
| Register | 5/minute |
| Login | 10/minute |
| Google | 10/minute |
| Refresh | 60/minute |
| Logout | 30/minute |
| Deletion request / cancel | 5 and 10 per hour |

The default storage is in-memory, which is appropriate for a single-instance MVP.
Move to Redis (or a shared `ThrottlerStorage`) before running multiple API
instances. Set `TRUST_PROXY=true` only when the API is behind a trusted reverse
proxy so client IPs are read from `X-Forwarded-For`.

## Configuration

```env
JWT_ACCESS_SECRET=<32+ chars>
JWT_REFRESH_SECRET=<32+ chars>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
JWT_ISSUER=smartme-api
JWT_AUDIENCE=smartme-api
AUTH_GOOGLE_ENABLED=false
GOOGLE_CLIENT_ID=
TERMS_VERSION=2026-10-21
ACCOUNT_DELETION_GRACE_DAYS=30
TRUST_PROXY=false
```

`JWT_REFRESH_SECRET` is reserved for future signed refresh formats; refresh
tokens are currently random opaque values hashed with SHA-256. Google client IDs
may be comma-separated when both debug and release Android client IDs are used.

## HTTP hardening

The API applies Helmet's default security headers. CORS is restricted to the
origins configured in `CORS_ORIGIN` (comma-separated values are supported).

## Known MVP limits

- Email verification is not enforced; email registrations have
  `emailVerifiedAt = null`. Add a verification flow before treating email
  ownership as proven.
- Password reset is not implemented yet.
- Admin authentication is a separate realm and is not part of this task.
- Account deletion records a schedule and revokes sessions, but no purge worker
  runs yet.
- Rate limiting is in-memory and per-instance.
- Google auto-linking trusts Google's verified email; document this in the
  privacy/security copy.

## Tests

- `src/auth/auth.integration.spec.ts` exercises registration, login, rotation,
  concurrent refresh handling, reuse detection, logout, guard revocation,
  deletion request/cancel, Google disabled, Google-only sign-up, and
  email-account linking against PostgreSQL.
- `src/common/filters/api-exception.filter.spec.ts` locks the error envelope.
- `src/common/utils/duration.spec.ts` covers TTL parsing.
- Health tests remain in `src/health/health.controller.spec.ts`.
