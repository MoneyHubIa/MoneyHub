# Firebase REST Password Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Resend-based password recovery with a backend-only Firebase Auth REST flow for request, action-code verification, and password confirmation.

**Architecture:** Keep the public MoneyHub recovery routes and screens, but place an isolated Firebase Auth REST adapter behind a domain service. The backend owns all `sendOobCode` and `resetPassword` calls, maps provider failures to stable public errors, and emits secret-free audits. The frontend becomes a thin HTTP client and retains only local form validation and local-session cleanup.

**Tech Stack:** Node.js 22.13.0, TypeScript, Express, Zod, native `fetch`, Firebase Auth REST API, Expo Router, React Native, Node test runner, Jest.

## Global Constraints

- All recovery operations must pass through the MoneyHub backend; the frontend must not call Firebase password-recovery methods directly.
- Request initiation must always return HTTP `202` for syntactically valid email input, including unknown accounts and Firebase failures.
- `POST /auth/password-recovery` permits 5 requests per source IP per 15 minutes.
- Verify and confirm routes each permit 10 requests per source IP per 15 minutes.
- Request bodies are limited to 16 KiB.
- Firebase calls have a 10-second deadline and must abort on timeout.
- Never log raw email, password, `oobCode`, token, response body, or URL containing `FIREBASE_WEB_API_KEY`.
- Firebase Email Enumeration Protection remains enabled.
- GraphQL and database schemas remain unchanged.
- Resend package, configuration, adapter, templates, and documentation must be removed.
- TASK-019 and EPIC-02 remain open until real Firebase smoke acceptance passes.

---

### Task 1: Firebase Auth REST adapter

**Files:**
- Create: `apps/backend/src/firebase-auth-rest.ts`
- Create: `apps/backend/tests/firebase-auth-rest.test.ts`

**Interfaces:**
- Consumes: `FIREBASE_WEB_API_KEY`, `APP_URL`, native-compatible `fetch`.
- Produces: `FirebaseAuthRestClient`, `FirebaseAuthRestError`, and `createFirebaseAuthRestClient()`.

- [ ] **Step 1: Write failing adapter contract tests**

Create tests proving these literal HTTP contracts:

```ts
const client = createFirebaseAuthRestClient({
  apiKey: 'firebase-web-key',
  timeoutMs: 50,
  fetchRequest
});

await client.requestPasswordReset({
  email: 'user@example.com',
  continueUrl: 'https://moneyhub.example/login',
  userIp: '203.0.113.9'
});

assert.equal(url,
  'https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=firebase-web-key');
assert.deepEqual(JSON.parse(String(init.body)), {
  requestType: 'PASSWORD_RESET',
  email: 'user@example.com',
  continueUrl: 'https://moneyhub.example/login',
  canHandleCodeInApp: false,
  userIp: '203.0.113.9'
});
```

Add independent tests for `verifyPasswordResetCode('code')`, which posts only
`{ oobCode: 'code' }`, and `confirmPasswordReset('code', 'new-password')`, which
posts `{ oobCode: 'code', newPassword: 'new-password' }`, both to
`accounts:resetPassword?key=firebase-web-key`. Add tests proving a Firebase
error body becomes `FirebaseAuthRestError` with sanitized `providerCode`, and a
stalled request is aborted and becomes `provider/timeout` within the configured
deadline. Assertions must never reproduce the API key in thrown messages.

- [ ] **Step 2: Run adapter tests and verify RED**

Run:

```powershell
node --import tsx --test apps/backend/tests/firebase-auth-rest.test.ts
```

Expected: FAIL because `../src/firebase-auth-rest.js` does not exist.

- [ ] **Step 3: Implement minimal REST adapter**

Define:

```ts
export type FirebaseAuthRestClient = {
  requestPasswordReset(input: {
    email: string;
    continueUrl: string;
    userIp: string;
  }): Promise<void>;
  verifyPasswordResetCode(oobCode: string): Promise<void>;
  confirmPasswordReset(oobCode: string, newPassword: string): Promise<void>;
};

export class FirebaseAuthRestError extends Error {
  constructor(readonly providerCode: string) {
    super('Firebase Auth REST request failed.');
  }
}
```

Implement `createFirebaseAuthRestClient()` with injected `fetchRequest`, default
native `fetch`, `AbortController`, and a 10,000 ms default timeout. Parse only
`error.message`; accept only provider codes matching `/^[A-Z0-9_:/-]{1,100}$/i`;
otherwise use `provider/unknown`. On abort, throw code `provider/timeout`.

- [ ] **Step 4: Run adapter tests and verify GREEN**

```powershell
node --import tsx --test apps/backend/tests/firebase-auth-rest.test.ts
```

Expected: all adapter tests PASS.

- [ ] **Step 5: Commit adapter**

```powershell
git add apps/backend/src/firebase-auth-rest.ts apps/backend/tests/firebase-auth-rest.test.ts
git commit -m "feat: add Firebase Auth REST recovery adapter"
```

---

### Task 2: Password-recovery domain service

**Files:**
- Modify: `apps/backend/src/password-recovery.ts`
- Rewrite: `apps/backend/tests/password-recovery-service.test.ts`

**Interfaces:**
- Consumes: `FirebaseAuthRestClient` from Task 1 and `APP_URL`.
- Produces: `PasswordRecoveryService`, `PasswordRecoveryPublicError`, `PasswordRecoveryAuditEvent`, and `createPasswordRecoveryService()`.

- [ ] **Step 1: Rewrite service tests for backend REST behavior**

Replace Resend/link-generation assertions with tests against a fake
`FirebaseAuthRestClient`. Prove:

```ts
await service.request({
  email: ' User@Example.COM ',
  requestId: 'request-123',
  userIp: '203.0.113.9'
});

assert.deepEqual(requests, [{
  email: 'user@example.com',
  continueUrl: 'https://moneyhub.example/login',
  userIp: '203.0.113.9'
}]);
assert.deepEqual(audit, [{
  event: 'password_recovery_requested',
  requestId: 'request-123',
  emailHash: 'b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514',
  status: 'requested'
}]);
```

Add tests proving initiation swallows `EMAIL_NOT_FOUND` and internal errors;
verify maps `INVALID_OOB_CODE` and `EXPIRED_OOB_CODE` to
`INVALID_OR_EXPIRED_ACTION_CODE`; confirm maps those codes identically and maps
`WEAK_PASSWORD` or `PASSWORD_DOES_NOT_MEET_REQUIREMENTS` to `WEAK_PASSWORD`;
all other failures map to `RECOVERY_UNAVAILABLE`. Audit JSON must not contain
fixture email, password, action code, provider message, or API key.

- [ ] **Step 2: Run service tests and verify RED**

```powershell
node --import tsx --test apps/backend/tests/password-recovery-service.test.ts
```

Expected: FAIL because existing service still requires Resend dependencies and
does not expose `verify` or `confirm`.

- [ ] **Step 3: Implement service and public error mapping**

Use these contracts:

```ts
export type PasswordRecoveryService = {
  request(input: {
    email: string;
    requestId: string;
    userIp: string;
  }): Promise<void>;
  verify(input: { oobCode: string; requestId: string }): Promise<void>;
  confirm(input: {
    oobCode: string;
    newPassword: string;
    requestId: string;
  }): Promise<void>;
};

export type PasswordRecoveryPublicCode =
  | 'INVALID_OR_EXPIRED_ACTION_CODE'
  | 'WEAK_PASSWORD'
  | 'RECOVERY_UNAVAILABLE';

export class PasswordRecoveryPublicError extends Error {
  constructor(readonly code: PasswordRecoveryPublicCode) {
    super('Password recovery operation failed.');
  }
}
```

Use this audit union so runtime logging and tests share exact statuses:

```ts
export type PasswordRecoveryAuditEvent = Readonly<{
  event:
    | 'password_recovery_requested'
    | 'password_recovery_code_verified'
    | 'password_recovery_confirmed';
  requestId: string;
  status:
    | 'requested'
    | 'unknown_user'
    | 'verified'
    | 'confirmed'
    | 'firebase_error'
    | 'invalid_code'
    | 'weak_password';
  emailHash?: string;
  providerCode?: string;
}>;
```

Normalize and hash email only in `request`. Catch every initiation error and
return normally after safe audit. Let `verify` and `confirm` throw only
`PasswordRecoveryPublicError`. Wrap audit transport in `try/catch` so logger
failure never changes public behavior.

- [ ] **Step 4: Run service tests and verify GREEN**

```powershell
node --import tsx --test apps/backend/tests/password-recovery-service.test.ts
```

Expected: all service tests PASS.

- [ ] **Step 5: Commit service rewrite**

```powershell
git add apps/backend/src/password-recovery.ts apps/backend/tests/password-recovery-service.test.ts
git commit -m "refactor: move password recovery to Firebase REST"
```

---

### Task 3: Public Express routes

**Files:**
- Modify: `apps/backend/src/app.ts`
- Modify: `apps/backend/tests/password-recovery-route.test.ts`

**Interfaces:**
- Consumes: the complete `PasswordRecoveryService` and `PasswordRecoveryPublicError` from Task 2.
- Produces: request, verify, and confirm HTTP contracts consumed by frontend Task 5.

- [ ] **Step 1: Add failing route tests**

Extend app setup with fake `request`, `verify`, and `confirm` methods. Keep
existing initiation parity and 5-per-15-minute tests. Assert initiation forwards
`request.ip` as `userIp`. Add tests for:

```ts
POST /auth/password-recovery/verify
{ "oobCode": "valid-code" }
// 200, data: { valid: true }

POST /auth/password-recovery/confirm
{ "oobCode": "valid-code", "newPassword": "strong-password" }
// 200, data: { confirmed: true }
```

Assert blank code and blank password return HTTP `400` without service calls.
Assert `PasswordRecoveryPublicError('INVALID_OR_EXPIRED_ACTION_CODE')` returns
HTTP `400` with that code, `WEAK_PASSWORD` returns HTTP `400`, and
`RECOVERY_UNAVAILABLE` returns HTTP `503`. Assert verify and confirm return
`429 RATE_LIMITED` on request 11 from one IP while using separate limiters.

- [ ] **Step 2: Run route tests and verify RED**

```powershell
node --import tsx --test apps/backend/tests/password-recovery-route.test.ts
```

Expected: FAIL with verify and confirm routes returning `404`.

- [ ] **Step 3: Implement schemas, limiters, and handlers**

Add Zod schemas:

```ts
const passwordRecoveryCodeInput = z.object({
  oobCode: z.string().trim().min(1).max(4096)
});
const passwordRecoveryConfirmationInput = passwordRecoveryCodeInput.extend({
  newPassword: z.string().min(1).max(4096)
});
```

Use separate `express-rate-limit` instances for request, verify, and confirm.
Build all responses with existing canonical envelope and `requestId`. Do not put
input or caught provider errors in response details. Keep initiation catch-all
and HTTP `202` parity.

- [ ] **Step 4: Run route tests and backend suite**

```powershell
node --import tsx --test apps/backend/tests/password-recovery-route.test.ts
npm test -w apps/backend
```

Expected: route tests and entire backend suite PASS.

- [ ] **Step 5: Commit routes**

```powershell
git add apps/backend/src/app.ts apps/backend/tests/password-recovery-route.test.ts
git commit -m "feat: proxy password reset operations through backend"
```

---

### Task 4: Runtime wiring and Resend removal

**Files:**
- Modify: `apps/backend/src/runtime-config.ts`
- Modify: `apps/backend/tests/runtime-config.test.ts`
- Modify: `apps/backend/src/server.ts`
- Modify: `apps/backend/package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `createFirebaseAuthRestClient()` and `createPasswordRecoveryService()`.
- Produces: production server wired with `APP_URL` and `FIREBASE_WEB_API_KEY`, with no Resend runtime dependency.

- [ ] **Step 1: Write failing runtime-configuration tests**

Change expected configuration to:

```ts
assert.equal(config.appUrl.toString(), 'https://moneyhub.example/');
assert.equal(config.firebaseWebApiKey, 'firebase-web-key');
assert.equal('resendApiKey' in config, false);
assert.equal('resendFromEmail' in config, false);
```

Add missing/blank `FIREBASE_WEB_API_KEY` tests expecting
`FIREBASE_WEB_API_KEY is required.` Remove Resend-variable fixtures and tests.

- [ ] **Step 2: Run runtime tests and verify RED**

```powershell
node --import tsx --test apps/backend/tests/runtime-config.test.ts
```

Expected: FAIL because runtime config still requires Resend and lacks
`firebaseWebApiKey`.

- [ ] **Step 3: Replace runtime wiring**

Make `RuntimeConfig` expose `appUrl` and `firebaseWebApiKey`. In `server.ts`,
construct REST adapter and service:

```ts
const firebaseRest = createFirebaseAuthRestClient({
  apiKey: firebaseWebApiKey
});
const passwordRecovery = createPasswordRecoveryService({
  appUrl,
  firebaseRest,
  audit: (event) => {
    if (event.status === 'firebase_error') appLogger.error(event);
    else appLogger.info(event);
  }
});
```

Remove `Resend`, `firebaseAuth()` recovery-link generation, send-email adapter,
and Resend-specific status branches. Preserve Firebase Admin imports used by
other authentication code only where still needed.

- [ ] **Step 4: Remove dependency and environment entries**

Run:

```powershell
npm uninstall resend -w apps/backend
```

Replace `.env.example` Resend entries with:

```dotenv
FIREBASE_WEB_API_KEY=
```

- [ ] **Step 5: Run backend tests, lint, and typecheck**

```powershell
npm test -w apps/backend
npm run lint -w apps/backend
npm run typecheck -w apps/backend
```

Expected: all commands PASS and `npm ls resend` shows no direct MoneyHub backend dependency.

- [ ] **Step 6: Commit runtime migration**

```powershell
git add apps/backend/src/runtime-config.ts apps/backend/tests/runtime-config.test.ts apps/backend/src/server.ts apps/backend/package.json package-lock.json .env.example
git commit -m "chore: remove Resend password recovery"
```

---

### Task 5: Backend-only frontend client

**Files:**
- Modify: `apps/frontend/src/services/passwordRecoveryClient.ts`
- Delete: `apps/frontend/src/services/firebasePasswordRecoveryClient.ts`
- Create: `apps/frontend/src/services/backendPasswordRecoveryClient.ts`
- Modify: `apps/frontend/tests/passwordRecoveryClient.test.ts`
- Modify: `apps/frontend/app/(auth)/forgot-password.tsx`
- Modify: `apps/frontend/app/reset-password.tsx`
- Modify: `apps/frontend/src/components/PasswordRecoveryScreens.tsx`
- Modify: `apps/frontend/tests/PasswordRecoveryScreens.test.tsx`

**Interfaces:**
- Consumes: backend endpoints from Task 3.
- Produces: `PasswordRecoveryClient` with `request`, `verifyCode`, and `confirm`, all using HTTP.

- [ ] **Step 1: Write failing HTTP-client tests**

Remove injected Firebase functions. Use one injected `fetchRequest` returning
`{ ok, status, json }`. Assert exact requests:

```ts
await client.verifyCode('valid-code');
// POST `${endpoint}/verify`, body { oobCode: 'valid-code' }

await client.confirm('valid-code', 'new-password');
// POST `${endpoint}/confirm`, body { oobCode: 'valid-code', newPassword: 'new-password' }
```

Assert `WEAK_PASSWORD` becomes an error with `code === 'auth/weak-password'` so
existing safe copy remains used. Assert invalid/expired and unavailable backend
responses reject without exposing server response text or response details.

- [ ] **Step 2: Run client tests and verify RED**

```powershell
npm test -w apps/frontend -- --runTestsByPath tests/passwordRecoveryClient.test.ts
```

Expected: FAIL because verify and confirm still call injected Firebase methods.

- [ ] **Step 3: Implement thin HTTP client**

Change interface to:

```ts
export interface PasswordRecoveryClient {
  request(email: string): Promise<void>;
  verifyCode(oobCode: string): Promise<void>;
  confirm(oobCode: string, newPassword: string): Promise<void>;
}
```

Build `/verify` and `/confirm` relative to resolved base endpoint. Parse only
canonical `error.code`. Translate only `WEAK_PASSWORD` to
`auth/weak-password`; use generic internal errors for every other non-success
response. Never attach response body, password, or action code to thrown
messages.

- [ ] **Step 4: Rename concrete client and update routes**

Create `backendPasswordRecoveryClient.ts` using native `fetch`, `Constants`,
`Platform`, and `resolvePasswordRecoveryEndpoint`. Remove Firebase Auth imports.
Update both Expo routes to import `passwordRecoveryClient` from the new module,
then delete `firebasePasswordRecoveryClient.ts`.

- [ ] **Step 5: Update screen tests for void verification**

Change fake `verifyCode` resolutions from an email string to `undefined`.
Preserve tests for missing/invalid/expired/used code, mismatched passwords, weak
password copy, in-flight disabling, action-code identity isolation, logout, and
login navigation. No screen should depend on verified email data.

- [ ] **Step 6: Run frontend tests, lint, and typecheck**

```powershell
npm test -w apps/frontend -- --runTestsByPath tests/passwordRecoveryClient.test.ts tests/PasswordRecoveryScreens.test.tsx
npm test -w apps/frontend
npm run lint -w apps/frontend
npm run typecheck -w apps/frontend
```

Expected: all commands PASS.

- [ ] **Step 7: Commit frontend migration**

```powershell
git add apps/frontend/src/services apps/frontend/tests apps/frontend/app apps/frontend/src/components/PasswordRecoveryScreens.tsx
git commit -m "refactor: use backend Firebase recovery API"
```

---

### Task 6: Documentation reconciliation and final verification

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture/API_SPECIFICATION.md`
- Modify: `docs/architecture/SECURITY_ARCHITECTURE.md`
- Modify: `docs/development/ENVIRONMENT_VARIABLES.md`
- Modify: `docs/development/TESTING_STRATEGY.md`
- Modify: `docs/planning/BACKLOG.md`
- Modify: `docs/planning/TASK_EXECUTION_GUIDE.md`
- Modify: `docs/tasks/EPIC-02_AUTHENTICATION.md`
- Modify: `docs/tasks/EPIC-08_DEPLOY.md`
- Modify: `docs/tasks/TASK_INDEX.md`

**Interfaces:**
- Consumes: final backend and frontend contracts from Tasks 1-5.
- Produces: reproducible Firebase-only recovery documentation and truthful task status.

- [ ] **Step 1: Remove Resend recovery documentation**

Document three backend endpoints, `FIREBASE_WEB_API_KEY`, Firebase Console email
template/action URL, authorized `APP_URL` domain, Email Enumeration Protection,
and real-smoke procedure. Remove `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, sender
domain, Resend idempotency, and Resend delivery wording. Do not alter unrelated
email-verification references whose verb is “resend”; those describe Firebase
verification behavior, not Resend product usage.

- [ ] **Step 2: Preserve truthful planning status**

Keep `TASK-019` as `In Progress (real smoke pending)` and EPIC-02 open until a
real account proves delivery, custom action URL, password change, code non-reuse,
old-password failure, new-password login, and unknown-address parity. Keep
shared rate limiter and Cloud Run proxy work in EPIC-08.

- [ ] **Step 3: Run terminology and secret scans**

```powershell
rg -n "RESEND_API_KEY|RESEND_FROM_EMAIL|from 'resend'|from \"resend\"|Resend delivery|Resend sender" README.md .env.example apps docs
rg -n "oobCode|newPassword|email" apps/backend/src
```

Expected: first command returns no product/config remnants. Review second output
manually and confirm no logger receives recovery secrets.

- [ ] **Step 4: Run fresh full gates**

```powershell
npm test
npm run lint
npm run typecheck
npm run build
git diff --check
```

Expected: tests, lint, typecheck, backend build, and Expo exports for Web, iOS,
and Android PASS. Record exact final test counts in
`docs/planning/TASK_EXECUTION_GUIDE.md`, rerun `git diff --check`, and do not
claim smoke acceptance from automated gates.

- [ ] **Step 5: Commit documentation**

```powershell
git add README.md docs .env.example
git commit -m "docs: document Firebase REST password recovery"
```

- [ ] **Step 6: Perform real smoke when configuration and account are available**

Set valid `FIREBASE_WEB_API_KEY`, configure Firebase password-reset action URL
to `${APP_URL}/reset-password`, authorize the `APP_URL` domain, enable Email
Enumeration Protection, and configure Firebase password-reset template. Request
recovery for a real user; verify delivery, content, and MoneyHub URL; change
password; prove code reuse and old password fail; prove new password login
succeeds; request an unknown email and compare public response. Only after all
checks pass, mark TASK-019 and EPIC-02 `Done` in a separate closure commit.
