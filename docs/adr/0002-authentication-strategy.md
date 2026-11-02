# ADR 0002 — Authentication Strategy

- **Status:** Accepted
- **Date:** 2026-10-21
- **Updated:** 2026-10-21 — email + Google Sign-In confirmed for MVP

## Context

The PRD requires secure registration/sign-in, graceful expiry, sign-out and account deletion. It lists Google and email as optional methods and says phone OTP should only be included if budget and validation justify it. Admin authentication must be separate from learner privileges.

## Decision

### Learner accounts

- **Email + password** and **Google Sign-In** at launch. Argon2id password hashing.
- Google Sign-In is behind `AUTH_GOOGLE_ENABLED` until a Google Cloud OAuth client is configured, but the identity model supports it from day one.
- Accounts are linked through `UserIdentity(provider, providerUserId)`. A user can link both an email identity and a Google identity.
- Google-only accounts have `User.passwordHash = null`.
- **No phone OTP in MVP.** It adds SMS cost, provider integration and abuse handling without proven value.

### Sessions

- Short-lived **JWT access token** (15 minutes) sent as `Authorization: Bearer`.
- **Refresh token** (30 days) stored securely on Android (Keystore-backed storage).
- Refresh tokens are stored **hashed** in the database (`Session.refreshTokenHash`) and rotated on every refresh; reuse of a rotated token revokes the session family (`familyId`).
- `POST /api/v1/auth/logout` revokes the current refresh token.
- Expired/invalid access tokens return `401` with a stable error code; the client attempts one refresh, then routes to sign-in. No crash.

### Admin accounts

- Separate `AdminUser` identity, roles (`SUPER_ADMIN`, `CONTENT_EDITOR`, `ANALYST`) and separate `AdminSession` table.
- Separate login endpoint (`/api/v1/admin/auth/login`) and token audience.
- Backend guards check role/permission on every admin route.
- Learner tokens can never satisfy admin guards.

## Consequences

- Task 3 implements learner `Session` creation, rotation, reuse detection and revocation. `AdminSession` remains schema-only until the admin authentication task.
- Google Sign-In can be enabled without schema changes once OAuth client IDs are available.
- Account deletion must revoke sessions and preserve only legally required records.

## Remaining items

- Decide whether email verification is required before the first lesson.
- Confirm account-deletion retention window and legal copy.
