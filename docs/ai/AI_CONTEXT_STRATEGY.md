# AI Context Strategy

## Context Sources

- Financial summaries.
- Income and expense aggregates.
- Accounts payable and receivable status.
- Goal progress.
- Calendar reminders.

## Context Rules

- Prefer aggregates over raw transaction lists.
- Include raw records only when necessary for the user's request.
- Scope every query by authenticated user ID.
- Attach context version metadata to AI responses.

## Initial Context Shape

```json
{
  "period": "YYYY-MM",
  "currency": "BRL",
  "totals": {
    "income": 0,
    "expenses": 0,
    "balance": 0
  },
  "topExpenseCategories": [],
  "upcomingBills": [],
  "goals": []
}
```
