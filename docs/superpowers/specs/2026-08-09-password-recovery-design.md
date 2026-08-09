# Password Recovery Design

**Date:** 2026-08-09  
**Status:** Approved for implementation

## Context

MoneyHub delegates passwords and sessions to Firebase Authentication. Password
recovery needs a branded MoneyHub web experience and transactional delivery
through Resend without revealing whether an account exists.

## Public contract

`POST /auth/password-recovery` accepts `{ "email": "user@example.com" }`.
Valid requests always return HTTP `202` with the envelope
`{ success: true, data: { accepted: true }, error: null, meta: { requestId } }`,
including unknown accounts and Firebase or Resend failures. Invalid email input
returns `400 INVALID_EMAIL`. The route permits five requests per source IP in a
rolling 15-minute window and returns `429 RATE_LIMITED` after that limit.

## Backend flow

The service normalizes the email, hashes it with SHA-256 for audit correlation,
and asks Firebase Admin for a password-reset link using `${APP_URL}/login` as
the continue URL and `handleCodeInApp: false`. Firebase's configured action URL
must point to `${APP_URL}/reset-password`.

For known users, one HTML-and-text email is sent through Resend with
`password-recovery/<requestId>` as the idempotency key. Firebase
`auth/user-not-found` is treated as an accepted request without delivery. Other
Firebase and Resend errors are recorded internally but retain the same public
response. Each provider call has a 10-second application deadline so a stalled
dependency is also reduced to the canonical response and a safe timeout audit.

Audit events contain only `requestId`, internal status, the SHA-256 email hash,
and a sanitized provider error code when available. Raw email addresses,
passwords, `oobCode` values, tokens, and complete action links must never be
logged. Startup validates `APP_URL`, `RESEND_API_KEY`, and
`RESEND_FROM_EMAIL`.

## Frontend flow

`PasswordRecoveryClient` exposes:

- `request(email: string): Promise<void>` for the backend request;
- `verifyCode(oobCode: string): Promise<string>` for Firebase validation;
- `confirm(oobCode: string, newPassword: string): Promise<void>` for Firebase
  confirmation.

`/forgot-password` belongs to the anonymous route group and always displays a
neutral acceptance message after a valid submission. Login links to this page.

`/reset-password` sits outside authenticated and anonymous layouts. It accepts
only `mode=resetPassword` with a non-empty `oobCode`, verifies the code before
showing password inputs, validates required and matching passwords locally, and
lets Firebase enforce password strength. Successful confirmation signs out any
existing session and offers a link to login. Missing, invalid, expired, or used
codes offer a new recovery request.

## Console and environment setup

- Set the Firebase Authentication password-reset action URL to
  `${APP_URL}/reset-password`.
- Add the `APP_URL` domain to Firebase authorized domains.
- Keep `handleCodeInApp: false`; native deep linking is outside this scope.
- Verify the sender domain in Resend and configure `RESEND_API_KEY` and
  `RESEND_FROM_EMAIL`.

Email verification continues to use Firebase delivery. GraphQL and the database
are unchanged.

## Acceptance and closure

Automated acceptance covers public-response parity, validation, rate limiting,
idempotency, safe audit fields, frontend route states, accessible controls, and
Firebase error handling. Repository gates are tests, lint, typecheck, build,
and Expo exports for Web, iOS, and Android.

`TASK-019` and `EPIC-02` may be marked `Done` only after a real smoke verifies
Resend delivery, sender and content, the MoneyHub URL, successful password
change, action-code non-reuse, old-password rejection, new-password login, and
an indistinguishable request for an unknown address.
