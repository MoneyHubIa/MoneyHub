# Testing Strategy

## Coverage Target

Minimum coverage target is 80% for critical application code.

## Backend

- Unit tests: services, validators, utilities.
- Integration tests: routes, controllers, repositories, auth middlewares.
- Security tests: authorization boundaries and validation failures.

## Frontend

- Component tests with React Testing Library.
- Hook and service tests for reusable behavior.
- Accessibility checks for critical UI.

## E2E

Cypress will cover:

- Registration.
- Login.
- Income creation.
- Expense creation.
- Accounts payable creation.
- Goal creation.
- AI assistant query.
