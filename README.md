# MoneyHub

MoneyHub is a universal financial management SaaS for personal and business users. It combines financial records, planning, dashboards, agenda workflows, and a privacy-aware AI financial assistant across iOS, Android, and Web.

## Current Stage

The foundation migration is complete. The project is now in the authentication
phase: Firebase registration, login, session handling, profile bootstrap,
logout, and profile management are implemented; password recovery remains.

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

- App: React Native + Expo Router for iOS, Android, and Web.
- API: Node.js + Express + Apollo Server GraphQL, with `GET /health` retained
  as an operational endpoint.
- Identity persistence: Prisma/PostgreSQL `users` and `profiles` schema is
  baselined and up to date.

## Approved Target Foundation

- App: React Native + Expo + Expo Router for iOS, Android, and Web.
- API: Node.js + Express + Apollo Server GraphQL.
- Identity: Firebase Auth, verified in the backend with Firebase Admin.
- Analytics: Firebase Analytics.
- Infrastructure: Google Cloud Platform with Cloud Run, Cloud SQL for PostgreSQL, Secret Manager, and Cloud Logging.
- Email: Resend for transactional messages.

## Development Rule

No feature is implemented without a prior spec, task file, acceptance criteria, and tests.
