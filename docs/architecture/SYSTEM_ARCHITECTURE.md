# System Architecture

## Status

This document defines the approved target architecture. The repository currently
uses a Node.js backend with GraphQL, public authentication REST endpoints, and a
universal Expo application.

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
- **Firebase Auth REST adapter:** isolates backend password-recovery requests,
  action-code verification, and password confirmation. Firebase sends recovery
  email from its configured template.

## Frontend Layers

```txt
expo-router routes -> screens -> components
services -> hooks -> state
```

- Expo Router files define route-level composition.
- Screens compose reusable React Native components.
- Services isolate GraphQL, Firebase Auth, Firebase Analytics, and backend
  password-recovery calls.
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
- Public password-recovery routes use 16 KiB body limits, 10-second Firebase
  deadlines, secret-free audit events, and in-process sliding-window IP limits:
  5 request operations and 10 verify or confirm operations per 15 minutes.
- A shared rate-limit store and reviewed trusted-proxy configuration remain
  required before multi-instance Cloud Run deployment; this work stays in
  EPIC-08.
- Security controls applied before feature development.
- Tests required for critical paths.
