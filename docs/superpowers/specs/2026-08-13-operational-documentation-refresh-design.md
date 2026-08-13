# Operational Documentation Refresh Design

**Date:** 2026-08-13  
**Status:** Approved

## Goal

Reconcile MoneyHub's current operational documentation with the completed
Firebase Auth REST password-recovery implementation and its final automated
verification evidence.

## Scope

Update current documentation in:

- `README.md`;
- `docs/architecture/`;
- `docs/development/`;
- `docs/planning/`;
- `docs/specs/`;
- `docs/tasks/`.

Do not rewrite historical implementation plans or design records under
`docs/superpowers/`. Those files describe decisions and migration history and
remain valid historical artifacts.

## Required reconciliation

Current documentation must describe:

- backend-only password recovery through Firebase Auth REST;
- the request, verification, and confirmation REST endpoints;
- Firebase-managed email delivery and `FIREBASE_WEB_API_KEY` configuration;
- separate rolling 15-minute limits of 5 requests for initiation and 10 each
  for verification and confirmation;
- the current in-process sliding-window implementation and the EPIC-08
  requirement for a shared store and reviewed Cloud Run proxy configuration;
- 10-second abortable Firebase deadlines;
- normalized-email hashing and safe provider-code auditing;
- validation of client-provided `x-request-id` before logs or audit events;
- stable invalid-code, weak-password, rate-limit, network, and temporary
  unavailability behavior;
- frontend retry behavior for recoverable failures and local-session cleanup
  after confirmation;
- current automated counts: 72 backend tests, 104 frontend tests, and 176 tests
  in the monorepo;
- successful lint, typecheck, backend build, and Expo exports for Web, iOS, and
  Android.

## Status boundaries

`TASK-019` and `EPIC-02` remain open as `In Progress (real smoke pending)`.
Automated gates do not prove real Firebase delivery, template content, action
URL configuration, authorized domain behavior, password replacement, action-code
non-reuse, old-password rejection, new-password login, or unknown-address
response parity.

Shared multi-instance rate limiting and trusted-proxy verification remain in
EPIC-08 and must not be described as completed production hardening.

## Validation

After editing, scan current operational documentation for stale Resend product
configuration, obsolete test counts, inconsistent endpoint contracts, and
incorrect task status. Run `git diff --check`. Documentation-only changes do
not require rerunning application tests because they do not change executable
behavior; all cited gate results must match the fresh verification already
recorded on the implementation HEAD.
