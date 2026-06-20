# Security Architecture

## Authentication

- Access tokens use JWT with short expiration.
- Refresh tokens are stored server-side as hashes.
- Passwords are hashed with bcrypt.
- Sessions can be revoked individually.

## Authorization

- Every user-owned query must include authenticated `user_id`.
- Repositories must not expose cross-user read methods.
- Administrative capabilities are out of scope for the first release.

## Web Security

- Rate limiting on authentication and AI endpoints.
- CORS restricted by environment.
- Helmet security headers in backend.
- Input validation for every write endpoint.
- Sanitized output and React escaping in frontend.
- CSRF risk reviewed for any cookie-based auth decision.

## Audit

- Log authentication events, profile changes, financial mutations, and AI requests.
- Audit logs must avoid storing raw secrets or full tokens.
