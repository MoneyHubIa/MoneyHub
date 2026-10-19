# Frontend deployment on Vercel

MoneyHub's Expo Web frontend is an npm workspace. Import the whole Git
repository into Vercel and set **Root Directory** to `apps/frontend`.
`vercel.ts` builds the Expo Web bundle and configures the production rewrites.

## Build settings

- Framework Preset: `Other`.
- Node.js Version: `22.x`.
- Install Command: automatic npm workspace detection.
- Build Command: `npm run build:web`.
- Output Directory: `dist`.

## Production environment variables

Configure these values in the frontend Vercel project before deployment:

| Key | Value |
| --- | --- |
| `APP_URL` | Public frontend origin, with no trailing path |
| `BACKEND_URL` | Public backend Vercel origin, with no trailing path |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase Web API key |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase sender ID |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |
| `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` | Firebase Analytics measurement ID, when enabled |

`app.config.ts` derives `EXPO_PUBLIC_APP_URL` from `APP_URL`; do not configure
it separately. Values prefixed with `EXPO_PUBLIC_` are compiled into the Web
bundle and therefore must not contain secrets.

## Routing

The frontend project rewrites `/graphql` and `/auth/password-recovery` to
`BACKEND_URL`. Its final catch-all rewrite serves the Expo Web single-page
application, including direct navigation to `/reset-password`.

## Production verification

The frontend is deployed and connected to the Vercel backend. Health, GraphQL,
password recovery, and production database migrations were verified; Vercel
logs and alerts are active.
