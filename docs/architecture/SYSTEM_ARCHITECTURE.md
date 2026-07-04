# System Architecture

## Status

This document defines the approved target architecture. The repository currently
uses the operational REST and React/Vite scaffold while the GraphQL and Expo
migration remains pending.

## Overview

MoneyHub uses a JavaScript monorepo with a Node.js backend and a universal Expo app. The backend owns business rules, authorization, validation, AI context assembly, email orchestration, and database access. The app runs on iOS, Android, and Web and consumes a GraphQL contract without duplicating critical business rules.

## Backend Layers

```txt
graphql schema -> resolvers -> services -> repositories -> database
```

- **GraphQL schema:** defines public queries, mutations, types, and auth boundaries.
- **Resolvers:** parse request context and delegate to services.
- **Services:** own business rules and orchestration.
- **Repositories:** isolate persistence and Cloud SQL PostgreSQL access.
- **Database:** PostgreSQL managed by Google Cloud SQL.
- **Email adapter:** isolates Resend transactional email calls.

## Frontend Layers

```txt
expo-router routes -> screens -> components
services -> hooks -> state
```

- Expo Router files define route-level composition.
- Screens compose reusable React Native components.
- Services isolate GraphQL, Firebase Auth, and Firebase Analytics calls.
- Hooks contain reusable UI behavior and data loading.

## Analytics Strategy

- Application code emits analytics events through one internal adapter contract.
- Web uses a Firebase Analytics web adapter and checks runtime support before initialization.
- iOS and Android use a native Firebase Analytics adapter through an Expo-compatible development build.
- Unsupported environments use a no-op adapter; analytics failures never block financial workflows.
- Unit tests mock the adapter and do not contact Firebase.

## Cross-Cutting Concerns

- Environment variables for all secrets and deployment-specific values.
- Structured error handling in backend.
- Request ID in logs and API errors.
- Firebase ID token verification for authenticated GraphQL operations.
- Security controls applied before feature development.
- Tests required for critical paths.
