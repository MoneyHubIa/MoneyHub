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
- Vercel and Firebase deployment documentation.
- Production deployment of frontend and backend, database migrations, logs, and
  alerts.
- Reassess shared password-recovery rate limiting and trusted-proxy/
  `X-Forwarded-For` behavior before intentional horizontal scaling; the current
  in-process limiter is not suitable for multiple instances.
