# Backend HTTP Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit one safe, structured Pino completion log for every HTTP request handled by the MoneyHub backend.

**Architecture:** A focused `http-logger.ts` module will expose a small logger interface, status-to-level selection, and one Express middleware that logs on the response `finish` event. `createApp` will inject the production Pino logger by default while allowing tests to provide an in-memory logger.

**Tech Stack:** TypeScript 5.9, Express 4, Pino 9, Node.js test runner, Supertest

## Global Constraints

- Use the existing `pino` dependency; do not add `pino-http`.
- Emit exactly one `http_request_completed` event per completed response.
- Log only `event`, `requestId`, `method`, `path`, `statusCode`, and `durationMs`.
- Use `info` below `400`, `warn` from `400` through `499`, and `error` at `500` or above.
- Never log bodies, GraphQL documents or variables, authorization headers, Firebase tokens, cookies, arbitrary headers, or query-string values.
- Reuse the request ID already stored in `response.locals.requestId`.
- Preserve the user's existing uncommitted edit in `apps/backend/tests/foundation.test.ts`.
- Delete `docs/superpowers/specs/2026-07-27-backend-http-logging-design.md` after implementation and verification, as requested by the user.

---

### Task 1: HTTP completion logger

**Files:**
- Create: `apps/backend/src/http-logger.ts`
- Create: `apps/backend/tests/http-logger.test.ts`

**Interfaces:**
- Consumes: Express `RequestHandler` and Pino's default logger.
- Produces: `HttpLogger`, `HttpCompletionEvent`, `httpLogLevel(statusCode)`, `createHttpLoggingMiddleware(logger)`, and `appLogger`.

- [ ] **Step 1: Write failing unit tests for severity selection**

Create `apps/backend/tests/http-logger.test.ts` with table-driven assertions:

```ts
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { httpLogLevel } from '../src/http-logger.js';

describe('HTTP request logging', () => {
  test('selects a log level from the final HTTP status', () => {
    assert.equal(httpLogLevel(200), 'info');
    assert.equal(httpLogLevel(399), 'info');
    assert.equal(httpLogLevel(400), 'warn');
    assert.equal(httpLogLevel(499), 'warn');
    assert.equal(httpLogLevel(500), 'error');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm test --workspace @moneyhub/backend
```

Expected: FAIL because `../src/http-logger.js` does not exist.

- [ ] **Step 3: Add the minimal logging module**

Create `apps/backend/src/http-logger.ts`:

```ts
import type { RequestHandler } from 'express';
import pino from 'pino';

export type HttpLogLevel = 'info' | 'warn' | 'error';

export type HttpCompletionEvent = Readonly<{
  event: 'http_request_completed';
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}>;

export type HttpLogger = {
  info(event: HttpCompletionEvent): void;
  warn(event: HttpCompletionEvent): void;
  error(event: HttpCompletionEvent): void;
};

export const appLogger: HttpLogger = pino();

export function httpLogLevel(statusCode: number): HttpLogLevel {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warn';
  return 'info';
}

export function createHttpLoggingMiddleware(logger: HttpLogger): RequestHandler {
  return (request, response, next) => {
    const startedAt = performance.now();

    response.once('finish', () => {
      const event: HttpCompletionEvent = {
        event: 'http_request_completed',
        requestId: String(response.locals.requestId),
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        durationMs: Math.max(0, performance.now() - startedAt)
      };

      try {
        logger[httpLogLevel(response.statusCode)](event);
      } catch {
        // Logging must never affect an HTTP response.
      }
    });

    next();
  };
}
```

- [ ] **Step 4: Run the unit test and verify GREEN**

Run:

```powershell
npm test --workspace @moneyhub/backend
```

Expected: PASS.

- [ ] **Step 5: Type-check the new interface**

Run:

```powershell
npm run typecheck --workspace @moneyhub/backend
```

Expected: PASS with no TypeScript errors.

### Task 2: Express integration and endpoint coverage

**Files:**
- Modify: `apps/backend/src/app.ts`
- Modify: `apps/backend/tests/http-logger.test.ts`

**Interfaces:**
- Consumes: `HttpLogger`, `appLogger`, and `createHttpLoggingMiddleware` from Task 1.
- Produces: `createApp({ logger? })`, with one completion event for `/health`, `/graphql`, fallback `404`, and future endpoints.

- [ ] **Step 1: Write failing integration tests**

Extend `apps/backend/tests/http-logger.test.ts` with an in-memory logger and tests that call the real Express application:

```ts
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type {
  HttpCompletionEvent,
  HttpLogLevel,
  HttpLogger
} from '../src/http-logger.js';

type RecordedLog = Readonly<{
  level: HttpLogLevel;
  event: HttpCompletionEvent;
}>;

function recordingLogger(logs: RecordedLog[]): HttpLogger {
  return {
    info: (event) => logs.push({ level: 'info', event }),
    warn: (event) => logs.push({ level: 'warn', event }),
    error: (event) => logs.push({ level: 'error', event })
  };
}

async function testApp(logs: RecordedLog[]): Promise<Express> {
  return createApp({
    logger: recordingLogger(logs),
    verifyIdToken: async () => {
      throw new Error('Token must not be verified in anonymous tests.');
    }
  });
}
```

Add separate tests proving:

```ts
test('logs a successful health request with its correlation ID', async () => {
  const logs: RecordedLog[] = [];
  const app = await testApp(logs);
  const response = await request(app)
    .get('/health?probe=private-value')
    .set('x-request-id', 'request-health-1');

  assert.equal(response.status, 200);
  assert.equal(logs.length, 1);
  assert.equal(logs[0]?.level, 'info');
  assert.deepEqual(
    {
      ...logs[0]?.event,
      durationMs: undefined
    },
    {
      event: 'http_request_completed',
      requestId: 'request-health-1',
      method: 'GET',
      path: '/health',
      statusCode: 200,
      durationMs: undefined
    }
  );
  assert.ok(Number.isFinite(logs[0]?.event.durationMs));
  assert.ok((logs[0]?.event.durationMs ?? -1) >= 0);
  await app.locals.stop?.();
});

test('logs a rejected GraphQL request without sensitive input', async () => {
  const logs: RecordedLog[] = [];
  const app = await testApp(logs);
  const response = await request(app)
    .post('/graphql')
    .set('authorization', 'Bearer secret-token')
    .send({ query: '{ health { status } }', variables: { secret: 'hidden' } });

  assert.equal(response.status, 401);
  assert.equal(logs.length, 1);
  assert.equal(logs[0]?.level, 'warn');
  assert.equal(logs[0]?.event.path, '/graphql');
  assert.equal(JSON.stringify(logs[0]?.event).includes('secret'), false);
  await app.locals.stop?.();
});

test('logs an unknown route as a warning', async () => {
  const logs: RecordedLog[] = [];
  const app = await testApp(logs);
  const response = await request(app).get('/missing');

  assert.equal(response.status, 404);
  assert.equal(logs.length, 1);
  assert.equal(logs[0]?.level, 'warn');
  assert.equal(logs[0]?.event.statusCode, 404);
  await app.locals.stop?.();
});
```

Also add an anonymous GraphQL success test using `{ health { status } }`, expecting status `200`, level `info`, and path `/graphql`. This distinguishes successful GraphQL logging from the authenticated failure case.

- [ ] **Step 2: Run integration tests and verify RED**

Run:

```powershell
npm test --workspace @moneyhub/backend
```

Expected: FAIL because `CreateAppOptions` does not accept `logger` and the middleware is not installed.

- [ ] **Step 3: Inject and install the shared middleware**

Modify `apps/backend/src/app.ts`:

```ts
import {
  appLogger,
  createHttpLoggingMiddleware,
  type HttpLogger
} from './http-logger.js';

type CreateAppOptions = {
  verifyIdToken?: VerifyIdToken;
  logger?: HttpLogger;
};
```

Inside `createApp`, select the logger:

```ts
const logger = options.logger ?? appLogger;
```

Install `createHttpLoggingMiddleware(logger)` immediately after the existing
request-ID middleware and before `/health`:

```ts
app.use(createHttpLoggingMiddleware(logger));
```

- [ ] **Step 4: Run integration tests and verify GREEN**

Run:

```powershell
npm test --workspace @moneyhub/backend
```

Expected: all HTTP logging tests PASS.

- [ ] **Step 5: Run the complete backend test suite**

Run:

```powershell
npm test --workspace @moneyhub/backend
```

Expected: all backend tests PASS, including the user's current local version of `foundation.test.ts`.

### Task 3: Final verification and requested design cleanup

**Files:**
- Delete: `docs/superpowers/specs/2026-07-27-backend-http-logging-design.md`
- Preserve: `docs/superpowers/plans/2026-07-27-backend-http-logging.md`

**Interfaces:**
- Consumes: completed logging implementation from Tasks 1 and 2.
- Produces: verified backend and removal of the temporary design document requested by the user.

- [ ] **Step 1: Run formatting and static checks**

Run:

```powershell
npm run lint --workspace @moneyhub/backend
npm run typecheck --workspace @moneyhub/backend
git diff --check
```

Expected: all commands exit successfully with no lint, type, or whitespace errors.

- [ ] **Step 2: Run final tests**

Run:

```powershell
npm test --workspace @moneyhub/backend
```

Expected: all backend tests PASS.

- [ ] **Step 3: Delete the reviewed design document**

Delete only:

```text
docs/superpowers/specs/2026-07-27-backend-http-logging-design.md
```

Do not delete the implementation plan or the user's modified
`apps/backend/tests/foundation.test.ts`.

- [ ] **Step 4: Inspect final scope**

Run:

```powershell
git status --short
git diff -- apps/backend/src/app.ts apps/backend/src/http-logger.ts apps/backend/tests/http-logger.test.ts docs/superpowers/specs/2026-07-27-backend-http-logging-design.md
```

Expected: logging implementation and tests are present, the design document is
deleted, and the pre-existing `foundation.test.ts` modification remains
separate and untouched.

- [ ] **Step 5: Commit only implementation-owned files**

Run:

```powershell
git add -- apps/backend/src/app.ts apps/backend/src/http-logger.ts apps/backend/tests/http-logger.test.ts docs/superpowers/specs/2026-07-27-backend-http-logging-design.md docs/superpowers/plans/2026-07-27-backend-http-logging.md
git commit -m "feat(backend): add structured HTTP request logging"
```

Do not stage `apps/backend/tests/foundation.test.ts`.
