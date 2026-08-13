# Testing Strategy

## Coverage Target

Minimum coverage target is 80% for critical application code.

## Backend

- Unit tests: services, validators, utilities.
- Integration tests: GraphQL schema, resolvers, repositories, auth context, and operational health.
- Security tests: authorization boundaries and validation failures.
- Password recovery backend tests cover realistic Firebase detailed errors,
  action-code input mapping, missing recovery-service wiring, malicious
  `x-request-id` input, and sliding-window limiter boundary behavior.

## App

- Component tests with React Native Testing Library.
- Hook and service tests for reusable behavior.
- Firebase Auth, Firebase Analytics, and GraphQL client adapters must use mocks in unit tests.
- Accessibility checks for critical UI on mobile and web.
- Password recovery service and component tests cover neutral responses,
  backend-only frontend calls, rate limiting, audit redaction, action-code
  states, temporary verification retry behavior, password validation, and
  session cleanup after successful confirmation.
- `npm run test:auth-emulator -w apps/frontend` runs the real Firebase client
  flow against the local Auth Emulator and requires Java 21.
- `npm run build -w apps/frontend` exports Web, iOS, and Android bundles.

## Current Automated Gates

Fresh operational gate evidence for the August 13, 2026 documentation refresh:

- Backend: 72 tests.
- Frontend: 104 tests.
- Monorepo: 176 tests.
- Lint: pass.
- Typecheck: pass.
- Build: pass.
- Expo exports: Web, iOS, and Android pass.

## Transactional Email Smoke

Password recovery closure additionally requires a real Firebase smoke:
delivery to a known account, Firebase template/content/MoneyHub action URL
inspection, password change and action-code non-reuse, old/new password login
checks, and a neutral request for an unknown address.

## E2E

E2E will cover iOS, Android, and Web smoke flows after the Expo foundation is stable:

- Registration.
- Login.
- Income creation.
- Expense creation.
- Accounts payable creation.
- Goal creation.
- AI assistant query.
