# EPIC-02 - Authentication and Identity

## Status
Pending

## Feature
Firebase Authentication.

## Objective
Plan and implement secure account lifecycle with Firebase Auth, Firebase Admin token verification, custom transactional email through Resend, profile management, and authorization boundaries in GraphQL.

## Initial Tasks

- [x] TASK-008 - Configure Firebase authentication specs.
- TASK-009 - Implement Firebase Auth app foundation.
- TASK-010 - Plan Firebase Admin auth context.
- TASK-011 - Plan Firebase Analytics adapter.
- TASK-017 - Implement authenticated GraphQL profile bootstrap.
- TASK-018 - Implement logout and local Firebase session cleanup.
- TASK-019 - Implement password recovery through Firebase links and Resend email.
- TASK-020 - Implement profile management.

## Technical Rules

- The backend must never store passwords, password hashes, or refresh tokens.
- The app authenticates with Firebase Auth and sends Firebase ID tokens to GraphQL.
- The backend verifies ID tokens with Firebase Admin before resolving authenticated fields.
- Email verification and password recovery emails use Firebase-generated action links delivered by Resend when custom templates are required.
- User-owned data must be scoped by Firebase UID.
