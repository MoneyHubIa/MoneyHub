# Task Catalog Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile task identifiers, completion statuses, architecture descriptions, commands, and environment examples without starting implementation work or creating product tasks.

**Architecture:** Treat `docs/tasks/TASK_INDEX.md` as the canonical task registry and align each epic with it. Clearly separate the current REST/Vite foundation from the target GraphQL/Expo foundation, while documenting enough platform strategy to close the two completed planning tasks.

**Tech Stack:** Markdown, dotenv example files, PowerShell validation, npm/Jest/ESLint/Vite verification.

---

### Task 1: Reconcile completed planning tasks and task identifiers

**Files:**
- Modify: `docs/tasks/TASK_INDEX.md`
- Modify: `docs/tasks/EPIC-01_FOUNDATION.md`
- Modify: `docs/tasks/EPIC-03_FINANCIAL_MANAGEMENT.md`
- Modify: `docs/tasks/EPIC-04_DASHBOARDS.md`
- Modify: `docs/tasks/EPIC-05_AI_AGENT.md`
- Modify: `docs/tasks/EPIC-06_AGENDA.md`

- [x] **Step 1: Mark only the reviewed planning tasks as complete**

In `TASK_INDEX.md`, change TASK-006 and TASK-007 from `Pending` to `Done`.

In `EPIC-01_FOUNDATION.md`, keep the epic status `Pending`, change the two task statuses to `Done`, and add a completion-review note explaining that only planning is complete and implementation remains outside these tasks.

- [x] **Step 2: Apply the canonical identifiers**

Use this mapping without changing task scope:

```text
EPIC-03
TASK-021 Implement financial categories
TASK-022 Implement income and expenses
TASK-024 Implement cost centers
TASK-025 Implement accounts payable
TASK-026 Implement accounts receivable
TASK-027 Implement recurring transactions

EPIC-04
TASK-023 Implement dashboard summary
TASK-028 Implement cash-flow chart data
TASK-029 Implement category analysis
TASK-030 Implement period comparison

EPIC-05
TASK-013 Implement AI context builder
TASK-031 Implement AI prompt registry
TASK-032 Implement LLM adapter contract
TASK-033 Implement AI conversation logging

EPIC-06
TASK-014 Implement agenda foundation
TASK-045 Implement financial reminders
TASK-046 Implement notification center
TASK-047 Implement recurring events
```

Add every mapped task to `TASK_INDEX.md` as `Pending`. Do not change TASK-034 through TASK-044.

- [x] **Step 3: Verify registry consistency**

Run:

```powershell
$rows = Get-Content docs\tasks\TASK_INDEX.md | Where-Object { $_ -match '^\| TASK-' }
$ids = $rows | ForEach-Object { [regex]::Match($_, 'TASK-\d+').Value }
$duplicates = $ids | Group-Object | Where-Object Count -gt 1
$duplicates
$rows.Count
```

Expected: no duplicate output and row count `47`.

- [x] **Step 4: Commit the task registry correction**

```powershell
git add docs/tasks/TASK_INDEX.md docs/tasks/EPIC-01_FOUNDATION.md docs/tasks/EPIC-03_FINANCIAL_MANAGEMENT.md docs/tasks/EPIC-04_DASHBOARDS.md docs/tasks/EPIC-05_AI_AGENT.md docs/tasks/EPIC-06_AGENDA.md
git commit -m "docs: reconcile task catalog and planning status"
```

### Task 2: Align current and target foundation documentation

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `docs/architecture/SYSTEM_ARCHITECTURE.md`
- Modify: `docs/development/ENVIRONMENT_VARIABLES.md`
- Modify: `docs/specs/FOUNDATION_SPEC.md`

- [x] **Step 1: Make current and target states explicit**

Update `README.md` so the monorepo tree and runnable command use the current names:

```text
apps/
  backend/
  frontend/
```

```text
npm run dev:backend
npm run dev:frontend
```

Label React/Vite and REST as the current foundation. Label Expo, GraphQL, Firebase, GCP, and Resend as the approved target foundation. State that migration implementation has not started.

- [x] **Step 2: Document the Analytics platform boundary**

Add an `Analytics Strategy` section to `SYSTEM_ARCHITECTURE.md`:

```text
- Application code emits analytics events through one internal adapter contract.
- Web uses a Firebase Analytics web adapter and checks runtime support before initialization.
- iOS and Android use a native Firebase Analytics adapter through an Expo-compatible development build.
- Unsupported environments use a no-op adapter; analytics failures never block financial workflows.
- Unit tests mock the adapter and do not contact Firebase.
```

This closes the final TASK-007 acceptance criterion without implementing the adapter.

- [x] **Step 3: Synchronize the environment example**

Replace legacy Supabase and application-managed JWT variables in `.env.example` with the variables listed in `ENVIRONMENT_VARIABLES.md`. Retain `NODE_ENV`, `PORT`, `FRONTEND_URL`, `DATABASE_URL`, rate-limit variables, and AI variables.

The resulting target keys are:

```dotenv
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
GRAPHQL_ENDPOINT=http://localhost:3000/graphql
FIREBASE_PROJECT_ID=
GOOGLE_APPLICATION_CREDENTIALS=
DATABASE_URL=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
EXPO_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:3000/graphql
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=
LLM_PROVIDER=
LLM_API_KEY=
LLM_MODEL=
```

Update `ENVIRONMENT_VARIABLES.md` to label target-only variables as planned until the migration is implemented.

- [x] **Step 4: Clarify the foundation completion boundary**

In `FOUNDATION_SPEC.md`, state that it describes the target foundation. Add a current-state note explaining that the REST/Vite scaffold remains operational and the epic stays pending until GraphQL and Expo acceptance criteria are implemented.

- [x] **Step 5: Verify documentation alignment**

Run:

```powershell
rg -n "apps/app|dev:app|SUPABASE_|JWT_ACCESS_|JWT_REFRESH_|API_BASE_URL" README.md .env.example docs
```

Expected: no stale current-foundation references. Historical wording that explicitly describes replacement of REST/Vite is allowed.

- [x] **Step 6: Commit the foundation documentation correction**

```powershell
git add README.md .env.example docs/architecture/SYSTEM_ARCHITECTURE.md docs/development/ENVIRONMENT_VARIABLES.md docs/specs/FOUNDATION_SPEC.md
git commit -m "docs: align current and target foundation"
```

### Task 3: Run final verification

**Files:**
- Verify: `docs/tasks/*.md`
- Verify: `README.md`
- Verify: `.env.example`
- Verify: existing application source and tests

- [x] **Step 1: Check formatting and unresolved markers**

Run:

```powershell
git diff --check HEAD~2..HEAD
rg -n "TODO|TBD|FIXME" README.md .env.example docs
```

Expected: no whitespace errors and no unresolved markers.

- [x] **Step 2: Run the current foundation tests**

Run:

```powershell
npm.cmd test
```

Expected: 2 test suites and 3 tests pass.

- [x] **Step 3: Run lint**

Run:

```powershell
npm.cmd run lint
```

Expected: exit code 0 with no ESLint errors.

- [x] **Step 4: Run the current frontend build**

Run:

```powershell
npm.cmd run build -w apps/frontend
```

Expected: Vite production build exits with code 0.

- [x] **Step 5: Confirm final scope**

Run:

```powershell
git status --short --branch
git log --oneline -3
```

Expected: `main` contains only the approved design, plan, and reconciliation documentation commits; no product implementation task has started.
