# Task Execution Guide Refresh Design

## Objective

Update `docs/planning/TASK_EXECUTION_GUIDE.md` so it reflects the tasks merged
into `main` and gives an executable direction for completing the target
foundation.

## Current-State Changes

- Record `TASK-008`, `TASK-010`, and `TASK-011` as completed.
- Remove instructions that present those tasks as future work.
- Identify `TASK-012` and `TASK-043` as the next tasks that can run in parallel.
- Keep `TASK-044` dependent on `TASK-012`.

## Foundation Planning Changes

Add a mandatory planning step to create two missing backlog tasks:

1. Implement the Node.js, Express, and Apollo Server GraphQL foundation.
2. Implement the React Native, Expo, and Expo Router app foundation.

The guide will describe their required scope and dependencies without assigning
task numbers. Task identifiers belong to the task-catalog update that creates
them.

## Blocking Rules

- `TASK-009` remains blocked until the Expo foundation exists.
- `TASK-017` and backend GraphQL tests remain blocked until the GraphQL
  foundation exists.
- Product, E2E, production-build, and deployment work remains blocked by the
  applicable foundation and authentication dependencies.

## Scope

This change updates only `TASK_EXECUTION_GUIDE.md`. It does not add entries to
`TASK_INDEX.md`, create implementation task files, or implement GraphQL, Expo,
Firebase, database, or cloud infrastructure.

## Validation

- Completed and pending statuses must agree with `TASK_INDEX.md`.
- Dependency flow must not direct implementation toward missing foundations.
- Every referenced task must exist in the current task catalog.
- The guide must contain no stale statement naming `TASK-008` as the next task.
