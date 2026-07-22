# EPIC-01 Foundation Implementation Plan

## Goal

Complete EPIC-01 with a TypeScript GraphQL and Prisma backend, a universal Expo
app, Firebase registration/login/session, and resilient Analytics adapters.

## Execution Order

1. Register `TASK-048` and `TASK-049` and approve their specifications.
2. Implement `TASK-048` with tests first.
3. Implement `TASK-049` with tests first.
4. Implement the `TASK-009` authentication flows with tests first.
5. Verify Firebase Auth Emulator and disposable PostgreSQL integration.
6. Update task statuses and mark EPIC-01 Done only after all acceptance commands
   pass.

## Fixed Decisions

- Node.js 22.13 LTS, TypeScript strict, Expo SDK 57, Apollo Server 5, Prisma 7.
- Express 4 remains the HTTP framework.
- `GET /health` replaces `/api/v1/health` without an alias.
- `apps/frontend` is converted in place.
- Apollo Client is the app GraphQL client.
- Prisma migration includes only `users` and `profiles`.
- Firebase Auth Emulator validates registration, login, and session behavior.
- PostgreSQL is supplied externally; the repository does not add Docker.
