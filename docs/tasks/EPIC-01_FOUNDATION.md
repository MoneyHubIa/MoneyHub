# EPIC-01 - Foundation

## Status
Pending

## Feature
Project foundation migration.

## Objective
Implement a TypeScript Node.js GraphQL backend and a TypeScript React Native +
Expo app foundation before product features continue.

## Tasks

### TASK-001 - Create product documentation

## Status
Done

Product vision, business rules, and user stories exist in `docs/product`.

### TASK-005 - Scaffold monorepo foundation

## Status
Done

The initial workspace exists. The migration to the new stack is tracked by pending tasks below.

### TASK-006 - Plan GraphQL backend foundation migration

## Status
Done

## Objective
Replace the REST backend foundation plan with Node.js, Express, Apollo Server GraphQL, Firebase Admin token verification, and Cloud SQL PostgreSQL access.

## Scope
Plan app factory, server entrypoint, request ID middleware, security middleware, operational health, GraphQL schema, resolvers, and authenticated context.

## Out of Scope
Executing code changes, database migrations, full authentication screens, and financial domain operations.

## Acceptance Criteria

- Backend contract is planned around `POST /graphql`.
- Operational health remains planned outside domain GraphQL.
- Authenticated operations require Firebase ID token verification.
- User-owned data is scoped by Firebase UID.

## Completion Review

The target backend contract, operational health boundary, authentication boundary,
and user-ownership rule are documented in the architecture and API specifications.
This status covers planning only; migration implementation remains outside this task.

### TASK-007 - Plan Expo app foundation migration

## Status
Done

## Objective
Replace the React/Vite frontend plan with a React Native + Expo app for iOS, Android, and Web.

## Scope
Plan Expo Router, app shell, Firebase Auth client setup, Firebase Analytics adapter, and GraphQL client boundary.

## Out of Scope
Executing code changes, native build setup, authentication screens, data loading, and real dashboards.

## Acceptance Criteria

- App foundation targets iOS, Android, and Web.
- Expo Router is the planned navigation foundation.
- Firebase public config uses `EXPO_PUBLIC_*` variables.
- Analytics has a web and native implementation strategy.

## Completion Review

The cross-platform target, navigation foundation, public configuration boundary,
and platform-specific Analytics strategy are documented. This status covers
planning only; migration implementation remains outside this task.

### TASK-048 - Implement TypeScript GraphQL backend foundation

## Status
Pending

## Objective
Replace the REST-only JavaScript scaffold with a strict TypeScript Express and
Apollo Server GraphQL foundation backed by Prisma and PostgreSQL.

## Scope
- Migrate the backend to strict TypeScript and Node.js 22.
- Expose `GET /health` and `POST /graphql`.
- Implement GraphQL `health` and authenticated `me` queries.
- Build Firebase Admin authentication context with public-query support.
- Add Prisma models and an initial migration for `users` and `profiles`.
- Preserve request IDs, security middleware, rate limiting, and graceful shutdown.

## Out of Scope
- Creating users or profiles through GraphQL.
- Financial domain operations.
- Production Cloud SQL or Firebase provisioning.

## Acceptance Criteria
- `/health` succeeds and `/api/v1/health` returns `404`.
- GraphQL health succeeds without authentication.
- `me` returns `null` anonymously and Firebase identity for a valid token.
- Invalid bearer tokens return the stable `UNAUTHENTICATED` code.
- Prisma validates and its initial migration applies to disposable PostgreSQL.
- Backend tests, lint, typecheck, and build pass.

### TASK-049 - Implement TypeScript Expo app foundation

## Status
Pending

## Objective
Replace the Vite app with a strict TypeScript Expo Router app for iOS, Android,
and Web while preserving the MoneyHub shell.

## Scope
- Convert `apps/frontend` in place to Expo SDK 57 and Expo Router.
- Port the current shell to React Native components and responsive styles.
- Add Apollo Client and Firebase configuration boundaries.
- Implement Web and native Analytics adapters with a no-op fallback.
- Provide platform bundling, component tests, lint, typecheck, and build scripts.

## Out of Scope
- Production Firebase project setup.
- Financial data screens and real dashboard queries.
- Production EAS builds and store submission.

## Acceptance Criteria
- Expo Router renders the MoneyHub shell on authenticated app routes.
- The app bundles for Web, iOS, and Android.
- Apollo Client reads the configured GraphQL endpoint.
- Analytics failures never block app workflows.
- App tests, lint, typecheck, and build pass.

## Completion Dependencies

EPIC-01 can be marked Done only after `TASK-048`, `TASK-049`, and the Firebase
registration, login, and session work in `TASK-009` are implemented and verified.
