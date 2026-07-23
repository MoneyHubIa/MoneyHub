# Environment Variables

## Status

The file lists the active application configuration and the remaining target
infrastructure keys. GraphQL, PostgreSQL, Firebase client, Firebase Admin, and
the Auth Emulator variables are implemented. GCP and Resend provisioning remain
pending.

## Backend

- `NODE_ENV`
- `PORT`
- `FRONTEND_URL`
- `GRAPHQL_ENDPOINT`
- `FIREBASE_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `FIREBASE_AUTH_EMULATOR_HOST`
- `DATABASE_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`

## App

- `EXPO_PUBLIC_GRAPHQL_ENDPOINT`
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
- Only `EXPO_PUBLIC_*` values may be exposed to the app bundle.

## Local Device Networking

- Web and the iOS Simulator can use the localhost values from `.env.example`.
- Android Emulator automatically maps localhost URLs to `10.0.2.2` at runtime.
- Physical iOS and Android devices must set `EXPO_PUBLIC_GRAPHQL_ENDPOINT` and
  `EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` to the development machine's LAN IP.
- `FIREBASE_AUTH_EMULATOR_HOST` is a backend/CLI host and must not include the
  `http://` scheme.
