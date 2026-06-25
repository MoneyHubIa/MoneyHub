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
- Password recovery and verification emails use Firebase Admin generated links delivered through Resend when custom email templates are required.

## API Rules

- Authenticated operations require a valid Firebase ID token.
- User-owned resources must be filtered by Firebase UID.
- Resolvers must not contain business rules.
- Validation must run before service execution.
- GraphQL errors must use stable extension codes.
