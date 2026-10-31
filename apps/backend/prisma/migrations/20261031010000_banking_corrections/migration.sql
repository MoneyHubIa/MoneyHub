BEGIN;
SET LOCAL lock_timeout = '10s';
CREATE OR REPLACE FUNCTION resolve_financial_account() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.financial_account_id IS NULL THEN
  SELECT id INTO NEW.financial_account_id FROM financial_accounts WHERE user_id=NEW.user_id AND is_default AND NOT archived;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM financial_categories WHERE id=NEW.category_id AND user_id=NEW.user_id ) THEN
  RAISE EXCEPTION 'Category does not belong to user';
 END IF;
 IF TG_OP='INSERT' OR NEW.category_id IS DISTINCT FROM OLD.category_id THEN
  IF EXISTS(SELECT 1 FROM financial_categories WHERE id=NEW.category_id AND deleted_at IS NOT NULL) THEN
   RAISE EXCEPTION 'Category is deleted';
  END IF;
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
CREATE OR REPLACE FUNCTION synchronize_commitment_settlement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE realized boolean;
BEGIN
 IF TG_TABLE_NAME='accounts_payable' THEN
  IF NEW.card_statement_key IS NOT NULL THEN RETURN NEW; END IF;
 END IF;
 realized := NEW.deleted_at IS NULL AND NEW.status=CASE WHEN TG_TABLE_NAME='accounts_payable' THEN 'PAID' ELSE 'RECEIVED' END;
 IF TG_TABLE_NAME='accounts_payable' THEN
  IF realized THEN
   UPDATE expenses SET financial_account_id=NEW.financial_account_id,category_id=NEW.category_id,cost_center_id=NEW.cost_center_id,description=NEW.description,amount=NEW.amount,occurred_at=coalesce(NEW.paid_at,now()),deleted_at=NULL
   WHERE settlement_id=NEW.id AND user_id=NEW.user_id;
   IF NOT FOUND THEN
   INSERT INTO expenses(user_id,financial_account_id,category_id,cost_center_id,description,amount,occurred_at,settlement_id,updated_at)
   VALUES(NEW.user_id,NEW.financial_account_id,NEW.category_id,NEW.cost_center_id,NEW.description,NEW.amount,coalesce(NEW.paid_at,now()),NEW.id,now())
   ON CONFLICT(settlement_id) DO UPDATE SET financial_account_id=EXCLUDED.financial_account_id, category_id=EXCLUDED.category_id,cost_center_id=EXCLUDED.cost_center_id,description=EXCLUDED.description,amount=EXCLUDED.amount,occurred_at=EXCLUDED.occurred_at,deleted_at=NULL;
   END IF;
  ELSE UPDATE expenses SET deleted_at=now() WHERE settlement_id=NEW.id AND user_id=NEW.user_id;
  END IF;
 ELSE
  IF realized THEN
   UPDATE incomes SET financial_account_id=NEW.financial_account_id,category_id=NEW.category_id,cost_center_id=NEW.cost_center_id,description=NEW.description,amount=NEW.amount,occurred_at=coalesce(NEW.received_at,now()),deleted_at=NULL
   WHERE settlement_id=NEW.id AND user_id=NEW.user_id;
   IF NOT FOUND THEN
   INSERT INTO incomes(user_id,financial_account_id,category_id,cost_center_id,description,amount,occurred_at,settlement_id,updated_at)
   VALUES(NEW.user_id,NEW.financial_account_id,NEW.category_id,NEW.cost_center_id,NEW.description,NEW.amount,coalesce(NEW.received_at,now()),NEW.id,now())
   ON CONFLICT(settlement_id) DO UPDATE SET financial_account_id=EXCLUDED.financial_account_id,category_id=EXCLUDED.category_id,cost_center_id=EXCLUDED.cost_center_id,description=EXCLUDED.description,amount=EXCLUDED.amount,occurred_at=EXCLUDED.occurred_at,deleted_at=NULL;
   END IF;
  ELSE UPDATE incomes SET deleted_at=now() WHERE settlement_id=NEW.id AND user_id=NEW.user_id;
  END IF;
 END IF;
 RETURN NEW;
END $$;
COMMIT;
