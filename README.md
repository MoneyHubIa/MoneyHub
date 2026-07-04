# MoneyHub

MoneyHub is a universal financial management SaaS for personal and business users. It combines financial records, planning, dashboards, agenda workflows, and a privacy-aware AI financial assistant across iOS, Android, and Web.

## Current Stage

The project is in foundation migration planning. The GraphQL and Expo migration
plans are complete, but their implementation has not started. Documentation and
task files drive all implementation through Spec Driven Development.

## Monorepo

```txt
apps/
  backend/
  frontend/
docs/
  product/
  architecture/
  development/
  ai/
  planning/
  specs/
  tasks/
tests/
scripts/
```

## Commands

```bash
npm install
npm test
npm run lint
npm run dev:backend
npm run dev:frontend
```

## Current Foundation

- App: React + Vite for Web.
- API: Node.js + Express with a REST operational health endpoint.
- Status: operational scaffold retained until the approved migration is implemented.

## Approved Target Foundation

- App: React Native + Expo + Expo Router for iOS, Android, and Web.
- API: Node.js + Express + Apollo Server GraphQL.
- Identity: Firebase Auth, verified in the backend with Firebase Admin.
- Analytics: Firebase Analytics.
- Infrastructure: Google Cloud Platform with Cloud Run, Cloud SQL for PostgreSQL, Secret Manager, and Cloud Logging.
- Email: Resend for transactional messages.

## Development Rule

No feature is implemented without a prior spec, task file, acceptance criteria, and tests.
