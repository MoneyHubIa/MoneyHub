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

Fresh operational gate evidence for September 15, 2026:

- Backend: 262 tests; coverage gate passes at 80% statements/lines, 80.56% branches, and 88.83% functions.
- Frontend: 253 tests; coverage gate passes at 88.12% statements, 80.06% branches, 83.72% functions, and 88.91% lines.
- Exported Web smoke/accessibility subset: 7 Playwright tests pass in Chromium.
- Lint: pass.
- Typecheck: pass.
- Backend build and Expo export for Web, iOS, and Android pass.

## Transactional Email Smoke

Password recovery real Firebase smoke confirmed delivery to a known account,
Firebase template/content/MoneyHub action URL, password change, action-code
non-reuse, old/new password login checks, and a neutral request for an unknown
address.

## E2E

The isolated E2E harness provides PostgreSQL, Firebase Auth Emulator, backend, exported Web app, Playwright, and axe-core. Implemented flows include:

- Registration.
- Login.
- Income creation.
- Expense creation.
- Accounts payable creation.
- Goal creation.
- AI assistant query.

The complete harness is `npm run test:e2e`. It requires Docker, Java 21, Node 22, and Playwright Chromium. Native flows use `.maestro/`; Web execution does not count as Android/iOS evidence.
