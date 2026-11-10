CREATE TABLE ai_operation_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','EXECUTING','COMPLETED','PARTIAL','FAILED','CANCELLED','EXPIRED')),
  confirmed_at timestamptz(3),
  expires_at timestamptz(3) NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(3) NOT NULL,
  UNIQUE (id, user_id)
);
CREATE INDEX ai_operation_plans_user_id_created_at_idx ON ai_operation_plans(user_id, created_at);

CREATE TABLE ai_operations (
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL,
  user_id uuid NOT NULL,
  position integer NOT NULL CHECK (position >= 0 AND position < 20),
  key varchar(60) NOT NULL,
  operation varchar(80) NOT NULL,
  title varchar(300) NOT NULL,
  arguments jsonb NOT NULL CHECK (jsonb_typeof(arguments) = 'object'),
  details jsonb NOT NULL CHECK (jsonb_typeof(details) = 'array'),
  snapshots jsonb NOT NULL CHECK (jsonb_typeof(snapshots) = 'array'),
  status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SUCCEEDED','FAILED','BLOCKED')),
  result jsonb,
  error varchar(1000),
  created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(3) NOT NULL,
  FOREIGN KEY (plan_id, user_id) REFERENCES ai_operation_plans(id, user_id) ON DELETE CASCADE,
  UNIQUE (plan_id, position),
  UNIQUE (plan_id, key)
);
CREATE INDEX ai_operations_user_id_status_idx ON ai_operations(user_id, status);
