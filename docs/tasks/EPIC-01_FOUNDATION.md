# EPIC-01 - Foundation

## Status
Pending

## Feature
Project foundation migration.

## Objective
Plan the migration from the current foundation to a Node.js GraphQL backend and a React Native + Expo app foundation before product features continue.

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
Pending

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

### TASK-007 - Plan Expo app foundation migration

## Status
Pending

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
