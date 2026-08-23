# EPIC-04 — Dashboards and Indicators

## Status
Pending

## Feature
Dashboard.

## Objective
Create financial KPIs, comparative charts, cash-flow summaries, overdue accounts, future accounts, and goal indicators.

## Initial Tasks

- [x] TASK-023 — Implement dashboard summary.
- [x] TASK-028 — Implement cash-flow chart data.
- [ ] TASK-029 — Implement category analysis.
- [ ] TASK-030 — Implement period comparison.

## Tasks Detail

### TASK-028 - Implement cash-flow chart data

## Status
Done

## Completion Review
The backend implements GraphQL query `cashFlow(input: CashFlowInput)` aggregating user realized incomes and expenses with hybrid granularity (`DAILY` and `MONTHLY`). It automatically handles month boundaries, continuous timeline zero-fill, net balance, and cumulative balance (`accumulatedBalance`). The Expo frontend integrates an interactive `CashFlowChart` into `DashboardShell` with granularity switching, comparative income/expense grouped bars, period totals ribbon, and on-press/hover detail tooltips formatted in the user's preferred currency.

### TASK-023 - Implement dashboard summary

## Status
Done

## Completion Review
The backend provides GraphQL query `dashboardSummary(month, year)` aggregating user incomes, expenses, and net balance. The frontend `DashboardShell` connects dynamic KPI cards formatted with user preferred currency and color-coded status.
