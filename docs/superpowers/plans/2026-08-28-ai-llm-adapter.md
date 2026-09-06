# AI LLM Adapter Contract (TASK-032) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the backend LLM Adapter contract, supporting `MockLlmAdapter` for local development/testing, an `OpenAiCompatibleLlmAdapter` via native fetch, standardized errors, and factory with zero `any`.

**Architecture:** A decoupled service in `apps/backend/src/ai-llm-adapter.ts` defining `LlmAdapter`, `LlmResponse`, and error mapping `LlmAdapterError`, tested using native Node test runner.

**Tech Stack:** TypeScript 5.x, Node.js (native test runner, native fetch, AbortController).

## Global Constraints
- Proibição absoluta de `any` (TypeScript strictly typed: use `unknown` with narrowing, explicit types/interfaces).
- No API keys or credentials leaked in errors or logs.
- Safe fallback to `MockLlmAdapter` when no keys are configured.

---

### Task 1: Create LLM Adapter contract, implementations, and unit tests

**Files:**
- Create: `apps/backend/src/ai-llm-adapter.ts`
- Create: `apps/backend/tests/ai-llm-adapter.test.ts`

**Interfaces:**
- Consumes: `FormattedAiPrompt` from `apps/backend/src/ai-prompt-registry.js`
- Produces:
  - `LlmExecutionOptions`, `LlmUsage`, `LlmResponse`, `LlmAdapter`
  - `LlmAdapterError`
  - `MockLlmAdapter`, `OpenAiCompatibleLlmAdapter`, `createLlmAdapter`

- [ ] **Step 1: Write failing unit tests**

Create `apps/backend/tests/ai-llm-adapter.test.ts` verifying:
- `MockLlmAdapter` returns contextual financial answer with calculated usage and latency
- `MockLlmAdapter` supports `customResponder` and `simulatedError`
- `OpenAiCompatibleLlmAdapter` constructs chat completions payload correctly
- `OpenAiCompatibleLlmAdapter` maps 429 to `RATE_LIMIT` with retryable flag
- `OpenAiCompatibleLlmAdapter` maps 500/503 to `PROVIDER_ERROR` and redacts API key
- `OpenAiCompatibleLlmAdapter` handles timeout via AbortController
- `createLlmAdapter` returns `MockLlmAdapter` when provider is mock or missing key

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/ai-llm-adapter.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `apps/backend/src/ai-llm-adapter.ts`**

Implement types, `LlmAdapterError`, `MockLlmAdapter`, `OpenAiCompatibleLlmAdapter`, and `createLlmAdapter`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/ai-llm-adapter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/ai-llm-adapter.ts apps/backend/tests/ai-llm-adapter.test.ts docs/superpowers/plans/2026-08-28-ai-llm-adapter.md
git commit -m "feat(ai): implement LLM adapter contract and mock adapter (TASK-032)"
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

Mark `TASK-032` as Done in `docs/tasks/TASK_INDEX.md` and `docs/tasks/EPIC-05_AI_AGENT.md`.

- [ ] **Step 5: Commit**

```bash
git add docs/tasks/TASK_INDEX.md docs/tasks/EPIC-05_AI_AGENT.md
git commit -m "docs: mark TASK-032 as done in task index and EPIC-05"
```
