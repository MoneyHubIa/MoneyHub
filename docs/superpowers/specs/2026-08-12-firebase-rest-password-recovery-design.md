# Firebase REST Password Recovery Design

**Date:** 2026-08-12  
**Status:** Approved

## Context

MoneyHub delegates passwords and sessions to Firebase Authentication. Password
recovery must keep the MoneyHub web experience, avoid account enumeration, and
work without a separate transactional email provider or sender domain. Firebase
Authentication will send the recovery email, while every recovery operation
will pass through the MoneyHub backend using the Firebase Auth REST API.

## Public API

The backend exposes three public endpoints:

- `POST /auth/password-recovery` accepts `{ "email": "user@example.com" }`.
  Valid requests always return HTTP `202` with
  `{ success: true, data: { accepted: true }, error: null, meta: { requestId } }`.
  This response is identical for known users, unknown users, and Firebase
  delivery failures. Invalid email input returns `400 INVALID_EMAIL`. The route
  permits five requests per source IP in a rolling 15-minute window and returns
  `429 RATE_LIMITED` after that limit.
- `POST /auth/password-recovery/verify` accepts a non-empty `{ "oobCode": "..." }`.
  A valid code returns the canonical success envelope with `{ valid: true }`.
  Missing, malformed, expired, or used codes return a safe
  HTTP `400 INVALID_OR_EXPIRED_ACTION_CODE` response without exposing Firebase
  details. Other provider failures return HTTP `503 RECOVERY_UNAVAILABLE`.
- `POST /auth/password-recovery/confirm` accepts
  `{ "oobCode": "...", "newPassword": "..." }`. Success returns the canonical
  envelope with `{ confirmed: true }`. Invalid action codes use the same safe
  action-code error. Firebase password-policy rejection returns HTTP
  `400 WEAK_PASSWORD` without returning the provider's raw message. Other
  provider failures return HTTP `503 RECOVERY_UNAVAILABLE`.

The verify and confirm routes each permit ten requests per source IP in a
rolling 15-minute window and return `429 RATE_LIMITED` after that limit. Request
bodies are limited to 16 KiB. None of the routes require an authenticated
session because the one-time action code is the recovery credential.

## Firebase REST adapter

An isolated backend adapter owns calls to
`https://identitytoolkit.googleapis.com/v1` and receives the Firebase Web API
key through `FIREBASE_WEB_API_KEY`.

Request initiation calls `accounts:sendOobCode?key=<api-key>` with:

- `requestType: "PASSWORD_RESET"`;
- the normalized email address;
- `continueUrl: ${APP_URL}/login`;
- `canHandleCodeInApp: false`;
- the request source IP when available.

Firebase Console's password-reset action URL points to
`${APP_URL}/reset-password`, so the emailed action opens the MoneyHub handler.
The `APP_URL` domain must be present in Firebase authorized domains.

Code verification calls `accounts:resetPassword?key=<api-key>` with only the
`oobCode`. Confirmation calls the same endpoint with `oobCode` and
`newPassword`. Each outbound request has a 10-second deadline and is aborted
when the deadline expires. The adapter parses only the response fields and
provider codes needed by the service; response bodies, action codes, passwords,
and complete URLs are never logged.

## Security and auditing

Firebase Email Enumeration Protection must remain enabled. The backend also
maps `EMAIL_NOT_FOUND` and every initiation failure to the same public `202`
response. This preserves public response parity even if project configuration
changes or Firebase rejects a request.

Initiation audit events contain only `requestId`, status, the SHA-256 hash of
the normalized email, and a sanitized provider code when available. Verify and
confirm audit events contain `requestId`, operation, status, and a sanitized
provider code. Raw email addresses, passwords, `oobCode` values, tokens, REST
URLs containing the API key, and Firebase response bodies must never be logged.

The existing in-process IP limiter remains suitable for local acceptance. A
shared limiter and reviewed proxy configuration remain pre-deployment work in
EPIC-08 for multi-instance Cloud Run operation.

## Frontend flow

`PasswordRecoveryClient` continues to expose:

- `request(email: string): Promise<void>`;
- `verifyCode(oobCode: string): Promise<void>`;
- `confirm(oobCode: string, newPassword: string): Promise<void>`.

All three methods call MoneyHub backend endpoints. The frontend no longer uses
Firebase `verifyPasswordResetCode` or `confirmPasswordReset` directly. The
verified email remains internal to the backend.

`/forgot-password` remains in the anonymous route group and displays a neutral
acceptance message. `/reset-password` remains outside authenticated and
anonymous layouts. It accepts only `mode=resetPassword` with a non-empty
`oobCode`, verifies through the backend before showing password inputs, checks
required and matching passwords locally, and submits confirmation through the
backend. Successful confirmation signs out any existing local Firebase session
and offers a link to login.

## Configuration removal and replacement

The implementation removes the Resend package, adapter, message templates,
idempotency key, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`. Runtime startup no
longer requires Resend configuration. It requires `APP_URL` and
`FIREBASE_WEB_API_KEY` for the recovery adapter, alongside existing Firebase
Admin configuration used by other backend authentication features.

Firebase Console owns the recovery email subject, body, sender presentation,
and localization. Email verification continues to use Firebase delivery.
GraphQL and the database remain unchanged.

## Testing and acceptance

Backend tests cover normalized initiation payloads, source IP forwarding,
neutral known/unknown/error responses, invalid input, endpoint rate limits,
provider deadlines, safe error mapping, password-policy errors, and audit data
that cannot leak secrets. Frontend tests cover all three backend client calls,
neutral request feedback, action-code states, local password checks, safe weak
password feedback, operation disabling, session cleanup, and navigation.

Repository gates remain `npm test`, `npm run lint`, `npm run typecheck`,
`npm run build`, and Expo export for Web, iOS, and Android.

`TASK-019` and `EPIC-02` may be marked `Done` only after a real Firebase smoke
confirms email delivery and content, the MoneyHub action URL, successful password
change, action-code non-reuse, old-password rejection, new-password login, and
an indistinguishable request for an unknown address.
