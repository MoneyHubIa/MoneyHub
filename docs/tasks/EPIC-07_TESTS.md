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
- The Android development build passed all three Maestro flows (`auth`, `financial`, and `ai`) on `emulator-5554` on 2026-09-24. Manual TalkBack inspection of authentication and transaction creation also passed.
- iOS Maestro execution and manual VoiceOver inspection still require a macOS host with Xcode. TASK-015 and EPIC-07 remain in progress until that evidence is recorded.

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
