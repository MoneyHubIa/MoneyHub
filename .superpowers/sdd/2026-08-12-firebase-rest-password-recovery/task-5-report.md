# Task 5 Report

Date: 2026-08-13

## Summary

Task 5 migrated frontend password recovery to the backend-only HTTP flow. The frontend now uses one HTTP client for request, verify, and confirm, and the Expo routes no longer import Firebase password recovery helpers directly.

## RED

1. Added failing client tests for backend `/verify` and `/confirm` requests, weak-password translation, and safe handling of invalid/expired or unavailable backend responses.
2. Ran:

   `npm test -w apps/frontend -- --runTestsByPath tests/passwordRecoveryClient.test.ts`

   Result: failed because `verifyCode` and `confirm` still called injected Firebase methods.
3. During self-review, added one more failing client test to prove that backend `INVALID_OR_EXPIRED_ACTION_CODE` must still drive invalid-link UI handling during confirmation.

## GREEN

1. Reworked `createPasswordRecoveryClient` to use injected HTTP only.
2. Added `backendPasswordRecoveryClient.ts` and updated both auth routes to import it.
3. Removed `firebasePasswordRecoveryClient.ts`.
4. Changed `PasswordRecoveryClient.verifyCode` to return `Promise<void>`.
5. Updated frontend tests so screen mocks no longer depend on verified email payloads.
6. Preserved safe behavior:
   - `WEAK_PASSWORD` maps to `auth/weak-password`
   - `INVALID_OR_EXPIRED_ACTION_CODE` maps to `auth/invalid-action-code`
   - other backend failures map to safe internal errors without leaking backend message text or details

## Commands

- RED:
  - `npm test -w apps/frontend -- --runTestsByPath tests/passwordRecoveryClient.test.ts`
- Focused verification:
  - `npm test -w apps/frontend -- --runTestsByPath tests/passwordRecoveryClient.test.ts`
  - `npm test -w apps/frontend -- --runTestsByPath tests/PasswordRecoveryScreens.test.tsx`
  - `npm test -w apps/frontend -- --runTestsByPath tests/passwordRecoveryClient.test.ts tests/PasswordRecoveryScreens.test.tsx`
- Full verification:
  - `npm test -w apps/frontend`
  - `npm run lint -w apps/frontend`
  - `npm run typecheck -w apps/frontend`

## Verification Results

- `npm test -w apps/frontend -- --runTestsByPath tests/passwordRecoveryClient.test.ts tests/PasswordRecoveryScreens.test.tsx`
  - PASS, 2 suites, 25 tests
- `npm test -w apps/frontend`
  - PASS, 15 suites, 96 tests
- `npm run lint -w apps/frontend`
  - PASS
- `npm run typecheck -w apps/frontend`
  - PASS

## Commit

Message: `refactor: use backend Firebase recovery API`

## Concerns

None at handoff.
