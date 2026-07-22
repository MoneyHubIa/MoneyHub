# Authentication Contract Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate that `TASK-008` remains Done only because the authentication specification now fixes every identity contract requested by the branch review.

**Architecture:** Treat `docs/specs/AUTHENTICATION_SPEC.md` as the identity source of truth and validate it against the task status documents and the execution-guide objective. This is a documentation-only change; it does not implement Firebase, GraphQL, database, or application code.

**Tech Stack:** Markdown, Git, PowerShell, ripgrep.

## Global Constraints

- `TASK-008` must remain `Done` in `docs/tasks/TASK_INDEX.md` and checked in `docs/tasks/EPIC-02_AUTHENTICATION.md`.
- Completion criteria must describe specification completeness, not future implementation completion.
- The contract must leave no profile-bootstrap or email-verification identity rule to future tasks.
- Do not modify application code or claim that Firebase and GraphQL flows are implemented.

---

### Task 1: Verify Authentication Contract Coverage

**Files:**
- Inspect: `docs/specs/AUTHENTICATION_SPEC.md`

**Interfaces:**
- Consumes: The branch-review requirements for verification gating, sensitive-operation blocking, Firebase synchronization, authenticated context, GraphQL profile bootstrap, idempotency, minimum fields, and incomplete local state.
- Produces: Evidence that each required contract is explicit in the identity source of truth.

- [x] **Step 1: Verify the email-verification contract terms**

Run:

```powershell
rg -n "emailVerified|EMAIL_NOT_VERIFIED|email_verified_at|bootstrap allowlist|financial data|AI assistant" docs/specs/AUTHENTICATION_SPEC.md
```

Expected: matches cover the authorization gate, allowlist, sensitive product areas, stable error code, local projection, and authenticated-context field.

- [x] **Step 2: Verify the profile-bootstrap contract terms**

Run:

```powershell
rg -n "bootstrapProfile|BootstrapProfileInput|created: Boolean|fullName|preferredCurrency|ProfileTheme|IDENTITY_EMAIL_CONFLICT|Concurrent calls|profileId: string \| null" docs/specs/AUTHENTICATION_SPEC.md
```

Expected: matches cover the GraphQL mutation and payload, minimum fields and defaults, conflict behavior, concurrency, idempotency, and missing-profile context.

- [x] **Step 3: Verify identity persistence relationships**

Run:

```powershell
rg -n "users\.firebase_uid|users\.email|profiles\.user_id|foreign key to `users\.id`|at most one profile" docs/specs/AUTHENTICATION_SPEC.md
```

Expected: matches define unique Firebase UID and normalized email constraints plus the one-to-one `profiles.user_id -> users.id` relationship.

### Task 2: Verify Done Status Semantics

**Files:**
- Inspect: `docs/specs/AUTHENTICATION_SPEC.md`
- Inspect: `docs/tasks/TASK_INDEX.md`
- Inspect: `docs/tasks/EPIC-02_AUTHENTICATION.md`
- Inspect: `docs/planning/TASK_EXECUTION_GUIDE.md`

**Interfaces:**
- Consumes: The completed specification from Task 1.
- Produces: Evidence that Done means the identity contract is complete while implementation remains assigned to future tasks.

- [x] **Step 1: Confirm status documents agree**

Run:

```powershell
rg -n "TASK-008" docs/tasks/TASK_INDEX.md docs/tasks/EPIC-02_AUTHENTICATION.md
```

Expected: the task index reports `Done` and the epic line uses `[x]`.

- [x] **Step 2: Confirm no unchecked implementation-style criteria remain**

Run:

```powershell
rg -n "\[ \]" docs/specs/AUTHENTICATION_SPEC.md
```

Expected: exit code 1 with no matches.

- [x] **Step 3: Confirm completion criteria describe documentation**

Run:

```powershell
rg -n "Specification Completion Criteria|certify that `TASK-008`|do not claim" docs/specs/AUTHENTICATION_SPEC.md
```

Expected: matches explicitly distinguish fixed contracts from pending implementation.

- [x] **Step 4: Compare the specification with the execution-guide objective**

Run:

```powershell
rg -n "registro|login|verificacao de e-mail|recuperacao de senha|token Firebase|perfil|limites de autorizacao" docs/planning/TASK_EXECUTION_GUIDE.md
```

Expected: the guide's complete `TASK-008` objective is present and every named area has a corresponding contract in `AUTHENTICATION_SPEC.md`.

### Task 3: Run Final Documentation Checks

**Files:**
- Verify: `docs/specs/AUTHENTICATION_SPEC.md`
- Verify: `docs/superpowers/plans/2026-07-22-authentication-contract-validation.md`

**Interfaces:**
- Consumes: Validation evidence from Tasks 1 and 2.
- Produces: A clean final diff and an auditable handoff summary.

- [x] **Step 1: Scan for placeholders and ambiguous deferred decisions**

Run:

```powershell
rg -n "T[B]D|T[O]DO|optionall[y]|equivalen[t]|specific GraphQ[L]|future decisio[n]" docs/specs/AUTHENTICATION_SPEC.md docs/superpowers/plans/2026-07-22-authentication-contract-validation.md
```

Expected: exit code 1 with no matches.

- [x] **Step 2: Check whitespace and patch integrity**

Run:

```powershell
git diff --check HEAD~1..HEAD
```

Expected: exit code 0 with no output.

- [x] **Step 3: Inspect the final scope**

Run:

```powershell
git status --short
git diff --stat HEAD~1..HEAD
```

Expected: only intentional documentation changes are present; no application source files appear.
