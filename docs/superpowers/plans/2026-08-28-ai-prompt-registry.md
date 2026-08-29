# AI Prompt Registry (TASK-031) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the backend AI Prompt Registry module providing versioned system prompts, structured financial context formatting with injection defenses, and typed template builders with zero `any`.

**Architecture:** A pure, deterministic service in `apps/backend/src/ai-prompt-registry.ts` exporting functions and templates, strictly typed, tested with Node test runner, and ready for consumption by LLM adapters.

**Tech Stack:** TypeScript 5.x, Node.js (native test runner), GraphQL error handling.

## Global Constraints
- Proibição absoluta de `any` (TypeScript strictly typed: use `unknown` with narrowing, explicit types/interfaces).
- No professional advice / compliance disclaimers strictly enforced in the system prompt.
- Protection against prompt injection via XML delimitation (`<financial_context>`, `<user_question>`).
- Enforce max 2000 chars and non-blank check on user queries.

---

### Task 1: Create AI Prompt Registry service and unit tests

**Files:**
- Create: `apps/backend/src/ai-prompt-registry.ts`
- Create: `apps/backend/tests/ai-prompt-registry.test.ts`

**Interfaces:**
- Consumes: `AiFinancialContext` from `apps/backend/src/ai-context-builder.js`
- Produces:
  - `PromptTemplateId` (`GENERAL_FINANCIAL_ASSISTANT`, `MONTHLY_SUMMARY`, `EXPENSE_OPTIMIZATION`)
  - `FormattedAiPrompt`, `BuildPromptOptions`
  - `getSystemPrompt(version?: string): string`
  - `formatFinancialContextBlock(context: AiFinancialContext): string`
  - `sanitizeUserMessage(message: string): string`
  - `buildAiPrompt(options: BuildPromptOptions): FormattedAiPrompt`

- [ ] **Step 1: Write failing unit tests**

Create `apps/backend/tests/ai-prompt-registry.test.ts` verifying:
- `getSystemPrompt` contains identity, compliance disclaimers, data insufficiency rules, and jailbreak defenses
- `buildAiPrompt` correctly wraps financial context in `<financial_context>` tags and user message in `<user_question>`
- Different templates (`GENERAL_FINANCIAL_ASSISTANT`, `MONTHLY_SUMMARY`, `EXPENSE_OPTIMIZATION`) inject specific instructions
- Graceful handling of empty categories or empty bills in context
- Rejection of empty or whitespace-only user questions with `BAD_USER_INPUT`
- Rejection of user questions longer than 2000 characters with `BAD_USER_INPUT`
- Sanitization of null bytes and control characters

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/ai-prompt-registry.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `apps/backend/src/ai-prompt-registry.ts`**

Implement types, system prompts, sanitization logic, context block formatter, and `buildAiPrompt`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/ai-prompt-registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/ai-prompt-registry.ts apps/backend/tests/ai-prompt-registry.test.ts docs/superpowers/plans/2026-08-28-ai-prompt-registry.md
git commit -m "feat(ai): implement AI prompt registry and unit tests (TASK-031)"
```

---

### Task 2: Typecheck, task documentation, and full regression tests

**Files:**
- Modify: `docs/tasks/TASK_INDEX.md`
- Modify: `docs/tasks/EPIC-05_AI_AGENT.md`

- [ ] **Step 1: Run typecheck**

Run: `npx tsc -p apps/backend/tsconfig.json --noEmit`
Expected: 0 errors, 0 `any`.

- [ ] **Step 2: Run backend tests**

Run: `node --import tsx --test tests/**/*.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Run frontend tests**

Run: `npx jest --runInBand`
Expected: 153/153 tests pass.

- [ ] **Step 4: Update task documentation**

Mark `TASK-031` as Done in `docs/tasks/TASK_INDEX.md` and `docs/tasks/EPIC-05_AI_AGENT.md`.

- [ ] **Step 5: Commit**

```bash
git add docs/tasks/TASK_INDEX.md docs/tasks/EPIC-05_AI_AGENT.md
git commit -m "docs: mark TASK-031 as done in task index and EPIC-05"
```
