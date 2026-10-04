# EPIC-08 - Deploy and Operations

## Status
Done

## Feature
Deploy and operations on Vercel.

## Objective
Deploy the Expo Web frontend and Node.js backend on Vercel, configure Firebase
and Supabase PostgreSQL for production, and verify public operational flows,
logs, and alerts.

## Initial Tasks

- TASK-012 - Plan Vercel and Firebase operations documentation.
- TASK-016 - Prepare deploy checklist.
- TASK-037 - Configure production build for backend and Expo Web.
- TASK-038 - Document deployment with Vercel and Supabase PostgreSQL.
- TASK-039 - Document operational monitoring.
- TASK-043 - Document Firebase Auth and Analytics project setup.
- TASK-044 - Document Firebase identity email and recovery setup.

## Technical Rules

- Vercel is the official platform for the frontend and backend.
- PostgreSQL deploy target is Supabase PostgreSQL.
- Production secrets are stored in Vercel environment variables.
- Firebase client values may be public only when prefixed with `EXPO_PUBLIC_`.

## Production Verification

- Frontend and backend are deployed and operating on Vercel.
- Production database migrations were applied successfully to Supabase PostgreSQL.
- `GET /health`, authenticated GraphQL, and the end-to-end password-recovery
  flow were verified in production.
- Vercel logs and alerts are configured and operating.

## Feature-level Password Recovery Setup

Reproducing `TASK-019` requires `FIREBASE_WEB_API_KEY` in the backend
environment, the Firebase password-reset action URL
`${APP_URL}/reset-password`, the `APP_URL` domain in Firebase authorized
domains, Firebase Email Enumeration Protection enabled, and the Firebase
password-reset template pointed at MoneyHub.

Before intentionally scaling the backend across multiple Vercel instances, replace the current process-local
recovery rate-limit store with a shared store and test the exact
trusted-proxy/X-Forwarded-For chain so the separate 5/10/10 initiation,
verification, and confirmation limits apply per real client IP. The current
in-process sliding-window limiter is not suitable for multiple instances. This
is a future scale-hardening item, not a blocker for the completed deployment.
