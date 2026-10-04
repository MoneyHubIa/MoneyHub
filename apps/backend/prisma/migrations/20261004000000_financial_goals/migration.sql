CREATE TABLE "financial_goals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500),
  "target_amount" DECIMAL(14,2) NOT NULL,
  "accumulated_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "start_date" DATE NOT NULL,
  "deadline" DATE NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "financial_goals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_goals_positive_target" CHECK ("target_amount" > 0),
  CONSTRAINT "financial_goals_nonnegative_balance" CHECK ("accumulated_amount" >= 0),
  CONSTRAINT "financial_goals_date_order" CHECK ("deadline" >= "start_date"),
  CONSTRAINT "financial_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "financial_goal_movements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "goal_id" UUID NOT NULL,
  "type" VARCHAR(20) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "occurred_on" DATE NOT NULL,
  "notes" VARCHAR(500),
  "operation_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_goal_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_goal_movements_positive_amount" CHECK ("amount" > 0),
  CONSTRAINT "financial_goal_movements_valid_type" CHECK ("type" IN ('CONTRIBUTION', 'WITHDRAWAL')),
  CONSTRAINT "financial_goal_movements_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "financial_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "financial_goals_user_id_deleted_at_deadline_idx" ON "financial_goals"("user_id", "deleted_at", "deadline");
CREATE UNIQUE INDEX "financial_goal_movements_goal_id_operation_id_key" ON "financial_goal_movements"("goal_id", "operation_id");
CREATE INDEX "financial_goal_movements_goal_id_created_at_id_idx" ON "financial_goal_movements"("goal_id", "created_at", "id");
