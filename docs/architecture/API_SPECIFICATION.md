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
```

It accepts `{ "email": "user@example.com" }`. Valid requests return HTTP `202`
with `data.accepted: true` for known and unknown accounts alike. Invalid email
returns `400 INVALID_EMAIL`; more than five requests per IP in 15 minutes
returns `429 RATE_LIMITED`.

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
- Password recovery uses Firebase Admin generated links delivered through
  Resend. Email verification continues to use Firebase delivery.

## API Rules

- Authenticated operations require a valid Firebase ID token.
- User-owned resources must be filtered by Firebase UID.
- Resolvers must not contain business rules.
- Validation must run before service execution.
- GraphQL errors must use stable extension codes.
