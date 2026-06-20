# Business Rules

## Identity

- Every user account must have a unique e-mail address.
- Passwords must be stored only as bcrypt hashes.
- E-mail verification is required before enabling sensitive account actions.
- Refresh tokens must be revocable per session.

## Financial Ownership

- Financial records belong to exactly one authenticated user in the initial release.
- A user must never read, update, or delete records owned by another user.
- Soft deletion is preferred for financial records that affect reports or audit history.

## Transactions

- Income values must be positive monetary amounts.
- Expense values must be positive monetary amounts stored by type, not as negative income.
- Categories may be scoped by transaction type: income, expense, or both.
- Cost centers are optional for personal users and recommended for business users.
- Recurring transactions define recurrence rules; generated entries remain auditable.

## Planning

- Financial goals must define target amount, current amount, start date, and target date.
- Goal progress is calculated from persisted values and related financial records.
- Dashboard indicators must be derived from server-side authorized queries.

## AI Assistant

- AI responses may use only data available to the authenticated user.
- The assistant must not provide legal, tax, investment, or credit advice as a professional recommendation.
- AI context must be minimized to the data required for the user request.
- Every AI interaction must be logged with metadata for audit and troubleshooting.
