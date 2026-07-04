# Authentication Specification

## Status

Approved

## Objective

Define the contracts for registration, login, email verification, password recovery, Firebase token management, profile, and authorization boundaries. This document serves as the single source of truth for identity rules in MoneyHub.

## Identity Architecture

MoneyHub delegates identity management to Firebase Authentication. The backend acts as a resource server that verifies Firebase tokens and provides data access, but never manages credentials directly.

- **Frontend (Expo App & Web):** Uses Firebase Auth SDK to manage sessions, handle registration, logins, and retrieve ID tokens.
- **Backend (Node.js/GraphQL):** Uses Firebase Admin SDK to verify ID tokens on each request.
- **Data Layer:** Uses Firebase UID as the primary key for user scoping.

## Contracts

### Registration & Login

- **Method:** Users register and log in directly through the Firebase Auth SDK on the client.
- **Credentials:** Passwords, password hashes, and refresh tokens are managed exclusively by Firebase. The backend must **never** receive, process, or store passwords.
- **Token Delivery:** The client retrieves an ID token from Firebase and includes it in the `Authorization: Bearer <ID_TOKEN>` header for all authenticated GraphQL requests.

### Email Verification & Password Recovery

- **Generation:** Firebase is responsible for generating action links for email verification and password recovery.
- **Delivery:** Custom transactional emails using Resend will deliver these Firebase-generated action links to ensure a consistent and branded user experience.

### Authorization Boundaries

- **Token Verification:** The backend middleware must verify the Firebase ID token using the Firebase Admin SDK before resolving any authenticated GraphQL request.
- **Context:** The verified `uid` (and optionally email/claims) must be injected into the GraphQL context.
- **Data Scoping:** All user-owned data must be scoped by the Firebase `uid`. Queries and mutations must implicitly filter by the context's `uid`.

### Profile Management

- **Creation:** A profile is created on the backend (via a specific GraphQL mutation bootstrap) after a successful Firebase registration.
- **Identity Link:** The profile record in the database is strictly linked to the Firebase `uid`.

## Acceptance Criteria

- [ ] Firebase Auth is used exclusively for credential management.
- [ ] No passwords or hashes exist in the backend database.
- [ ] GraphQL requests are secured by validating Firebase ID tokens via Firebase Admin.
- [ ] Transactional emails for auth flows are sent via Resend with Firebase action links.
- [ ] Database queries and mutations are properly scoped by Firebase UID.
