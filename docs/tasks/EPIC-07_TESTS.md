# EPIC-07 - Tests and Quality

## Status
In Progress

## Feature
Quality.

## Implementation Plan

The implementation sequence, existing test baseline, acceptance criteria, and
Web/Android/iOS dependencies are documented in
[the EPIC-07 implementation plan](../superpowers/plans/2026-09-15-epic-07-tests-quality.md).
Planning does not change the task or epic implementation status.

## Current implementation

- Done: TASK-034, TASK-035, TASK-036, TASK-040, TASK-041, TASK-042.
- In progress: TASK-015.
- The full Web E2E stack passes locally in Chromium: 13 tests covering PostgreSQL, Firebase Auth Emulator, backend health/GraphQL, accessibility, authentication, finance, mock AI, and cleanup.
- Android and iOS Maestro flows exist, but real device/simulator evidence is still required.

See [EPIC-07 verification evidence](../development/EPIC_07_VERIFICATION.md).

## Objective
Plan automated tests, coverage, linting, accessibility checks, and E2E flows for the Expo + GraphQL + Firebase foundation.

## Initial Tasks

- TASK-015 - Configure E2E tests.
- TASK-034 - Configure backend GraphQL coverage thresholds.
- TASK-035 - Configure Expo app coverage thresholds.
- TASK-036 - Add Firebase authentication E2E flow.
- TASK-040 - Add Firebase Admin auth context tests.
- TASK-041 - Add Firebase Analytics adapter tests.
- TASK-042 - Add Expo Web smoke build verification.
