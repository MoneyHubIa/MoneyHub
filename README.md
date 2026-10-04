# MoneyHub

MoneyHub is a universal financial management SaaS for personal and business users. It combines financial records, planning, dashboards, agenda workflows, and a privacy-aware AI financial assistant across iOS, Android, and Web.

## Current Stage

The foundation migration is complete. Firebase registration, login, session
handling, profile bootstrap, logout, profile management, email verification,
and password recovery are implemented. `TASK-019` and `EPIC-02` are complete.
The frontend and backend are deployed on Vercel; production migrations,
`/health`, authenticated GraphQL, password recovery, logs, and alerts have
been verified.

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

Define the public application origin once in the repository root `.env`:

```dotenv
APP_URL=http://localhost:3000
FIREBASE_WEB_API_KEY=your_firebase_web_api_key
```

Copy `.env.example` for the complete local configuration shape. The backend
will refuse to start without `APP_URL` and `FIREBASE_WEB_API_KEY`. Firebase
Authentication manages password-recovery email delivery. In Firebase
Authentication, configure the password-reset action URL as
`${APP_URL}/reset-password`, authorize the `APP_URL` domain, keep Email
Enumeration Protection enabled, and update the password-reset email template to
send users back to MoneyHub.

For a single-origin Web build, export the frontend and start the backend. The
backend serves both the application and GraphQL at `APP_URL/graphql`:

```bash
npm run build -w apps/frontend
npm run build -w apps/backend
npm run start -w apps/backend
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
- Infrastructure: Vercel for the frontend and backend, Supabase PostgreSQL,
  Firebase Authentication, and Vercel logs and alerts.
- Identity email: Firebase Authentication templates for verification and password recovery.

## Development Rule

No feature is implemented without a prior spec, task file, acceptance criteria, and tests.
