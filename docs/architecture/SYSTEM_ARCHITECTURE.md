# System Architecture

## Overview

MoneyHub uses a JavaScript monorepo with separate backend and frontend applications. The backend owns business rules, authorization, validation, AI context assembly, and database access. The frontend consumes versioned REST APIs and does not duplicate critical business rules.

## Backend Layers

```txt
routes -> controllers -> services -> repositories -> database
```

- **Routes:** bind HTTP paths to controllers and middlewares.
- **Controllers:** parse request context and delegate to services.
- **Services:** own business rules and orchestration.
- **Repositories:** isolate persistence and Supabase/PostgreSQL access.
- **Database:** PostgreSQL managed by Supabase.

## Frontend Layers

```txt
pages -> templates -> organisms -> molecules -> atoms
services -> hooks -> state
```

- Pages define route-level composition.
- Components follow Atomic Design.
- Services isolate API calls.
- Hooks contain reusable UI behavior and data loading.

## Cross-Cutting Concerns

- Environment variables for all secrets and deployment-specific values.
- Structured error handling in backend.
- Request ID in logs and API errors.
- Security controls applied before feature development.
- Tests required for critical paths.
