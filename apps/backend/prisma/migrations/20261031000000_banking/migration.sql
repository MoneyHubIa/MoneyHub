BEGIN;
SET LOCAL lock_timeout = '10s';
CREATE TABLE "financial_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'CHECKING',
  "account_number" TEXT,
  "additional_data" TEXT,
  "initial_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "seed_key" TEXT
);
CREATE TABLE "transfers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" UUID NOT NULL,
  "source_id" UUID NOT NULL,
  "destination_id" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "due_date" DATE NOT NULL,
  "effective_date" DATE,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "operation_id" UUID NOT NULL
);
CREATE TABLE "credit_cards" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" UUID NOT NULL,
  "financial_account_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "brand" TEXT NOT NULL,
  "credit_limit" DECIMAL(12,2) NOT NULL,
  "due_day" INTEGER NOT NULL,
  "closing_day" INTEGER NOT NULL,
  "dynamic_days" INTEGER,
  "business_days" BOOLEAN NOT NULL DEFAULT false,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "archived" BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE "credit_card_purchases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "card_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "due_date" DATE NOT NULL,
  "closing_date" DATE NOT NULL,
  "installment_number" INTEGER NOT NULL,
  "installment_total" INTEGER NOT NULL,
  "operation_id" UUID NOT NULL
);
CREATE TABLE "credit_card_payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "card_id" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "paid_on" DATE NOT NULL,
  "due_date" DATE NOT NULL,
  "operation_id" UUID NOT NULL
);
CREATE UNIQUE INDEX financial_accounts_owner_id ON financial_accounts(user_id,id);
CREATE UNIQUE INDEX financial_accounts_seed ON financial_accounts(user_id,seed_key);
CREATE UNIQUE INDEX financial_accounts_default ON financial_accounts(user_id) WHERE is_default AND NOT archived;
ALTER TABLE financial_accounts ADD FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE transfers ADD FOREIGN KEY(user_id,source_id) REFERENCES financial_accounts(user_id,id);
ALTER TABLE transfers ADD FOREIGN KEY(user_id,destination_id) REFERENCES financial_accounts(user_id,id);
ALTER TABLE transfers ADD CHECK(source_id <> destination_id AND amount > 0);
CREATE UNIQUE INDEX transfers_operation ON transfers(user_id,operation_id);
CREATE INDEX transfers_source ON transfers(source_id);
CREATE INDEX transfers_destination ON transfers(destination_id);
ALTER TABLE credit_cards ADD FOREIGN KEY(user_id,financial_account_id) REFERENCES financial_accounts(user_id,id);
CREATE UNIQUE INDEX credit_cards_primary ON credit_cards(user_id) WHERE is_primary AND NOT archived;
CREATE INDEX credit_cards_account ON credit_cards(financial_account_id);
ALTER TABLE credit_card_purchases ADD FOREIGN KEY(card_id) REFERENCES credit_cards(id);
ALTER TABLE credit_card_purchases ADD FOREIGN KEY(category_id) REFERENCES financial_categories(id);
ALTER TABLE credit_card_purchases ADD CHECK(amount > 0 AND paid_amount >= 0 AND paid_amount <= amount);
CREATE UNIQUE INDEX credit_card_purchase_operation ON credit_card_purchases(card_id,operation_id,installment_number);
CREATE INDEX credit_card_purchase_cycle ON credit_card_purchases(card_id,due_date);
ALTER TABLE credit_card_payments ADD FOREIGN KEY(card_id) REFERENCES credit_cards(id);
CREATE UNIQUE INDEX credit_card_payment_operation ON credit_card_payments(card_id,operation_id);
ALTER TABLE credit_card_payments ADD COLUMN allocations JSONB NOT NULL DEFAULT '{}', ADD COLUMN reversed BOOLEAN NOT NULL DEFAULT false;
CREATE FUNCTION initialize_financial_accounts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO financial_accounts(user_id,name,type,is_default,seed_key) VALUES
 (NEW.id,'Conta Corrente','CHECKING',true,'CHECKING'),
 (NEW.id,'Investimentos','INVESTMENT',false,'INVESTMENT');
 RETURN NEW;
END $$;
CREATE TRIGGER initialize_financial_accounts AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION initialize_financial_accounts();
INSERT INTO financial_accounts(user_id,name,type,is_default,seed_key)
 SELECT id,'Conta Corrente','CHECKING',true,'CHECKING' FROM users;
INSERT INTO financial_accounts(user_id,name,type,is_default,seed_key)
 SELECT id,'Investimentos','INVESTMENT',false,'INVESTMENT' FROM users;
CREATE FUNCTION resolve_financial_account() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.financial_account_id IS NULL THEN
  SELECT id INTO NEW.financial_account_id FROM financial_accounts WHERE user_id=NEW.user_id AND is_default AND NOT archived;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM financial_categories WHERE id=NEW.category_id AND user_id=NEW.user_id AND deleted_at IS NULL) THEN
  RAISE EXCEPTION 'Category does not belong to user';
 END IF;
 IF NEW.cost_center_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM cost_centers WHERE id=NEW.cost_center_id AND user_id=NEW.user_id) THEN
  RAISE EXCEPTION 'Cost center does not belong to user';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM financial_accounts WHERE id=NEW.financial_account_id AND user_id=NEW.user_id) THEN
  RAISE EXCEPTION 'Financial account does not belong to user';
 END IF;
 IF TG_OP='INSERT' OR NEW.financial_account_id IS DISTINCT FROM OLD.financial_account_id THEN
  IF EXISTS(SELECT 1 FROM financial_accounts WHERE id=NEW.financial_account_id AND archived) THEN
   RAISE EXCEPTION 'Financial account is archived';
  END IF;
 END IF;
 RETURN NEW;
END $$;
ALTER TABLE incomes ADD COLUMN financial_account_id UUID DEFAULT NULL;
UPDATE incomes t SET financial_account_id=a.id FROM financial_accounts a WHERE a.user_id=t.user_id AND a.is_default;
ALTER TABLE incomes ALTER COLUMN financial_account_id SET NOT NULL;
ALTER TABLE incomes ADD FOREIGN KEY(user_id,financial_account_id) REFERENCES financial_accounts(user_id,id);
CREATE INDEX incomes_financial_account ON incomes(user_id,financial_account_id);
CREATE TRIGGER incomes_financial_account BEFORE INSERT OR UPDATE ON incomes FOR EACH ROW EXECUTE FUNCTION resolve_financial_account();
ALTER TABLE incomes ADD COLUMN settlement_id UUID UNIQUE;
ALTER TABLE expenses ADD COLUMN financial_account_id UUID DEFAULT NULL;
UPDATE expenses t SET financial_account_id=a.id FROM financial_accounts a WHERE a.user_id=t.user_id AND a.is_default;
ALTER TABLE expenses ALTER COLUMN financial_account_id SET NOT NULL;
ALTER TABLE expenses ADD FOREIGN KEY(user_id,financial_account_id) REFERENCES financial_accounts(user_id,id);
CREATE INDEX expenses_financial_account ON expenses(user_id,financial_account_id);
CREATE TRIGGER expenses_financial_account BEFORE INSERT OR UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION resolve_financial_account();
ALTER TABLE expenses ADD COLUMN settlement_id UUID UNIQUE;
ALTER TABLE accounts_payable ADD COLUMN financial_account_id UUID DEFAULT NULL;
UPDATE accounts_payable t SET financial_account_id=a.id FROM financial_accounts a WHERE a.user_id=t.user_id AND a.is_default;
ALTER TABLE accounts_payable ALTER COLUMN financial_account_id SET NOT NULL;
ALTER TABLE accounts_payable ADD FOREIGN KEY(user_id,financial_account_id) REFERENCES financial_accounts(user_id,id);
CREATE INDEX accounts_payable_financial_account ON accounts_payable(user_id,financial_account_id);
CREATE TRIGGER accounts_payable_financial_account BEFORE INSERT OR UPDATE ON accounts_payable FOR EACH ROW EXECUTE FUNCTION resolve_financial_account();
ALTER TABLE accounts_payable ADD COLUMN series_id UUID, ADD COLUMN installment_number INTEGER, ADD COLUMN installment_total INTEGER, ADD UNIQUE(series_id,installment_number);
ALTER TABLE accounts_receivable ADD COLUMN financial_account_id UUID DEFAULT NULL;
UPDATE accounts_receivable t SET financial_account_id=a.id FROM financial_accounts a WHERE a.user_id=t.user_id AND a.is_default;
ALTER TABLE accounts_receivable ALTER COLUMN financial_account_id SET NOT NULL;
ALTER TABLE accounts_receivable ADD FOREIGN KEY(user_id,financial_account_id) REFERENCES financial_accounts(user_id,id);
CREATE INDEX accounts_receivable_financial_account ON accounts_receivable(user_id,financial_account_id);
CREATE TRIGGER accounts_receivable_financial_account BEFORE INSERT OR UPDATE ON accounts_receivable FOR EACH ROW EXECUTE FUNCTION resolve_financial_account();
ALTER TABLE accounts_receivable ADD COLUMN series_id UUID, ADD COLUMN installment_number INTEGER, ADD COLUMN installment_total INTEGER, ADD UNIQUE(series_id,installment_number);
ALTER TABLE recurring_transactions ADD COLUMN financial_account_id UUID DEFAULT NULL;
UPDATE recurring_transactions t SET financial_account_id=a.id FROM financial_accounts a WHERE a.user_id=t.user_id AND a.is_default;
ALTER TABLE recurring_transactions ALTER COLUMN financial_account_id SET NOT NULL;
ALTER TABLE recurring_transactions ADD FOREIGN KEY(user_id,financial_account_id) REFERENCES financial_accounts(user_id,id);
CREATE INDEX recurring_transactions_financial_account ON recurring_transactions(user_id,financial_account_id);
CREATE TRIGGER recurring_transactions_financial_account BEFORE INSERT OR UPDATE ON recurring_transactions FOR EACH ROW EXECUTE FUNCTION resolve_financial_account();
ALTER TABLE accounts_payable ADD COLUMN card_statement_key TEXT UNIQUE;

-- Link existing settlements only when their origin is unambiguous.
UPDATE expenses e SET settlement_id=p.id FROM accounts_payable p
WHERE e.user_id=p.user_id AND e.notes='Baixa da conta a pagar #' || p.id::text
AND (SELECT count(*) FROM expenses x WHERE x.notes=e.notes AND x.user_id=e.user_id)=1;
UPDATE incomes e SET settlement_id=p.id FROM accounts_receivable p
WHERE e.user_id=p.user_id AND e.notes='Baixa da conta a receber #' || p.id::text
AND (SELECT count(*) FROM incomes x WHERE x.notes=e.notes AND x.user_id=e.user_id)=1;

CREATE FUNCTION synchronize_commitment_settlement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE realized boolean;
BEGIN
 IF TG_TABLE_NAME='accounts_payable' THEN
  IF NEW.card_statement_key IS NOT NULL THEN RETURN NEW; END IF;
 END IF;
 realized := NEW.deleted_at IS NULL AND NEW.status=CASE WHEN TG_TABLE_NAME='accounts_payable' THEN 'PAID' ELSE 'RECEIVED' END;
 IF TG_TABLE_NAME='accounts_payable' THEN
  IF realized THEN
   INSERT INTO expenses(user_id,financial_account_id,category_id,cost_center_id,description,amount,occurred_at,settlement_id,updated_at)
   VALUES(NEW.user_id,NEW.financial_account_id,NEW.category_id,NEW.cost_center_id,NEW.description,NEW.amount,coalesce(NEW.paid_at,now()),NEW.id,now())
   ON CONFLICT(settlement_id) DO UPDATE SET financial_account_id=EXCLUDED.financial_account_id, category_id=EXCLUDED.category_id,cost_center_id=EXCLUDED.cost_center_id,description=EXCLUDED.description,amount=EXCLUDED.amount,occurred_at=EXCLUDED.occurred_at,deleted_at=NULL;
  ELSE UPDATE expenses SET deleted_at=now() WHERE settlement_id=NEW.id AND user_id=NEW.user_id;
  END IF;
 ELSE
  IF realized THEN
   INSERT INTO incomes(user_id,financial_account_id,category_id,cost_center_id,description,amount,occurred_at,settlement_id,updated_at)
   VALUES(NEW.user_id,NEW.financial_account_id,NEW.category_id,NEW.cost_center_id,NEW.description,NEW.amount,coalesce(NEW.received_at,now()),NEW.id,now())
   ON CONFLICT(settlement_id) DO UPDATE SET financial_account_id=EXCLUDED.financial_account_id,category_id=EXCLUDED.category_id,cost_center_id=EXCLUDED.cost_center_id,description=EXCLUDED.description,amount=EXCLUDED.amount,occurred_at=EXCLUDED.occurred_at,deleted_at=NULL;
  ELSE UPDATE incomes SET deleted_at=now() WHERE settlement_id=NEW.id AND user_id=NEW.user_id;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER payable_settlement AFTER INSERT OR UPDATE ON accounts_payable FOR EACH ROW EXECUTE FUNCTION synchronize_commitment_settlement();
CREATE TRIGGER receivable_settlement AFTER INSERT OR UPDATE ON accounts_receivable FOR EACH ROW EXECUTE FUNCTION synchronize_commitment_settlement();

CREATE TABLE financial_series (
 id UUID PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 spec JSONB NOT NULL,
 cancelled BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX financial_series_owner ON financial_series(user_id,cancelled);

CREATE TABLE financial_audit (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 entity_kind TEXT NOT NULL,
 entity_id UUID NOT NULL,
 before JSONB,
 after JSONB NOT NULL,
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX financial_audit_owner_date ON financial_audit(user_id,created_at,id);
CREATE FUNCTION audit_financial_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO financial_audit(user_id,entity_kind,entity_id,before,after)
 VALUES(NEW.user_id,TG_TABLE_NAME,NEW.id,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW));
 RETURN NEW;
END $$;
CREATE TRIGGER financial_account_audit AFTER INSERT OR UPDATE ON financial_accounts FOR EACH ROW EXECUTE FUNCTION audit_financial_change();
CREATE TRIGGER income_audit AFTER INSERT OR UPDATE ON incomes FOR EACH ROW EXECUTE FUNCTION audit_financial_change();
CREATE TRIGGER expense_audit AFTER INSERT OR UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION audit_financial_change();
CREATE TRIGGER transfer_audit AFTER INSERT OR UPDATE ON transfers FOR EACH ROW EXECUTE FUNCTION audit_financial_change();

COMMIT;
