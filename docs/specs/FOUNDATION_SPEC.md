# Foundation Specification

## Status

This specification defines the approved target foundation. The current REST and
React/Vite scaffold remains operational. EPIC-01 stays Pending until the GraphQL
backend and Expo app acceptance criteria below are implemented and verified.

## Objective

Create the MoneyHub monorepo foundation with strict TypeScript, a Node.js GraphQL
backend, a universal Expo app, Firebase integration, PostgreSQL identity storage,
and automated tests.

## Functional Scope

- Provide project documentation.
- Provide task index and epic task files.
- Provide backend health and GraphQL foundation.
- Provide Expo app shell foundation for iOS, Android, and Web.
- Provide Firebase Auth and Analytics configuration adapters.
- Provide Firebase email/password registration, login, and session restoration.
- Provide Prisma models and an initial migration for `users` and `profiles`.
- Provide tests proving the foundations work.

## Out of Scope

- Logout, password recovery, profile bootstrap, and production Firebase setup.
- Financial, agenda, dashboard, and AI database migrations.
- Production deployment.
- AI provider integration.

## Acceptance Criteria

- Required documentation files exist.
- Root monorepo package exists.
- Backend package has test command.
- App package has test command.
- Backend exposes operational health and GraphQL health contracts.
- App renders the MoneyHub shell through Expo-compatible components.
- Firebase Auth supports registration, login, and restored sessions through the
  local Auth Emulator test flow.
- Prisma validates and the identity migration applies to disposable PostgreSQL.
- TypeScript typechecks in every workspace.
- Expo bundles for Web, iOS, and Android.
- Tests can be executed from the root command.
