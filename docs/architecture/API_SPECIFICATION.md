# API Specification

## GraphQL Endpoint

Domain operations use:

```txt
POST /graphql
```

Operational health uses:

```txt
GET /health
```

Public password recovery uses:

```txt
POST /auth/password-recovery
POST /auth/password-recovery/verify
POST /auth/password-recovery/confirm
```

- `POST /auth/password-recovery` accepts `{ "email": "user@example.com" }`.
  Valid requests return HTTP `202` with `data.accepted: true` for known and
  unknown accounts alike. Invalid email returns `400 INVALID_EMAIL`; more than
  five requests per IP in 15 minutes returns `429 RATE_LIMITED`.
- `POST /auth/password-recovery/verify` accepts `{ "oobCode": "..." }`. Valid
  codes return HTTP `200` with `data.valid: true`. Missing, malformed, expired,
  or used codes return `400 INVALID_OR_EXPIRED_ACTION_CODE`; provider outages
  return `503 RECOVERY_UNAVAILABLE`.
- `POST /auth/password-recovery/confirm` accepts
  `{ "oobCode": "...", "newPassword": "..." }`. Success returns HTTP `200`
  with `data.confirmed: true`. Invalid or reused codes return
  `400 INVALID_OR_EXPIRED_ACTION_CODE`; Firebase password-policy rejection
  returns `400 WEAK_PASSWORD`; provider outages return
  `503 RECOVERY_UNAVAILABLE`.

Both `verify` and `confirm` allow ten requests per IP in 15 minutes and return
`429 RATE_LIMITED` after that limit.

## Initial Schema

```graphql
type Health {
  status: String!
  service: String!
  version: String!
}

type AuthUser {
  id: ID!
  email: String
  emailVerified: Boolean!
}

type Query {
  health: Health!
  me: AuthUser
}
```

## Planned Operations

- Authentication lifecycle is handled by Firebase Auth on the client.
- Backend authenticated operations require `Authorization: Bearer <Firebase ID token>`.
- Profile, categories, cost centers, incomes, expenses, dashboard summary, agenda, and AI assistant operations will be added as GraphQL queries and mutations.
- Password recovery uses backend-owned Firebase Auth REST endpoints for
  request, action-code verification, and password confirmation. Email
  verification continues to use Firebase delivery.

## API Rules

- Authenticated operations require a valid Firebase ID token.
- User-owned resources must be filtered by Firebase UID.
- Resolvers must not contain business rules.
- Validation must run before service execution.
- GraphQL errors must use stable extension codes.
