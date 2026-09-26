# Backend deployment on Vercel

MoneyHub's backend is an npm workspace. Import the whole Git repository into
Vercel and set **Root Directory** to `apps/backend`. The root `app.ts` is the
Vercel Express entrypoint. The existing `src/server.ts` remains the local
long-running server used by `npm run dev -w apps/backend` and
`npm run start -w apps/backend`. Do not set an Output Directory for the API.

## Build settings

- Framework Preset: `Express` (accept automatic Express detection, or select it explicitly).
- Node.js Version: `22.x`.
- Install Command: automatic npm workspace detection.
- Build Command: leave the Express default. The backend `postinstall` runs
  `prisma generate`; verify compilation locally with `npm run build -w apps/backend`.
- Output Directory: unset.

The API entrypoint serves `/health`, `/graphql`, and password-recovery routes.
It does not serve the Expo Web build. Web hosting and rewrites are separate
deployment steps. Prisma migrations must run through a controlled process,
not as part of function startup.

## Production environment variables

Configure these under the backend project's **Settings > Environment
Variables** for **Production** before deployment:

| Key | Value |
| --- | --- |
| `APP_URL` | Public frontend origin, e.g. `https://moneyhub.vercel.app`, with no trailing path |
| `DATABASE_URL` | Reachable production PostgreSQL URL, preferably pooler URL |
| `FIREBASE_PROJECT_ID` | Firebase project ID matching the service-account JSON `project_id` |
| `FIREBASE_WEB_API_KEY` | Firebase Authentication Web API key |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full service-account JSON, stored as a secret |

Do not set `GOOGLE_APPLICATION_CREDENTIALS` to a Windows or local repository
path in Vercel. Its local file remains supported. Never commit or log the
service-account JSON. `DIRECT_URL` is for the separate migration process when
that process requires a direct database connection. `PORT`, `NODE_ENV`,
`RESEND_FROM_EMAIL`, and `RESEND_API_KEY` are not required Vercel settings.

After deployment, test `/health` and an authenticated `/graphql` operation.
`/health` alone does not prove Firebase Admin or PostgreSQL connectivity.
Environment-variable changes require a new deployment.
