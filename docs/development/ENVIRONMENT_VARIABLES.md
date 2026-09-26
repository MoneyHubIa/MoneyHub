# Environment Variables

## Status

The file lists the active application configuration and the remaining target
infrastructure keys. GraphQL, PostgreSQL, Firebase client, Firebase Admin, the
Auth Emulator, and the Firebase REST password-recovery flow are implemented.
Broad GCP and production provisioning remain pending in `EPIC-08`.

## Shared Application Origin

- For local development, `APP_URL` is defined once in the repository root `.env`.
- Locally, the backend serves the Expo Web build and GraphQL from this origin.
- On Vercel, set `APP_URL` in the backend project to the public frontend origin.
  The backend entrypoint serves the API only; the frontend project must proxy
  `/graphql` and `/auth/password-recovery` to the backend in a later deployment step.
- Web uses the relative `/graphql` path. Native clients resolve `/graphql`
  against `APP_URL` from the Expo public configuration.
- Password recovery uses relative `/auth/password-recovery` on production Web;
  development and native clients resolve it against `APP_URL`.
- Firebase recovery emails must target the MoneyHub reset handler at
  `${APP_URL}/reset-password`.

## Backend

- `NODE_ENV`
- `PORT`
- `FIREBASE_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `FIREBASE_SERVICE_ACCOUNT_JSON` (Vercel secret containing the complete Firebase Admin service-account JSON; use instead of a local credential path)
- `FIREBASE_AUTH_EMULATOR_HOST`
- `DATABASE_URL`
- `DIRECT_URL`
- `FIREBASE_WEB_API_KEY`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`

## App-specific public values

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL`

## AI

- `LLM_PROVIDER`
- `LLM_API_KEY`
- `LLM_MODEL`

## Rules

- Do not commit `.env`.
- Never commit Firebase Admin service-account JSON or paste it into a public log. On Vercel, configure `FIREBASE_SERVICE_ACCOUNT_JSON` as a secret; `GOOGLE_APPLICATION_CREDENTIALS` remains a local file path.
- Do not log secrets.
- Keep `.env.example` synchronized with required variables.
- `APP_URL` and `EXPO_PUBLIC_*` values are public and may be exposed to the app
  bundle. Secrets must never be placed in either category.
- `APP_URL` and `FIREBASE_WEB_API_KEY` are validated when the backend starts.
- Never log password-recovery request bodies, `oobCode`, `newPassword`, or URLs
  that contain `FIREBASE_WEB_API_KEY`.
- Only accept a client `x-request-id` when it matches
  `[A-Za-z0-9._-]{1,128}`; otherwise let the backend replace it with a UUID.

## Password Recovery Provider Setup

- Set `FIREBASE_WEB_API_KEY` to the key used by Firebase Authentication REST
  password-reset calls.
- Keep Firebase Authentication responsible for password-recovery email
  delivery, and set its password-reset action URL to
  `${APP_URL}/reset-password`.
- The backend recovery service currently sends
  `continueUrl: ${APP_URL}/login` in Firebase Auth REST initiation requests.
- Add the `APP_URL` domain to Firebase Authentication authorized domains.
- Enable Firebase Email Enumeration Protection.
- Update the Firebase password-reset email template so recovery links return to
  MoneyHub.
- Keep `handleCodeInApp: false`; native deep linking is not part of this flow.

## Local Device Networking

- Web calls `/graphql` on the same origin that served the application.
- Android Emulator automatically maps a localhost `APP_URL` to `10.0.2.2`.
- Physical iOS and Android devices set the root `APP_URL` to the development
  machine's LAN or public address.
- `EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` still uses a device-reachable host.
- `FIREBASE_AUTH_EMULATOR_HOST` is a backend/CLI host and must not include the
  `http://` scheme.
