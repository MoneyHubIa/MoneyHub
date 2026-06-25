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
