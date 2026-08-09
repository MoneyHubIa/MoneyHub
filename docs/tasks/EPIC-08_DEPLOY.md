# EPIC-08 - Deploy and Operations

## Status
Pending

## Feature
Deploy.

## Objective
Plan GCP infrastructure, Expo build targets, Firebase configuration, Resend email delivery, monitoring, and operational checklists.

## Initial Tasks

- TASK-012 - Plan GCP and Resend infrastructure docs.
- TASK-016 - Prepare deploy checklist.
- TASK-037 - Configure production build for backend and Expo Web.
- TASK-038 - Document GCP deployment with Cloud Run, Cloud SQL, Secret Manager, and Cloud Logging.
- TASK-039 - Document operational monitoring.
- TASK-043 - Document Firebase Auth and Analytics project setup.
- TASK-044 - Document Resend domain, sender, and transactional email setup.

## Technical Rules

- Backend deploy target is Cloud Run.
- PostgreSQL deploy target is Cloud SQL.
- Secrets must be stored in Secret Manager.
- Firebase client values may be public only when prefixed with `EXPO_PUBLIC_`.
- Resend API keys must never be exposed to the Expo app.

## Feature-level Password Recovery Setup

Reproducing `TASK-019` requires a verified `RESEND_FROM_EMAIL` domain,
`RESEND_API_KEY` in the backend environment, the Firebase password-reset action
URL `${APP_URL}/reset-password`, and the `APP_URL` domain in Firebase authorized
domains. This narrow setup does not complete the broader GCP, monitoring,
production-build, or Resend operations tasks in this epic.

Before a multi-instance Cloud Run deployment, replace the process-local recovery
rate-limit store with a shared store and test the exact trusted-proxy/X-Forwarded-
For chain so the five-request limit applies per real client IP. If production
threat modeling requires timing-indistinguishable account lookup, introduce a
durable asynchronous email-dispatch boundary; status/body parity alone cannot
remove provider-latency differences safely in serverless execution.
