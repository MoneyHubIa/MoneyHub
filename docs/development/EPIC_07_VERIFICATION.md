# EPIC-07 Verification Evidence

## Execution environment

- Date: 2026-09-16
- Host: Windows
- Local Node: 23.2.0; outside the supported range. CI is pinned to Node 22.
- Java: 21.0.11
- Docker: 29.8.0; Docker Compose 5.5.1
- Playwright: 1.63.0; Chromium 1243 installed

## Verified gates

| Area | Command | Result |
| --- | --- | --- |
| Backend tests | `npm test -w apps/backend` | 262 passed |
| Backend coverage | `npm run test:coverage -w apps/backend` | 80% statements/lines, 80.56% branches, 88.83% functions |
| Frontend coverage | `npm run test:coverage -w apps/frontend` | 253 passed; 88.12% statements, 80.06% branches, 83.72% functions, 88.91% lines |
| TypeScript | `npm run typecheck` and `npm run typecheck:e2e` | pass |
| Lint | `npm run lint` | pass |
| E2E harness | `node --test e2e/environment.test.mjs e2e/process.test.mjs e2e/static-server.test.mjs` | 4 passed |
| Expo export | demo environment, `npm run build -w apps/frontend` | Web, iOS, Android export pass |
| Full Web E2E | `npm run test:e2e` | 13 passed; PostgreSQL, Firebase Auth Emulator, backend, Expo Web, accessibility, auth, finance, mock AI, and cleanup |

The first Web smoke exposed a real export failure: Expo could not inline Firebase variables accessed through `process.env` as a dynamic object. `firebaseApp.ts` now references every `EXPO_PUBLIC_*` key statically; the rebuilt export passed all seven tests.

## Implemented and executed locally

- `e2e/run.mjs` owns PostgreSQL Compose, migrations, Auth Emulator, backend, static Web server, Playwright, and cleanup.
- Auth UI E2E covers registration validation, registration, verified login, bootstrap, session reload, logout, and neutral wrong-password errors.
- Financial UI E2E covers category setup, R$ 1.000 income, R$ 250 expense, R$ 750 balance, R$ 100 payable, persistence, and mock AI interaction.
- `.maestro/` contains native auth, financial, and AI flows.
- `.github/workflows/quality.yml` runs quality, both coverage gates, and Web E2E on Node 22.

## Open evidence

- Android/iOS development builds and Maestro were not executed. iOS requires macOS/Xcode; both platforms require Firebase native test configuration. TASK-015 and EPIC-07 remain in progress.
- Automated axe checks supplement but do not replace TalkBack/VoiceOver inspection.
- The product has no implemented goals feature. Goal E2E remains outside the executable acceptance set until that feature exists.
