# Environment Variables

## Status

The file lists the active application configuration and the remaining target
infrastructure keys. GraphQL, PostgreSQL, Firebase client, Firebase Admin, and
the Auth Emulator variables are implemented. GCP and Resend provisioning remain
pending.

## Shared Application Origin

- `APP_URL` is defined once in the repository root `.env`.
- The backend serves the Expo Web build and GraphQL from this origin.
- Web uses the relative `/graphql` path. Native clients resolve `/graphql`
  against `APP_URL` from the Expo public configuration.

## Backend

- `NODE_ENV`
- `PORT`
- `FIREBASE_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `FIREBASE_AUTH_EMULATOR_HOST`
- `DATABASE_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
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
- Do not log secrets.
- Keep `.env.example` synchronized with required variables.
- `APP_URL` and `EXPO_PUBLIC_*` values are public and may be exposed to the app
  bundle. Secrets must never be placed in either category.

## Local Device Networking

- Web calls `/graphql` on the same origin that served the application.
- Android Emulator automatically maps a localhost `APP_URL` to `10.0.2.2`.
- Physical iOS and Android devices set the root `APP_URL` to the development
  machine's LAN or public address.
- `EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` still uses a device-reachable host.
- `FIREBASE_AUTH_EMULATOR_HOST` is a backend/CLI host and must not include the
  `http://` scheme.
