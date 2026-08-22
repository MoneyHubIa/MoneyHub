# EPIC-03 — Financial Management

## Status
Done

## Feature
Financial records.

## Objective
Implement categories, cost centers, income, expenses, accounts payable, accounts receivable, recurring transactions, balances, and cash-flow records.

## Initial Tasks

- [x] TASK-021 — Implement financial categories.
- [x] TASK-022 — Implement income and expenses.
- [x] TASK-024 — Implement cost centers.
- [x] TASK-025 — Implement accounts payable.
- [x] TASK-026 — Implement accounts receivable.
- [x] TASK-027 — Implement recurring transactions.

## Tasks Detail

### TASK-027 - Implement recurring transactions

## Status
Done

## Completion Review
The backend implements Prisma `RecurringTransaction` persistence, GraphQL schema types, enums `RecurringType` (`EXPENSE`, `INCOME`) and `RecurrenceRule` (`MONTHLY`, `WEEKLY`, `YEARLY`), query `myRecurringTransactions`, and mutations (`createRecurringTransaction`, `updateRecurringTransaction`, `deleteRecurringTransaction`, `processRecurringTransactions`). When a recurrence rule is created, the system automatically schedules the initial `AccountPayable` (for expenses) or `AccountReceivable` (for income) in `PENDING` status with regional date support. The `processRecurringTransactions` mutation automatically evaluates past/upcoming intervals to generate missing occurrences without duplicating records. The Expo app provides a `RecurringTransactions` UI screen with monthly KPIs, responsive creation form, frequency selection, DatePickerInput with interactive calendar picker, and direct sync processing.

### TASK-026 - Implement accounts receivable

## Status
Done

## Completion Review
The backend implements Prisma `AccountReceivable` persistence, GraphQL schema types, enum `AccountReceivableStatus`, query `myAccountsReceivable(status)` and mutations (`createAccountReceivable`, `updateAccountReceivable`, `markAccountReceivableReceived`, `deleteAccountReceivable`). Resolvers enforce user authentication, validation, and multi-tenant isolation. Receiving a payment via `markAccountReceivableReceived` generates an `Income` transaction (`[Recebido] <descrição>`) to keep cash flow and dashboard KPI metrics in sync. The Expo app provides an `AccountsReceivable` UI screen in `DashboardShell` allowing scheduling, status filtering (Todas, Pendentes, Recebidas), quick receipt settlement ("Dar Baixa"), and soft deletion.

### TASK-025 - Implement accounts payable

## Status
Done

## Completion Review
The backend implements Prisma `AccountPayable` persistence, GraphQL schema types, enum `AccountPayableStatus`, query `myAccountsPayable(status)` and mutations (`createAccountPayable`, `updateAccountPayable`, `markAccountPayablePaid`, `deleteAccountPayable`). Resolvers enforce user authentication, validation, and multi-tenant isolation. The Expo app provides an `AccountsPayable` UI screen in `DashboardShell` allowing scheduling, status filtering (Todas, Pendentes, Pagas), quick payment settlement ("Dar Baixa"), and soft deletion.

### TASK-022 - Implement income and expenses

## Status
Done

## Completion Review
The backend implements Prisma `Income` and `Expense` storage, GraphQL schema types, queries (`myIncomes`, `myExpenses`), and mutations (`createIncome`, `updateIncome`, `deleteIncome` and equivalent for expenses). Resolvers verify `user_id` context and email verification. The Expo app provides a unified `Transactions` UI in `DashboardShell` to create and list incomes and expenses, using Apollo Client.

### TASK-021 - Implement financial categories

## Status
Done

## Completion Review
The backend implements Prisma `FinancialCategory` storage, GraphQL schema types, queries (`myCategories`), and mutations (`createCategory`, `updateCategory`, `deleteCategory`). User ownership is enforced strictly by `user_id` from the authenticated context, and email verification (`emailVerified === true`) is required for writes and reads. The Expo app provides a dedicated `FinancialCategories` UI with filter tabs, color selection, and responsive layouts.

### TASK-024 - Implement cost centers

## Status
Done

## Completion Review
The backend implements Prisma `CostCenter` storage, GraphQL schema types, queries (`myCostCenters`), and mutations (`createCostCenter`, `updateCostCenter`, `deleteCostCenter`). User ownership is scoped by `user_id`, email verification is enforced, and soft-delete is used for historic traceability. The Expo app provides a `CostCenters` management UI component.
