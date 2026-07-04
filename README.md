# MoneyHub

MoneyHub is a universal financial management SaaS for personal and business users. It combines financial records, planning, dashboards, agenda workflows, and a privacy-aware AI financial assistant across iOS, Android, and Web.

## Current Stage

The project is in foundation setup. Documentation and task files drive all implementation through Spec Driven Development.

## Monorepo

```txt
apps/
  backend/
  app/
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
npm run dev:app
```

## Foundation Stack

- App: React Native + Expo + Expo Router for iOS, Android, and Web.
- API: Node.js + Express + Apollo Server GraphQL.
- Identity: Firebase Auth, verified in the backend with Firebase Admin.
- Analytics: Firebase Analytics.
- Infrastructure: Google Cloud Platform with Cloud Run, Cloud SQL for PostgreSQL, Secret Manager, and Cloud Logging.
- Email: Resend for transactional messages.

## Development Rule

No feature is implemented without a prior spec, task file, acceptance criteria, and tests.
