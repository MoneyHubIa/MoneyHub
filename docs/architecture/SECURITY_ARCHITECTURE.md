# Security Architecture

## Authentication

- Firebase Auth is the source of identity for email/password and future provider sign-in.
- The app obtains Firebase ID tokens and sends them to the backend as bearer tokens.
- The backend verifies ID tokens with Firebase Admin before resolving authenticated GraphQL fields.
- Password storage, refresh token rotation, and session revocation are delegated to Firebase Auth.
- Password recovery request, action-code verification, and password
  confirmation all pass through backend-owned Firebase Auth REST endpoints.
- Verification email and password-recovery delivery remain managed by Firebase.
- Firebase Email Enumeration Protection remains enabled for recovery requests.

## Authorization

- Every user-owned query must include the authenticated Firebase UID.
- Repositories must not expose cross-user read methods.
- Administrative capabilities are out of scope for the first release.

## Web Security

- Rate limiting on sensitive GraphQL operations, email triggers, and AI endpoints.
- CORS restricted by environment.
- Helmet security headers in backend.
- Input validation for every write endpoint.
- Sanitized output and React Native text rendering in the app.
- CSRF risk reviewed for any cookie-based auth decision.

## Audit

- Log authentication-adjacent events, profile changes, financial mutations, email triggers, and AI requests.
- Audit logs must avoid storing raw secrets or full tokens.
- Password recovery audit stores request ID, internal status, and SHA-256 of the
  normalized email; it never stores raw email, password, `oobCode`, token, or a
  complete action link.
