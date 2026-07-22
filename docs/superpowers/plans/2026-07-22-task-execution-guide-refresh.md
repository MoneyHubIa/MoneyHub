# Task Execution Guide Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the task execution guide to reflect the merged authentication planning tasks and direct the team toward the missing GraphQL and Expo foundation tasks.

**Architecture:** Replace the stale execution flow in one documentation file while preserving the current task catalog as the status authority. The new guide separates immediately executable documentation work, mandatory backlog correction, and implementation work that remains blocked.

**Tech Stack:** Markdown, Git, ripgrep

## Global Constraints

- Modify only `docs/planning/TASK_EXECUTION_GUIDE.md`.
- Do not assign identifiers to the missing GraphQL and Expo implementation tasks.
- Do not modify `docs/tasks/TASK_INDEX.md` or create task files.
- Keep all referenced existing-task statuses consistent with `docs/tasks/TASK_INDEX.md`.
- Do not claim that GraphQL, Expo, Firebase, PostgreSQL, or cloud infrastructure has been implemented.

---

### Task 1: Refresh the execution guide

**Files:**
- Modify: `docs/planning/TASK_EXECUTION_GUIDE.md`
- Reference: `docs/tasks/TASK_INDEX.md`
- Reference: `docs/superpowers/specs/2026-07-22-task-execution-guide-refresh-design.md`

**Interfaces:**
- Consumes: task statuses from `TASK_INDEX.md` and constraints from the approved design.
- Produces: a single current execution flow for selecting the next task.

- [ ] **Step 1: Verify the stale guide state**

Run:

```powershell
rg -n "proxima task obrigatoria e `TASK-008`|TASK-010.*Planejar|TASK-011.*Planejar" docs/planning/TASK_EXECUTION_GUIDE.md
```

Expected: matches showing that `TASK-008`, `TASK-010`, and `TASK-011` are still presented as future work.

- [ ] **Step 2: Replace the guide with the approved execution structure**

Keep the existing purpose and start-rule sections, but make these exact semantic changes:

```markdown
## Estado Atual

- `TASK-001` ate `TASK-008`, `TASK-010` e `TASK-011` estao concluidas.
- `EPIC-01` permanece pendente porque GraphQL e Expo foram planejados, mas ainda nao implementados.
- Nenhuma task esta em andamento.
- `TASK-012` e `TASK-043` sao as proximas tasks existentes liberadas e podem avancar em paralelo.

## Correcao Obrigatoria do Backlog

Antes de iniciar tasks de implementacao dependentes da fundacao alvo, criar no catalogo:

1. Uma task para implementar a fundacao Node.js, Express e Apollo Server GraphQL.
2. Uma task para implementar a fundacao React Native, Expo e Expo Router.

Este guia nao atribui numeros a essas tasks. A numeracao deve ser definida quando o catalogo for atualizado.

## Proxima Onda

| Task | Objetivo | Dependencias concluidas | Pode executar em paralelo |
| --- | --- | --- | --- |
| `TASK-012` | Planejar GCP, Cloud Run, Cloud SQL, Secret Manager e Resend | `TASK-006`, `TASK-007`, `TASK-008` | Sim, com `TASK-043` |
| `TASK-043` | Documentar Firebase Auth e Analytics | `TASK-008`, `TASK-011` | Sim, com `TASK-012` |

`TASK-044` permanece bloqueada ate a conclusao da `TASK-012`.
```

Preserve and update the blocked-work tables so they state:

```markdown
- `TASK-009` aguarda a nova fundacao Expo.
- `TASK-017`, `TASK-034` e `TASK-040` aguardam a nova fundacao GraphQL.
- `TASK-035`, `TASK-041` e `TASK-042` aguardam a nova fundacao Expo.
- `TASK-015`, `TASK-036` e `TASK-037` aguardam fundacoes e fluxos integrados estaveis.
- Tasks financeiras, dashboards, agenda e IA aguardam autenticacao, autorizacao e persistencia GraphQL estaveis.
```

End with this dependency summary:

```text
Agora:
  TASK-012 --------> TASK-044
  TASK-043

Correcao do backlog:
  criar task GraphQL --> implementar fundacao GraphQL
  criar task Expo ----> implementar fundacao Expo --> TASK-009
```

- [ ] **Step 3: Validate status and reference consistency**

Run:

```powershell
rg -n "TASK-008|TASK-010|TASK-011|TASK-012|TASK-043|TASK-044|GraphQL|Expo" docs/planning/TASK_EXECUTION_GUIDE.md
```

Expected: completed tasks appear only as completed or as satisfied dependencies; `TASK-012` and `TASK-043` appear as next work; missing foundation tasks have no invented identifiers.

Run:

```powershell
rg -n "proxima task obrigatoria e `TASK-008`|Execute primeiro:.*TASK-008|TASK-010.*pode.*execut" docs/planning/TASK_EXECUTION_GUIDE.md
```

Expected: no matches.

- [ ] **Step 4: Validate formatting and scope**

Run:

```powershell
git diff --check
git diff --name-only HEAD
```

Expected: `git diff --check` reports no errors and the only implementation file listed is `docs/planning/TASK_EXECUTION_GUIDE.md`.

- [ ] **Step 5: Commit the guide update**

```powershell
git add docs/planning/TASK_EXECUTION_GUIDE.md
git commit -m "docs: refresh task execution guide"
```
