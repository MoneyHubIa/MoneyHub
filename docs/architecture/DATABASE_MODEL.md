# Database Model

## Conventions

- Primary keys use UUID.
- Tables include `created_at` and `updated_at`.
- User-owned financial tables include `user_id`.
- Soft-deletable domain tables include `deleted_at`.
- Monetary values use decimal-compatible database types.

## Initial Tables

### users

- `id`
- `email`
- `password_hash`
- `email_verified_at`
- `status`
- `created_at`
- `updated_at`

### profiles

- `id`
- `user_id`
- `full_name`
- `preferred_currency`
- `theme`
- `created_at`
- `updated_at`

### sessions

- `id`
- `user_id`
- `refresh_token_hash`
- `user_agent`
- `ip_address`
- `expires_at`
- `revoked_at`
- `created_at`

### financial_categories

- `id`
- `user_id`
- `name`
- `type`
- `color`
- `icon`
- `created_at`
- `updated_at`
- `deleted_at`

### cost_centers

- `id`
- `user_id`
- `name`
- `description`
- `created_at`
- `updated_at`
- `deleted_at`

### incomes and expenses

- `id`
- `user_id`
- `category_id`
- `cost_center_id`
- `description`
- `amount`
- `occurred_at`
- `notes`
- `created_at`
- `updated_at`
- `deleted_at`

### accounts_payable and accounts_receivable

- `id`
- `user_id`
- `category_id`
- `cost_center_id`
- `description`
- `amount`
- `due_date`
- `status`
- `paid_at`
- `created_at`
- `updated_at`
- `deleted_at`

### recurring_transactions

- `id`
- `user_id`
- `type`
- `description`
- `amount`
- `recurrence_rule`
- `start_date`
- `end_date`
- `created_at`
- `updated_at`

### financial_goals

- `id`
- `user_id`
- `name`
- `target_amount`
- `current_amount`
- `start_date`
- `target_date`
- `status`
- `created_at`
- `updated_at`

### calendar_events, notifications, audit_logs

These tables support agenda, reminders, and traceability for sensitive actions.

### ai_conversations, ai_messages, ai_context_snapshots

These tables support AI history, request context audit, and safe troubleshooting.
