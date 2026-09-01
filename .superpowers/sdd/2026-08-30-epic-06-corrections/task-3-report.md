# Task 3 Report — Agenda failure and recurrence editing UX

## Changes

- `Agenda` now presents recoverable errors for `myAgenda` and failed event mutations, with a retry action that reuses the original mutation payload.
- `DashboardShell` passes local calendar day as `today` to `syncAgendaNotifications`, presents a sync failure, and retries the sync.
- Editing a recurring occurrence without changing its date preserves the series anchor. Changing its date sends the new `scheduledDate` and shows an explicit whole-series anchor warning.

## TDD evidence

### RED

Command:

```powershell
npm test -w apps/frontend -- Agenda.test.tsx DashboardShell.test.tsx
```

Result: failed as expected before production changes. New expectations failed because the sync mutation was called without `today`, no recoverable alerts/retry actions existed for agenda query or sync failures, and recurring date editing neither displayed the anchor warning nor submitted the changed date.

### GREEN

Command:

```powershell
npm test -w apps/frontend -- Agenda.test.tsx DashboardShell.test.tsx
```

Result: passed — 2 suites, 15 tests.

## Verification

```powershell
npm run typecheck -w apps/frontend
```

Result: passed (`tsc --noEmit`).

```powershell
npm run lint -w apps/frontend
```

Result: failed on 14 pre-existing errors outside task files: `CashFlowChart.tsx`, `CategoryAnalysis.tsx`, `DatePickerInput.tsx`, `RecurringTransactions.tsx`, `VerifyEmailScreen.tsx`, and unrelated test files. No lint failure reported in Task 3 files.
