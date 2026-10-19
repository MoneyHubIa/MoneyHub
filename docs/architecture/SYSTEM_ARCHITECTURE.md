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
- **Repositories:** isolate persistence and Supabase PostgreSQL access.
- **Database:** PostgreSQL managed by Supabase.
- **Firebase Auth REST adapter:** isolates backend password-recovery requests,
  action-code verification, and password confirmation, applies 10-second
  abortable provider deadlines, and exposes only allowlisted provider codes to
  recovery audit events. Firebase sends recovery email from its configured
  template.

## Frontend Layers

```txt
expo-router routes -> screens -> components
services -> hooks -> state
```

- Expo Router files define route-level composition.
- Screens compose reusable React Native components.
- Services isolate GraphQL, Firebase Auth, Firebase Analytics, and backend
  password-recovery calls.
- The reset-password flow validates action codes through the backend before it
  shows password fields and signs out the local session after a successful
  confirmation.
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
- A sanitized request ID is accepted from `x-request-id` only when it matches
  `[A-Za-z0-9._-]{1,128}`; otherwise the backend generates a UUID and reuses it
  in response metadata, HTTP logs, GraphQL context, and recovery audits.
- Firebase ID token verification for authenticated GraphQL operations.
- Public password-recovery routes use 16 KiB body limits, 10-second Firebase
  deadlines, secret-free audit events, and three separate in-process
  sliding-window IP-limit buckets per rolling 15 minutes: 5 initiation
  requests, 10 verification requests, and 10 confirmation requests. Stable
  public recovery codes are `INVALID_OR_EXPIRED_ACTION_CODE`,
  `INVALID_PASSWORD`, `WEAK_PASSWORD`, `RATE_LIMITED`, and
  `RECOVERY_UNAVAILABLE`.
- A future shared rate-limit store must preserve those separate
  initiation/verify/confirm buckets, and reviewed trusted-proxy configuration
  remains required before intentionally scaling the Vercel backend across
  multiple instances. This is a future scale-hardening item.
- Security controls applied before feature development.
- Tests required for critical paths.
