# Task Catalog Reconciliation Design

## Objective

Reconcile the planning documentation with the repository's current state without starting implementation work or creating product tasks.

## Scope

- Mark TASK-006 and TASK-007 as Done after validating their planning acceptance criteria.
- Keep EPIC-01 Pending because the GraphQL and Expo foundations are not implemented.
- Document the planned web and native Firebase Analytics adapters.
- Give every existing task one stable identifier and title.
- Restore existing tasks omitted from the task index.
- Distinguish the current React/Vite and REST foundation from the target Expo and GraphQL foundation.
- Synchronize `.env.example` with the documented target environment while retaining variables required by the current runtime.

## Task Identifier Strategy

The updated authentication and infrastructure identifiers in `TASK_INDEX.md` remain authoritative. Existing tasks with conflicting identifiers are renumbered without changing their scope:

- EPIC-03 uses TASK-021, TASK-022, and TASK-024 through TASK-027.
- EPIC-04 uses TASK-023 and TASK-028 through TASK-030.
- EPIC-05 uses TASK-013 and TASK-031 through TASK-033.
- EPIC-06 uses TASK-014 and TASK-045 through TASK-047.

TASK-034 through TASK-044 retain their current meanings. This preserves every existing task without introducing new scope.

## Completion Review

TASK-006 is complete because the architecture and API specifications define the GraphQL endpoint, operational health boundary, Firebase ID-token verification, and Firebase UID ownership boundary.

TASK-007 is complete after the architecture explicitly defines:

- Expo Router as the cross-platform navigation foundation.
- `EXPO_PUBLIC_*` Firebase configuration.
- A web Firebase Analytics adapter.
- A native Firebase Analytics adapter isolated behind the same application interface.

Completing these planning tasks does not complete EPIC-01 and does not claim that the target stack is implemented.

## Verification

- Check that task identifiers are unique across the index and epic files.
- Check that every epic task appears in the index.
- Check that README commands match the current package scripts.
- Check that documented environment variables appear in `.env.example`.
- Run the existing tests, lint, and frontend build to ensure documentation changes do not disturb the current foundation.
