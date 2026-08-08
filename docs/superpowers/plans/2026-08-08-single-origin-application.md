# Single-Origin Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the Expo web build and GraphQL API from one public origin configured through `APP_URL`.

**Architecture:** The root `.env` owns `APP_URL`. Backend and Expo configuration load that same file. Express serves the exported web assets while Apollo uses `/graphql` on web and resolves the route against `APP_URL` on native platforms.

**Tech Stack:** Node.js 22, Express 4, Apollo Server 5, Expo 57, TypeScript, Node test runner, Jest.

## Global Constraints

- `APP_URL` is the only public communication URL; remove `FRONTEND_URL` and `EXPO_PUBLIC_GRAPHQL_ENDPOINT`.
- Web requests use `/graphql` and API failures remain JSON.
- Do not add dependencies.

---

### Task 1: Centralize runtime URL configuration

**Files:** Create `apps/backend/src/runtime-config.ts` and `apps/backend/tests/runtime-config.test.ts`; modify `apps/backend/src/server.ts`, `.env`, `apps/backend/.env`, and `apps/frontend/.env`.

**Produces:** `loadRuntimeConfig(environment?: NodeJS.ProcessEnv): { appUrl: URL }`.

- [ ] **Step 1: Write the failing test**

```ts
test('normalizes the single public application URL', () => {
  assert.equal(loadRuntimeConfig({ APP_URL: 'http://example.test:3000/' }).appUrl.toString(), 'http://example.test:3000/');
});
```

- [ ] **Step 2: Verify RED**

Run: `npm run test -w apps/backend -- tests/runtime-config.test.ts`

Expected: FAIL because `loadRuntimeConfig` does not exist.

- [ ] **Step 3: Implement the minimum**

```ts
export function loadRuntimeConfig(environment = process.env): { appUrl: URL } {
  if (!environment.APP_URL) throw new Error('APP_URL is required.');
  return { appUrl: new URL(environment.APP_URL) };
}
```

Load root `.env` before Express starts. Move the public URL to root `APP_URL`; remove package-level communication variables.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test -w apps/backend -- tests/runtime-config.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add .env apps/backend/.env apps/frontend/.env apps/backend/src/runtime-config.ts apps/backend/src/server.ts apps/backend/tests/runtime-config.test.ts && git commit -m "feat(config): centralize public application URL"`

### Task 2: Serve frontend and API from Express

**Files:** Modify `apps/backend/src/app.ts` and `apps/backend/tests/foundation.test.ts`.

**Consumes:** `loadRuntimeConfig().appUrl` and optional `CreateAppOptions.frontendDistDir`.

**Produces:** static web delivery at `/`, HTML fallback for client routes, GraphQL at `/graphql`, JSON 404 for `/api/*`.

- [ ] **Step 1: Write the failing tests**

```ts
test('serves the exported web entrypoint from the API origin', async () => {
  const app = await createApp({ frontendDistDir: fixtureDirectory });
  const response = await request(app).get('/');
  assert.equal(response.status, 200);
  assert.match(response.text, /MoneyHub/);
});

test('keeps unknown API routes as JSON 404 responses', async () => {
  const response = await request(app).get('/api/missing');
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});
```

- [ ] **Step 2: Verify RED**

Run: `npm run test -w apps/backend -- tests/foundation.test.ts`

Expected: FAIL because no web static or fallback handler exists.

- [ ] **Step 3: Implement the minimum**

```ts
app.use(express.static(frontendDistDir));
app.get('*', (request, response, next) => {
  if (request.accepts('html')) return response.sendFile('index.html', { root: frontendDistDir });
  next();
});
```

Register after API routes and before the JSON fallback. Use `appUrl.origin` for CORS compatibility and remove the previous multi-origin parser/test.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test -w apps/backend -- tests/foundation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/backend/src/app.ts apps/backend/tests/foundation.test.ts && git commit -m "feat(backend): serve web app from API origin"`

### Task 3: Resolve Apollo endpoint from the shared origin

**Files:** Create `apps/frontend/app.config.ts`; modify `apps/frontend/src/services/apollo.ts`, `apps/frontend/tests/apollo.test.ts`, and `apps/frontend/tests/runtimeUrl.test.ts`.

**Produces:** `resolveGraphqlEndpoint(appUrl: string, platform: string): string`.

- [ ] **Step 1: Write the failing tests**

```ts
test('uses a relative GraphQL path on web', () => {
  expect(resolveGraphqlEndpoint('http://example.test:3000', 'web')).toBe('/graphql');
});

test('resolves GraphQL against the single app URL on Android', () => {
  expect(resolveGraphqlEndpoint('http://example.test:3000', 'android')).toBe('http://example.test:3000/graphql');
});
```

- [ ] **Step 2: Verify RED**

Run: `npm run test -w apps/frontend -- --runInBand tests/apollo.test.ts`

Expected: FAIL because Apollo reads `EXPO_PUBLIC_GRAPHQL_ENDPOINT`.

- [ ] **Step 3: Implement the minimum**

```ts
export function resolveGraphqlEndpoint(appUrl: string, platform: string): string {
  return platform === 'web' ? '/graphql' : new URL('/graphql', appUrl).toString();
}
```

Use `app.config.ts` to load root `.env` into `extra.appUrl`; call this resolver from Apollo.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test -w apps/frontend -- --runInBand tests/apollo.test.ts tests/runtimeUrl.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/frontend/app.config.ts apps/frontend/src/services/apollo.ts apps/frontend/tests/apollo.test.ts apps/frontend/tests/runtimeUrl.test.ts && git commit -m "feat(frontend): use single application origin"`

### Task 4: Document and verify deployment flow

**Files:** Modify `README.md` and `docs/development/ENVIRONMENT_VARIABLES.md`.

- [ ] **Step 1: Write the failing documentation check**

```ts
assert.match(readFileSync('docs/development/ENVIRONMENT_VARIABLES.md', 'utf8'), /APP_URL/);
assert.doesNotMatch(readFileSync('docs/development/ENVIRONMENT_VARIABLES.md', 'utf8'), /EXPO_PUBLIC_GRAPHQL_ENDPOINT/);
```

- [ ] **Step 2: Verify RED**

Run: `node --input-type=module -e "import('node:fs').then(({readFileSync}) => { const text = readFileSync('docs/development/ENVIRONMENT_VARIABLES.md', 'utf8'); if (!text.includes('APP_URL') || text.includes('EXPO_PUBLIC_GRAPHQL_ENDPOINT')) process.exit(1); })"`

Expected: exit code 1.

- [ ] **Step 3: Update documentation**

Document `APP_URL` and run `npm run build -w apps/frontend`, `npm run build -w apps/backend`, then `npm run start -w apps/backend`.

- [ ] **Step 4: Verify final behavior**

Run: `npm run test -w apps/backend && npm run typecheck -w apps/backend && npm run test -w apps/frontend -- --runInBand && npm run typecheck -w apps/frontend && npm run build -w apps/frontend && npm run build -w apps/backend`

Expected: all commands exit 0; `GET /` serves Expo and `POST /graphql` answers on `APP_URL`.

- [ ] **Step 5: Commit**

Run: `git add README.md docs/development/ENVIRONMENT_VARIABLES.md && git commit -m "docs: document single-origin application setup"`
