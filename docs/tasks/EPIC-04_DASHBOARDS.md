# EPIC-04 — Dashboards and Indicators

## Status
Pending

## Feature
Dashboard.

## Objective
Create financial KPIs, comparative charts, cash-flow summaries, overdue accounts, future accounts, and goal indicators.

## Initial Tasks

- [x] TASK-023 — Implement dashboard summary.
- [ ] TASK-028 — Implement cash-flow chart data.
- [ ] TASK-029 — Implement category analysis.
- [ ] TASK-030 — Implement period comparison.

## Tasks Detail

### TASK-023 - Implement dashboard summary

## Status
Done

## Completion Review
The backend provides GraphQL query `dashboardSummary(month, year)` aggregating user incomes, expenses, and net balance. The frontend `DashboardShell` connects dynamic KPI cards formatted with user preferred currency and color-coded status.
