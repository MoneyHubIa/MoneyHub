# AI Context Builder (TASK-013) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the backend AI Context Builder service and its GraphQL query (`aiFinancialContext`), safely aggregating financial totals, top expense categories, and upcoming bills scoped by authenticated user with zero `any`.

**Architecture:** A decoupled service in `apps/backend/src/ai-context-builder.ts` with an injectable repository contract `AiContextRepository`, wired into Apollo Server schema and resolvers in `apps/backend/src/graphql.ts`. Prisma queries enforce `userId` and `deletedAt: null`.

**Tech Stack:** TypeScript 5.x, Node.js (native test runner), Apollo Server 5 / GraphQL 16, Prisma 7 with PostgreSQL.

## Global Constraints
- Proibição absoluta de `any` (TypeScript strictly typed: use `unknown` with narrowing, explicit types/interfaces).
- Multi-tenant isolation by authenticated user ID (`requireVerifiedUserId(context)`).
- Formatting of monetary amounts as fixed 2-decimal strings (`"0.00"`).

---

### Task 1: Create AI Context Builder service and unit tests

**Files:**
- Create: `apps/backend/src/ai-context-builder.ts`
- Create: `apps/backend/tests/ai-context-builder.test.ts`

**Interfaces:**
- Consumes: `requireVerifiedUserId` from `apps/backend/src/financial-categories.ts`, `GraphQLContext` from `apps/backend/src/graphql.ts`, `getPrismaClient` from `apps/backend/src/database.ts`.
- Produces:
  - `AiFinancialTotals`, `AiTopCategory`, `AiUpcomingBill`, `AiFinancialContext`, `AiFinancialContextInput`
  - `AiContextRepository`, `aiContextRepository(): AiContextRepository`
  - `buildAiFinancialContext(context: GraphQLContext, input: AiFinancialContextInput | undefined, repository: AiContextRepository): Promise<AiFinancialContext>`

- [ ] **Step 1: Write the failing unit tests**

Create `apps/backend/tests/ai-context-builder.test.ts` covering:
- Correct computation of totals (`income`, `expenses`, `balance`)
- Top expense categories ordering and percentages
- Upcoming bills filtering and chronological sorting
- Empty data / zero transactions month (no NaN or division by zero)
- Currency resolution from user profile (fallback to `BRL`)
- Validation errors for invalid month, year, or days ahead
- Authorization checks (unauthenticated and unverified email)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @moneyhub/backend -- tests/ai-context-builder.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `apps/backend/src/ai-context-builder.ts`**

Implement types, input validation, `aiContextRepository` backed by Prisma, and `buildAiFinancialContext`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @moneyhub/backend -- tests/ai-context-builder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/ai-context-builder.ts apps/backend/tests/ai-context-builder.test.ts
git commit -m "feat(ai): implement AI financial context builder service and unit tests (TASK-013)"
```

---

### Task 2: Expose `aiFinancialContext` in GraphQL schema and resolvers

**Files:**
- Modify: `apps/backend/src/graphql.ts`
- Modify: `apps/backend/tests/ai-context-builder.test.ts`

**Interfaces:**
- Consumes: `buildAiFinancialContext`, `aiContextRepository`, `AiFinancialContextInput` from `./ai-context-builder.js`.
- Produces:
  - GraphQL types `AiFinancialTotals`, `AiTopCategory`, `AiUpcomingBill`, `AiFinancialContext`, `input AiFinancialContextInput`
  - Query resolver `Query.aiFinancialContext`

- [ ] **Step 1: Add GraphQL schema test in `ai-context-builder.test.ts`**

Add assertion verifying that `typeDefs` contains `aiFinancialContext(input: AiFinancialContextInput): AiFinancialContext!` and related types.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @moneyhub/backend -- tests/ai-context-builder.test.ts`
Expected: FAIL (regex match failed on typeDefs).

- [ ] **Step 3: Update `apps/backend/src/graphql.ts`**

Add type definitions and resolver to Apollo schema.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -w @moneyhub/backend`
Run: `npm run typecheck -w @moneyhub/backend`
Expected: All tests PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/graphql.ts apps/backend/tests/ai-context-builder.test.ts
git commit -m "feat(graphql): expose aiFinancialContext query and schema (TASK-013)"
```

---

### Task 3: Update task documentation and run full regression suite

**Files:**
- Modify: `docs/tasks/TASK_INDEX.md`
- Modify: `docs/tasks/EPIC-05_AI_AGENT.md`

- [ ] **Step 1: Update task status**

Mark `TASK-013` as Done in `docs/tasks/TASK_INDEX.md` and `docs/tasks/EPIC-05_AI_AGENT.md`.

- [ ] **Step 2: Run full backend and frontend regression tests**

Run: `npm test -w @moneyhub/backend`
Run: `npm test -w @moneyhub/frontend`
Expected: All existing and new tests pass.

- [ ] **Step 3: Commit**

```bash
git add docs/tasks/TASK_INDEX.md docs/tasks/EPIC-05_AI_AGENT.md
git commit -m "docs: mark TASK-013 as done in task index and EPIC-05"
```
