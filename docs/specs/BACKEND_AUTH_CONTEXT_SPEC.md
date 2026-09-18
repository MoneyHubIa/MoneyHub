# Backend Authentication Context Specification

## Status

Implemented and verified

## Runtime contract

The HTTP boundary reads `Authorization: Bearer <ID_TOKEN>`. A missing header produces an anonymous context so public operations remain available. Invalid schemes, empty Bearer values, rejected tokens, and expired tokens are rejected before identity persistence is accessed.

```ts
type AuthContext = Readonly<{
  uid: string;             // Firebase UID
  email: string;
  emailVerified: boolean;
  userId: string | null;   // Internal MoneyHub user ID
}>;

type GraphQLContext = Readonly<{
  requestId: string;
  auth: AuthContext | null;
}>;
```

`uid` and `userId` are different identifiers. Financial repositories receive the internal `auth.userId`; clients cannot submit an identity argument to replace it. Each request receives a new frozen authentication value, preventing identity leakage between requests.

## Identity synchronization

Firebase Admin verification produces trusted token claims and may enrich them through `getUser`. If that lookup is unavailable, verified claims are the documented fallback. Identity synchronization may resolve the internal user ID. A missing profile leaves `userId` null until bootstrap.

Disabled-user and token-revocation guarantees remain responsibilities of the configured Firebase Admin verification policy. The fallback is not an independent revocation check.

## GraphQL errors

- Protected operation without identity: `errors[].extensions.code = UNAUTHENTICATED`.
- Authenticated user without verified email where required: `EMAIL_NOT_VERIFIED`.
- Ownership violation: `FORBIDDEN` or the domain not-found contract, without revealing another tenant's data.

Resolver errors normally use GraphQL HTTP 200 with an `errors` array. Transport-level malformed or rejected credentials may use HTTP 401. Consumers inspect the GraphQL code instead of assuming every authorization failure changes HTTP status.

## Verified guarantees

- Missing, malformed, empty, rejected, and accepted authorization paths are covered.
- A rejected token does not call `getUser` or identity persistence.
- Claim normalization, missing email, repository failure, fallback claims, frozen values, and consecutive identities are covered.
- Public health/identity queries and anonymous protected queries are covered through HTTP integration.
- Financial ownership comes only from `context.auth`.
