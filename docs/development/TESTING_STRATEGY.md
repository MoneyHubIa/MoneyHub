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

## E2E

E2E will cover iOS, Android, and Web smoke flows after the Expo foundation is stable:

- Registration.
- Login.
- Income creation.
- Expense creation.
- Accounts payable creation.
- Goal creation.
- AI assistant query.
