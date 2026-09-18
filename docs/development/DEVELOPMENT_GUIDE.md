# Development Guide

## Workflow

1. Select the next task from `/docs/tasks/TASK_INDEX.md`.
2. Confirm dependencies and scope.
3. Create or update specs before code.
4. Write failing tests.
5. Implement the smallest passing change.
6. Run verification commands.
7. Update task status and documentation.

## Local Setup

```bash
npm install
npm test
npm run test:coverage -w apps/backend
npm run test:coverage -w apps/frontend
node --test e2e/environment.test.mjs
npm run typecheck:e2e
npm run test:e2e -- --grep @smoke
```

## Branching

Work should happen in an isolated branch or worktree once Git is initialized.

## E2E prerequisites

Use Node 22, Java 21, Docker Compose, and Chromium installed by Playwright. `npm run test:e2e` creates only the `moneyhub-e2e` Compose project, uses PostgreSQL at `127.0.0.1:55432`, Firebase project `demo-moneyhub`, and removes its containers and volume in cleanup. It does not read `.env` because `EXPO_NO_DOTENV=1` is enforced.

GitHub Actions defines `quality`, `backend-coverage`, `frontend-coverage`, and `web-e2e`. Requiring these checks in branch protection remains repository configuration.
