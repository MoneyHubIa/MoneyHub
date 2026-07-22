# GraphQL Backend Foundation Specification

## Status

Approved for `TASK-048`.

## Runtime and Transport

- Node.js 22.13 or newer in the Node.js 22 LTS line.
- Strict TypeScript ESM compiled to `dist`.
- Express 4 hosts Apollo Server 5 through `@as-integrations/express4`.
- `GET /health` is the only operational health route.
- `POST /graphql` is the only domain API route.

## GraphQL Contract

```graphql
type Health {
  status: String!
  service: String!
  version: String!
}

type AuthUser {
  id: ID!
  email: String!
  emailVerified: Boolean!
}

type Query {
  health: Health!
  me: AuthUser
}
```

Anonymous requests receive a null authenticated context and can execute public
queries. A supplied bearer token must verify through Firebase Admin. Invalid,
expired, revoked, or malformed credentials return `UNAUTHENTICATED` and never
reach a resolver.

## Persistence

Prisma 7 owns the PostgreSQL connection. The initial migration creates `users`
and `profiles` with the uniqueness and relationship constraints defined by the
authentication specification. Authentication context may load and synchronize
existing identity projections, but only `bootstrapProfile` in `TASK-017` may
create them.

## Verification

Integration tests use Supertest against the Express app. Firebase tests use the
Auth Emulator. Migration acceptance uses a disposable external PostgreSQL URL.
No test contacts production Firebase or GCP.
