CREATE TABLE bank_statement_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  financial_account_id UUID NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  format VARCHAR(3) NOT NULL CHECK (format IN ('OFX', 'CSV')),
  file_hash CHAR(64) NOT NULL,
  currency CHAR(3) NOT NULL,
  rows JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED')),
  confirmation_hash CHAR(64),
  result JSONB,
  expires_at TIMESTAMPTZ(3) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT bank_statement_import_scope_key UNIQUE (id, user_id, financial_account_id),
  CONSTRAINT bank_statement_import_user_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT bank_statement_import_account_fkey FOREIGN KEY (user_id, financial_account_id) REFERENCES financial_accounts(user_id, id) ON DELETE NO ACTION ON UPDATE CASCADE
);
CREATE INDEX bank_statement_import_owner_expiry_idx ON bank_statement_imports(user_id, status, expires_at);

CREATE TABLE bank_statement_import_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL,
  user_id UUID NOT NULL,
  financial_account_id UUID NOT NULL,
  row_number INTEGER NOT NULL CHECK (row_number > 0),
  source_key CHAR(64) NOT NULL,
  fingerprint CHAR(64) NOT NULL,
  entity_kind VARCHAR(20) NOT NULL CHECK (entity_kind IN ('PAYABLE', 'RECEIVABLE', 'TRANSFER', 'CARD_PAYMENT')),
  entity_id UUID NOT NULL,
  target_key VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT bank_statement_entry_import_fkey FOREIGN KEY (import_id, user_id, financial_account_id) REFERENCES bank_statement_imports(id, user_id, financial_account_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT bank_statement_entry_source_key UNIQUE (user_id, financial_account_id, source_key),
  CONSTRAINT bank_statement_entry_target_key UNIQUE (user_id, financial_account_id, target_key)
);
CREATE INDEX bank_statement_entry_fingerprint_idx ON bank_statement_import_entries(user_id, financial_account_id, fingerprint);
CREATE INDEX bank_statement_entry_import_idx ON bank_statement_import_entries(import_id, user_id, financial_account_id);
