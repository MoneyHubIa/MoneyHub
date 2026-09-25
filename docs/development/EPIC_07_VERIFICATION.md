# EPIC-07 Verification Evidence

## Execution environment

- Baseline verification date: 2026-09-16
- Android native verification date: 2026-09-24
- Host: Windows
- Local Node: 23.2.0; outside the supported range. CI is pinned to Node 22.
- Java: 21.0.11
- Docker: 29.8.0; Docker Compose 5.5.1
- Playwright: 1.63.0; Chromium 1243 installed
- Android device: `emulator-5554`; application ID `com.moneyhub.e2e`

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
| Android native E2E | `maestro test --no-reinstall-driver --udid emulator-5554 ... .maestro` | 3/3 flows passed: `auth`, `financial`, and `ai` |
| Android accessibility | Manual TalkBack inspection | Authentication and transaction creation passed focus order, labels, control states, error announcements, and completion checks |

The first Web smoke exposed a real export failure: Expo could not inline Firebase variables accessed through `process.env` as a dynamic object. `firebaseApp.ts` now references every `EXPO_PUBLIC_*` key statically; the rebuilt export passed all seven tests.

## Implemented and executed locally

- `e2e/run.mjs` owns PostgreSQL Compose, migrations, Auth Emulator, backend, static Web server, Playwright, and cleanup.
- Auth UI E2E covers registration validation, registration, verified login, bootstrap, session reload, logout, and neutral wrong-password errors.
- Financial UI E2E covers category setup, R$ 1.000 income, R$ 250 expense, R$ 750 balance, R$ 100 payable, persistence, and mock AI interaction.
- `.maestro/` contains native auth, financial, and AI flows. All three passed on the Android development build installed as `com.moneyhub.e2e` on `emulator-5554`.
- Manual TalkBack inspection passed for authentication and transaction creation on Android.
- `.github/workflows/quality.yml` runs quality, both coverage gates, and Web E2E on Node 22.

## Open evidence

- iOS development build and Maestro flows have not been executed. They require macOS, Xcode, and the native Firebase test configuration. TASK-015 and EPIC-07 remain in progress until iOS evidence is recorded.
- Automated axe checks and the completed Android TalkBack inspection do not replace the remaining iOS VoiceOver inspection.
- The product has no implemented goals feature. Goal E2E remains outside the executable acceptance set until that feature exists.
