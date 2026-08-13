# Testing Strategy

## Coverage Target

Minimum coverage target is 80% for critical application code.

## Backend

- Unit tests: services, validators, utilities.
- Integration tests: GraphQL schema, resolvers, repositories, auth context, and operational health.
- Security tests: authorization boundaries and validation failures.

## App

- Component tests with React Native Testing Library.
- Hook and service tests for reusable behavior.
- Firebase Auth, Firebase Analytics, and GraphQL client adapters must use mocks in unit tests.
- Accessibility checks for critical UI on mobile and web.
- Password recovery service and component tests cover neutral responses,
  rate limiting, audit redaction, action-code states, password validation, and
  session cleanup.
- `npm run test:auth-emulator -w apps/frontend` runs the real Firebase client
  flow against the local Auth Emulator and requires Java 21.
- `npm run build -w apps/frontend` exports Web, iOS, and Android bundles.

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
