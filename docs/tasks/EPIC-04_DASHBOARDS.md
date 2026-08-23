# EPIC-04 — Dashboards and Indicators

## Status
Done

## Feature
Dashboard.

## Objective
Create financial KPIs, comparative charts, cash-flow summaries, overdue accounts, future accounts, and goal indicators.

## Initial Tasks

- [x] TASK-023 — Implement dashboard summary.
- [x] TASK-028 — Implement cash-flow chart data.
- [x] TASK-029 — Implement category analysis.
- [x] TASK-030 — Implement period comparison.

## Tasks Detail

### TASK-030 - Implement period comparison

## Status
Done

## Completion Review
The backend implements GraphQL query `periodComparison(input: PeriodComparisonInput)` aggregating user income and expense metrics across any two selected periods (e.g. Month over Month or Year over Year). It computes monetary differences, percentage changes (safe from zero-division), net balance evolution, and savings rate (taxa de economia) variation in percentage points. The Expo frontend integrates a `PeriodComparison` component into `DashboardShell` with quick MoM/YoY toggle controls and 4 responsive comparison cards equipped with intelligent color-coded delta badges.

### TASK-029 - Implement category analysis

## Status
Done

## Completion Review
The backend implements GraphQL query `categoryAnalysis(input: CategoryAnalysisInput)` aggregating active user transactions by category for a given month and type (`EXPENSE` or `INCOME`). It calculates percentages relative to the total, transaction counts, and sorts categories in descending order of volume. The Expo frontend integrates a `CategoryAnalysis` component with a type switcher (`Despesas` / `Receitas`), multi-colored proportional distribution stacked bar, and a ranked list with badges, transaction counts, and currency formatters.

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
