# Task 1 report: Local notification synchronization

## Changes

- Made `syncAgendaNotifications` require a client-supplied `today` local date in `YYYY-MM-DD` format. The service rejects malformed or impossible calendar dates with `BAD_USER_INPUT`.
- Changed synchronization to consider only occurrences in `today` through `today + 7` and create a notification only when `reminderDate` equals `today` exactly. Historical one-off records no longer create notifications; older recurring series still expand into their matching current occurrence.
- Preserved idempotency with the existing `(userId, source, sourceId, occurrenceDate)` upsert key and limited cleanup to notifications whose `reminderDate` is the synchronized local day.
- Added `rangeStart` to reminder-source lookup. Prisma queries select current-window payable/receivable records, current-window one-off events, and old recurring event series needed to calculate current occurrences.
- Updated GraphQL mutation contract and resolver to require and forward `today: String!`.

## Files

- `apps/backend/src/agenda-notifications.ts`
- `apps/backend/src/graphql.ts`
- `apps/backend/tests/agenda-notifications.test.ts`
- `apps/backend/tests/agenda-flow.integration.test.ts`

## TDD evidence

### Red

Command:

```text
npm test -w apps/backend -- agenda-notifications.test.ts agenda-flow.integration.test.ts
```

Result: exit code `1` before production changes. Expected failures included missing GraphQL argument `today: String!` and `TypeError: value.getUTCFullYear is not a function` because existing service expected a UTC `Date`, not local `YYYY-MM-DD` input. The package test script also expands its existing `tests/**/*.test.ts` glob, so this invocation ran the backend suite.

### Green

Same command after production changes: exit code `0`; `198` tests passed, `0` failed. New coverage verifies required local-day format, exact local-day matching for offsets `0`, `1`, `3`, and `7`, no historic one-off reminder, old recurring series, idempotency, GraphQL contract, and two-user isolation. Existing integration coverage now calls the new local-day contract.

## Verification

```text
npm run typecheck -w apps/backend
```

Passed, exit code `0`.

```text
npm run lint -w apps/backend
```

Exited `1` with 15 pre-existing lint errors: seven in unchanged earlier lines of `apps/backend/src/graphql.ts`, plus errors in `accounts-payable.test.ts`, `accounts-receivable.test.ts`, `period-comparison.test.ts`, and `recurring-transactions.test.ts`. No lint error points to a changed line in this task.

```text
git diff --check
```

Passed with no whitespace error.

## Auto-review

- Checked exact equality, not `<=`, between computed reminder date and supplied local day.
- Checked candidate window includes all supported offsets through seven days and still includes old recurring events.
- Checked cleanup cannot remove notifications outside synchronized local day.
- Checked all source lookup and notification operations retain authenticated `userId` scope.
- Checked mutation remains under GraphQL `Mutation`; no write was added to `Query`.
