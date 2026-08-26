# Design Spec: TASK-028 — Cash-Flow Chart Data

## Goal
Provide a comprehensive and interactive cash-flow visualization in the MoneyHub application, allowing users to analyze realized cash flow with hybrid granularity (Daily for the selected month and Monthly for past months).

---

## 1. Backend Architecture (GraphQL & Database)

### 1.1 Schema Definition
- **Enums**:
  - `CashFlowGranularity`: `DAILY` | `MONTHLY`
- **Inputs**:
  - `CashFlowInput`:
    - `granularity`: `CashFlowGranularity` (required, default: `DAILY` or `MONTHLY`)
    - `year`: `Int` (optional, default: current UTC year)
    - `month`: `Int` (optional, default: current UTC month, 1-12)
    - `monthsCount`: `Int` (optional, default: 6, min: 1, max: 24)
- **Types**:
  - `CashFlowDataPoint`:
    - `label`: `String!` (e.g. `"01/08"` for daily or `"Ago/26"` for monthly)
    - `date`: `String!` (ISO date string `YYYY-MM-DD` or `YYYY-MM`)
    - `income`: `String!` (formatted 2-decimal string)
    - `expense`: `String!` (formatted 2-decimal string)
    - `net`: `String!` (income - expense, 2-decimal string)
    - `accumulatedBalance`: `String!` (progressive cumulative balance over the period, 2-decimal string)
  - `CashFlowTotals`:
    - `totalIncome`: `String!`
    - `totalExpense`: `String!`
    - `netBalance`: `String!`
  - `CashFlowResult`:
    - `granularity`: `CashFlowGranularity!`
    - `dataPoints`: `[CashFlowDataPoint!]!`
    - `totals`: `CashFlowTotals!`
- **Query**:
  - `cashFlow(input: CashFlowInput): CashFlowResult!`

### 1.2 Aggregation Logic
- Scoped strictly to the authenticated `user_id` (`requireVerifiedUserId(context)`).
- Considers non-deleted records (`deletedAt: null`) from `Income` and `Expense` Prisma tables.
- **Daily View**:
  - Range: First day to last day of the chosen `(month, year)`.
  - Aggregates daily sums for each day in the month, filling missing days with zero values so the chart renders a continuous timeline.
- **Monthly View**:
  - Range: Last `monthsCount` consecutive months up to the selected `(month, year)`.
  - Aggregates monthly sums for each month, maintaining order from oldest to newest.
- Cumulative `accumulatedBalance` calculation: starts at 0 or initial period balance and accumulates `net` point by point.

---

## 2. Frontend Architecture (Expo / React Native Web)

### 2.1 Component: `CashFlowChart`
- **Location**: `apps/frontend/src/components/CashFlowChart.tsx`
- **Aesthetics & Features**:
  - **Granularity Switcher**: Pill-shaped segmented button (`Diário` vs `Mensal`).
  - **Chart Visuals**:
    - Side-by-side grouped bars for Realized Incomes (Emerald `#10b981`) and Expenses (Red/Coral `#ef4444`).
    - Net balance baseline and visual indicator.
    - Responsive layout with horizontal scrolling on small screens and adaptive scaling on desktop.
    - Hover/Tap Tooltips: shows detailed popup with date label, income, expense, and net values formatted in the user's preferred currency.
  - **Summary Badges**:
    - Period totals: Total Entradas, Total Saídas, Saldo do Período.
    - Highlights: Maior Entrada e Maior Saída do período.
  - **Zero-Dependency Core**: Pure SVG / React Native View layout for guaranteed compatibility across iOS, Android, and Web without third-party chart library compilation issues.

### 2.2 Dashboard Integration
- Integrates `CashFlowChart` directly into `DashboardShell.tsx` under the KPI summary cards, refetching on transaction changes or period switches.

---

## 3. Testing & Verification Plan
- **Backend**:
  - Unit/integration tests in `apps/backend/tests/cash-flow.test.ts` testing daily aggregation, monthly aggregation, edge cases (empty data, month boundaries, leap years), and authentication / email verification guards.
- **Frontend**:
  - Component tests in `apps/frontend/tests/CashFlowChart.test.tsx` verifying granularity switching, data rendering, tooltips, loading states, and currency formatting.
