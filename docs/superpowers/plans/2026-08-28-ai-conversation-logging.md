# AI Conversation Logging (TASK-033) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the AI conversation logging audit service, the end-to-end AI assistant orchestrator, and GraphQL mutation `askAiAssistant`, concluding EPIC-05 with zero `any`.

**Architecture:** A resilient audit logger in `apps/backend/src/ai-conversation-logging.ts`, an orchestrating service in `apps/backend/src/ai-service.ts` integrating Context Builder, Prompt Registry, LLM Adapter, and Conversation Logger, exposed via Apollo Server in `apps/backend/src/graphql.ts`.

**Tech Stack:** TypeScript 5.x, Node.js (crypto for SHA-256, test runner), Apollo Server 5 / GraphQL 16, Pino.

## Global Constraints
- Proibição absoluta de `any` (TypeScript strictly typed: use `unknown` with narrowing, explicit types/interfaces).
- No secrets, API keys, or raw confidential financial tables leaked in logs.
- Logging failures must never block or fail the user-facing AI response.
- Scoped strictly by authenticated user ID (`requireVerifiedUserId(context)`).

---

### Task 1: Create AI Conversation Logging module and unit tests

**Files:**
- Create: `apps/backend/src/ai-conversation-logging.ts`
- Create: `apps/backend/tests/ai-conversation-logging.test.ts`

**Interfaces:**
- Consumes: `AiFinancialContext` from `apps/backend/src/ai-context-builder.js`, `appLogger` from `apps/backend/src/http-logger.js`
- Produces:
  - `AiConversationSuccessEvent`, `AiConversationErrorEvent`, `AiConversationAuditEvent`
  - `AiConversationLogger`, `createAiConversationLogger`, `defaultAiConversationLogger`
  - `hashContext(context: AiFinancialContext): string`

- [ ] **Step 1: Write failing unit tests**

Create `apps/backend/tests/ai-conversation-logging.test.ts` verifying:
- `hashContext` generates deterministic SHA-256 hash
- `log` logs success event via `logger.info`
- `log` logs error event via `logger.error`
- `log` swallows internal logger exceptions without throwing

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/ai-conversation-logging.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `apps/backend/src/ai-conversation-logging.ts`**

Implement types, `hashContext`, and `createAiConversationLogger`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/ai-conversation-logging.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/ai-conversation-logging.ts apps/backend/tests/ai-conversation-logging.test.ts docs/superpowers/plans/2026-08-28-ai-conversation-logging.md
git commit -m "feat(ai): implement AI conversation logging and audit hash (TASK-033)"
```

---

### Task 2: Implement AI Service orchestrator, GraphQL mutation, and tests

**Files:**
- Create: `apps/backend/src/ai-service.ts`
- Modify: `apps/backend/src/graphql.ts`
- Create: `apps/backend/tests/ai-service.test.ts`

**Interfaces:**
- Consumes: `buildAiFinancialContext`, `buildAiPrompt`, `createLlmAdapter`, `defaultAiConversationLogger`, `GraphQLContext`
- Produces:
  - `AskAiAssistantInput`, `AiAssistantResponse`, `askAiAssistant`
  - GraphQL mutation `askAiAssistant(input: AskAiAssistantInput!): AiAssistantResponse!`

- [ ] **Step 1: Write failing tests for AI service and GraphQL wiring**

Create `apps/backend/tests/ai-service.test.ts` covering:
- GraphQL schema contains `askAiAssistant` mutation and types
- Full flow with authenticated user returning structured response
- Rejection of unauthenticated or unverified users
- LLM error handling: logs error audit event and throws `SERVICE_UNAVAILABLE`
- Logger error resilience: response succeeds even if logger throws

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/ai-service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `ai-service.ts` and wire into `graphql.ts`**

Create `apps/backend/src/ai-service.ts` and add mutation to `apps/backend/src/graphql.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/ai-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/ai-service.ts apps/backend/src/graphql.ts apps/backend/tests/ai-service.test.ts
git commit -m "feat(ai): implement askAiAssistant orchestrator and GraphQL mutation (TASK-033)"
```

---

### Task 3: Typecheck, task documentation, and full regression tests

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

- [ ] **Step 4: Update task documentation and mark EPIC-05 as Done**

Mark `TASK-033` as Done in `docs/tasks/TASK_INDEX.md` and `docs/tasks/EPIC-05_AI_AGENT.md`, and update EPIC-05 status to `Done`.

- [ ] **Step 5: Commit**

```bash
git add docs/tasks/TASK_INDEX.md docs/tasks/EPIC-05_AI_AGENT.md
git commit -m "docs: mark TASK-033 and EPIC-05 as done"
```
