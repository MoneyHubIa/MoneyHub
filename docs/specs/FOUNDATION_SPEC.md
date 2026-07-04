# Foundation Specification

## Status

This specification defines the approved target foundation. The current REST and
React/Vite scaffold remains operational. EPIC-01 stays Pending until the GraphQL
backend and Expo app acceptance criteria below are implemented and verified.

## Objective

Create the initial MoneyHub monorepo with required documentation, task tracking, Node.js GraphQL backend foundation, Expo app foundation, Firebase integration points, and test setup.

## Functional Scope

- Provide project documentation.
- Provide task index and epic task files.
- Provide backend health and GraphQL foundation.
- Provide Expo app shell foundation for iOS, Android, and Web.
- Provide Firebase Auth and Analytics configuration adapters.
- Provide tests proving the foundations work.

## Out of Scope

- Full authentication screens and production Firebase project setup.
- Database migrations.
- Production deployment.
- AI provider integration.

## Acceptance Criteria

- Required documentation files exist.
- Root monorepo package exists.
- Backend package has test command.
- App package has test command.
- Backend exposes operational health and GraphQL health contracts.
- App renders the MoneyHub shell through Expo-compatible components.
- Tests can be executed from the root command.
