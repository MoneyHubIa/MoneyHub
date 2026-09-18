# Roadmap

## Phase 1 - Foundation

- Documentation.
- Monorepo.
- GraphQL backend and Expo app base.
- Testing setup.

## Phase 2 - Authentication

- Register, login, token verification, logout.
- Password recovery and e-mail verification.
- Profile control.

## Phase 3 - Financial Core

- Categories.
- Cost centers.
- Income.
- Expenses.
- Accounts payable and receivable.

## Phase 4 - Planning and Dashboards

- Goals.
- Recurring transactions.
- Cash-flow KPIs.
- Comparative charts.

## Phase 5 - Agenda and AI

- Calendar events.
- Notifications.
- AI assistant with safe context.

## Phase 6 - Hardening and Deploy

- E2E tests.
- Security review.
- GCP and Firebase deployment documentation.
- Shared password-recovery rate limiting and reviewed trusted-proxy/X-Forwarded-
  For behavior remain pre-deployment work for multi-instance Cloud Run
  deployment; the current in-process limiter is not suitable there (EPIC-08).
