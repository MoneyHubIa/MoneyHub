ALTER TABLE "accounts_payable"
ADD COLUMN "reminder_offset_days" SMALLINT;

ALTER TABLE "accounts_payable"
ADD CONSTRAINT "accounts_payable_reminder_offset_days_check"
CHECK ("reminder_offset_days" IN (0, 1, 3, 7));

ALTER TABLE "accounts_receivable"
ADD COLUMN "reminder_offset_days" SMALLINT;

ALTER TABLE "accounts_receivable"
ADD CONSTRAINT "accounts_receivable_reminder_offset_days_check"
CHECK ("reminder_offset_days" IN (0, 1, 3, 7));

ALTER TABLE "calendar_events"
ADD COLUMN "reminder_offset_days" SMALLINT;

ALTER TABLE "calendar_events"
ADD CONSTRAINT "calendar_events_reminder_offset_days_check"
CHECK ("reminder_offset_days" IN (0, 1, 3, 7));

CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "source_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "occurrence_date" DATE NOT NULL,
    "reminder_date" DATE NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notifications_user_id_source_source_id_occurrence_date_key"
      UNIQUE ("user_id", "source", "source_id", "occurrence_date")
);

CREATE INDEX "notifications_user_id_read_at_reminder_date_idx"
ON "notifications"("user_id", "read_at", "reminder_date");

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
