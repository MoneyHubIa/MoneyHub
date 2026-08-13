# Operational Documentation Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile current MoneyHub operational documentation with the completed Firebase Auth REST password-recovery implementation and fresh verification evidence.

**Architecture:** Treat executable code and the 2026-08-13 verification results as the source of truth. Update current operational documents by responsibility while preserving historical records under `docs/superpowers/`. Validate prose through targeted consistency scans and `git diff --check`; do not add source-text tests for human documentation.

**Tech Stack:** Markdown, ripgrep, Git, MoneyHub Node.js/TypeScript/Expo documentation.

## Global Constraints

- Modify only `README.md`, `docs/architecture/`, `docs/development/`, `docs/planning/`, `docs/specs/`, and `docs/tasks/`.
- Do not modify historical plans or design records under `docs/superpowers/`.
- Record exact counts: 72 backend tests, 104 frontend tests, and 176 monorepo tests.
- Keep `TASK-019` and `EPIC-02` as `In Progress (real smoke pending)`.
- Keep shared multi-instance rate limiting and trusted-proxy verification in EPIC-08.
- Describe current limiter as an in-process sliding window, not production-shared enforcement.
- Do not claim real Firebase smoke acceptance.
- Persisted documentation uses normal, explicit prose rather than Caveman chat style.

---

### Task 1: Reconcile architecture and developer operations

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture/API_SPECIFICATION.md`
- Modify: `docs/architecture/SECURITY_ARCHITECTURE.md`
- Modify: `docs/architecture/SYSTEM_ARCHITECTURE.md`
- Modify: `docs/development/ENVIRONMENT_VARIABLES.md`
- Modify: `docs/development/TESTING_STRATEGY.md`
- Modify: `docs/specs/AUTHENTICATION_SPEC.md`

**Interfaces:**
- Consumes: backend routes in `apps/backend/src/app.ts`, REST adapter in `apps/backend/src/firebase-auth-rest.ts`, service in `apps/backend/src/password-recovery.ts`, frontend client/screens, and fresh gate evidence.
- Produces: current architecture, API, security, environment, testing, and identity documentation.

- [ ] **Step 1: Capture current implementation contracts**

Run:

```powershell
rg -n "password-recovery|SlidingWindow|requestId|provider/timeout|RECOVERY_UNAVAILABLE|RATE_LIMITED|INVALID_OR_EXPIRED_ACTION_CODE" apps/backend/src apps/frontend/src
```

Confirm these literal facts before editing:

- three backend endpoints: request, verify, confirm;
- rolling limits `5/10/10` over 15 minutes;
- 16 KiB request bodies and 10-second abortable Firebase requests;
- accepted `x-request-id` format `[A-Za-z0-9._-]`, length 1-128, otherwise UUID;
- temporary frontend errors remain retryable; only invalid/expired codes invalidate the link;
- successful confirmation signs out local session.

- [ ] **Step 2: Update README and architecture documents**

Ensure README configuration uses:

```dotenv
APP_URL=http://localhost:3000
FIREBASE_WEB_API_KEY=your_firebase_web_api_key
```

Document Firebase-managed recovery email, action URL `${APP_URL}/reset-password`,
authorized `APP_URL` domain, and Email Enumeration Protection. In architecture
documents, state that request initiation always returns account-neutral HTTP
`202`; verify/confirm use stable invalid-code, weak-password, rate-limit, and
temporary-unavailability codes. State limiter is sliding-window but in-process.

- [ ] **Step 3: Update security and authentication contracts**

Record that audits may contain only `requestId`, status, SHA-256 email hash for
initiation, and allowlisted provider code. Raw email, password, `oobCode`, token,
provider body, and API-key URL are prohibited. Record `x-request-id`
sanitization before response metadata, logs, GraphQL context, or recovery audit.

- [ ] **Step 4: Update testing strategy**

Document automated coverage for realistic Firebase detailed errors, action-code
input mapping, temporary UI retry, sliding-window boundary behavior, malicious
request IDs, missing service wiring, and backend-only frontend calls. Record
fresh gates:

```text
Backend: 72 tests
Frontend: 104 tests
Monorepo: 176 tests
Lint: pass
Typecheck: pass
Build: pass
Expo exports: Web, iOS, Android pass
```

- [ ] **Step 5: Validate Task 1 documents**

Run:

```powershell
rg -n "RESEND_API_KEY|RESEND_FROM_EMAIL|158 testes|62 testes|96 testes" README.md docs/architecture docs/development docs/specs
rg -n "72|104|176|FIREBASE_WEB_API_KEY|sliding|x-request-id|RECOVERY_UNAVAILABLE" README.md docs/architecture docs/development docs/specs
git diff --check -- README.md docs/architecture docs/development docs/specs
```

Expected: first scan has no stale operational matches; second scan shows the
new contracts; diff check exits 0.

- [ ] **Step 6: Commit Task 1**

```powershell
git add README.md docs/architecture docs/development docs/specs
git commit -m "docs: refresh password recovery operations"
```

---

### Task 2: Reconcile planning, task status, and final counts

**Files:**
- Modify: `docs/planning/BACKLOG.md`
- Modify: `docs/planning/ROADMAP.md`
- Modify: `docs/planning/TASK_EXECUTION_GUIDE.md`
- Modify: `docs/tasks/EPIC-02_AUTHENTICATION.md`
- Modify: `docs/tasks/EPIC-08_DEPLOY.md`
- Modify: `docs/tasks/TASK_INDEX.md`

**Interfaces:**
- Consumes: operational documentation from Task 1 and current smoke boundary.
- Produces: truthful planning status and reproducible remaining-work guidance.

- [ ] **Step 1: Update test counts and implementation summary**

Replace stale counts in `TASK_EXECUTION_GUIDE.md` with:

```markdown
| Backend | 72 testes, lint, typecheck e build passam |
| App | 104 testes, lint, typecheck e export Expo passam |
| Monorepo | 176 testes automatizados passam |
```

Describe implementation as Firebase REST backend-only with retryable temporary
failures, sliding-window local enforcement, safe audit, and sanitized request
IDs.

- [ ] **Step 2: Preserve open task and epic status**

Keep exact status:

```text
TASK-019 — In Progress (real smoke pending)
EPIC-02 — open until real Firebase smoke passes
```

List remaining smoke evidence: delivery/content, MoneyHub action URL, password
change, code non-reuse, old-password failure, new-password login, and
unknown-address parity.

- [ ] **Step 3: Preserve EPIC-08 ownership**

Document shared store and reviewed `trust proxy`/`X-Forwarded-For` behavior as
pre-deployment work. Do not describe the current in-process limiter as suitable
for multiple Cloud Run instances.

- [ ] **Step 4: Validate all current operational documents**

Run:

```powershell
rg -n "158 testes|62 testes|96 testes|RESEND_API_KEY|RESEND_FROM_EMAIL" README.md docs/architecture docs/development docs/planning docs/specs docs/tasks
rg -n "72 testes|104 testes|176 testes|real smoke pending|shared|trusted.proxy|sliding" docs/planning docs/tasks
git diff --check
git status --short
```

Expected: no stale counts or Resend configuration in current operational docs;
new counts and remaining gates are present; diff check exits 0; status contains
only intended documentation files.

- [ ] **Step 5: Commit Task 2**

```powershell
git add docs/planning docs/tasks
git commit -m "docs: reconcile password recovery status"
```

- [ ] **Step 6: Final documentation review**

Compare changed files against
`docs/superpowers/specs/2026-08-13-operational-documentation-refresh-design.md`.
Confirm every required reconciliation item has a current operational home and
no document claims `TASK-019`, `EPIC-02`, shared Cloud Run rate limiting, or real
Firebase smoke is complete.
