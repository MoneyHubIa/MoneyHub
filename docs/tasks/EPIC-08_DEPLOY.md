# EPIC-08 - Deploy and Operations

## Status
Pending

## Feature
Deploy.

## Objective
Plan GCP infrastructure, Expo build targets, Firebase configuration, password-recovery production hardening, monitoring, and operational checklists.

## Initial Tasks

- TASK-012 - Plan GCP and Firebase operations docs.
- TASK-016 - Prepare deploy checklist.
- TASK-037 - Configure production build for backend and Expo Web.
- TASK-038 - Document GCP deployment with Cloud Run, Cloud SQL, Secret Manager, and Cloud Logging.
- TASK-039 - Document operational monitoring.
- TASK-043 - Document Firebase Auth and Analytics project setup.
- TASK-044 - Document Firebase identity email and recovery setup.

## Technical Rules

- Backend deploy target is Cloud Run.
- PostgreSQL deploy target is Supabase PostgreSQL.
- Secrets must be stored in Secret Manager.
- Firebase client values may be public only when prefixed with `EXPO_PUBLIC_`.
- Recovery rate limiting must use a shared store before multi-instance Cloud
  Run deploys and must preserve three separate rolling 15-minute buckets: 5
  initiation requests, 10 verification requests, and 10 confirmation requests
  per real client IP.

## Feature-level Password Recovery Setup

Reproducing `TASK-019` requires `FIREBASE_WEB_API_KEY` in the backend
environment, the Firebase password-reset action URL
`${APP_URL}/reset-password`, the `APP_URL` domain in Firebase authorized
domains, Firebase Email Enumeration Protection enabled, and the Firebase
password-reset template pointed at MoneyHub. This narrow setup does not
complete the broader GCP, monitoring, production-build, or Cloud Run hardening
tasks in this epic.

Before a multi-instance Cloud Run deployment, replace the current process-local
recovery rate-limit store with a shared store and test the exact
trusted-proxy/X-Forwarded-For chain so the separate 5/10/10 initiation,
verification, and confirmation limits apply per real client IP. The current
in-process sliding-window limiter is not suitable for multiple Cloud Run
instances, and the shared store must keep those counters distinct rather than
collapse them into one recovery bucket. If production threat modeling requires
timing-indistinguishable account lookup, introduce a durable asynchronous
email-dispatch boundary; status/body parity alone cannot remove provider-
latency differences safely in serverless execution.
