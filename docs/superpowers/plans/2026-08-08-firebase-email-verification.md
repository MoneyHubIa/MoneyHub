# Firebase Email Verification Implementation Plan

**Status:** Implemented and verified on 2026-08-09.

Registration now sends Firebase verification email, authentication state exposes
verification and refresh operations, Settings recovers `EMAIL_NOT_VERIFIED`
saves, and the focused plus repository-wide automated gates passed during the
implementation. Delivery remains owned by Firebase; migration of verification
email to Resend is intentionally outside the password-recovery closure.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send Firebase verification emails and let an unverified user refresh their token and retry a rejected profile save from Settings.

**Architecture:** Extend the existing Firebase authentication boundary with verification state, send, and refresh operations. Keep authorization in the backend, classify Apollo's `EMAIL_NOT_VERIFIED` response in a focused helper, and let `ProfileSettings` orchestrate feedback and one explicit retry after Firebase confirms verification.

**Tech Stack:** TypeScript 6, React 19, React Native/Expo 57, Firebase Web SDK 12, Apollo Client 4, Jest 29, React Native Testing Library.

## Global Constraints

- Firebase Authentication remains the sole email delivery and identity provider.
- The backend remains the authority that requires `email_verified: true` for profile updates.
- Authenticated users continue to read their profile before verification.
- Do not add SMTP, a backend email endpoint, a verification route, or another application URL.
- Only GraphQL code `EMAIL_NOT_VERIFIED` activates the verification recovery interface.
- Each **Já verifiquei** action retries the mutation at most once.
- Disable buttons while their associated asynchronous operation runs.

## File Structure

- `src/services/authService.ts` owns the framework-independent verification contract and behavior.
- `src/services/firebaseAuthService.ts` adapts that contract to Firebase's Client SDK.
- `src/providers/AuthProvider.tsx` synchronizes refreshed Firebase state with React.
- `src/services/graphqlErrors.ts` classifies Apollo errors by GraphQL extension code.
- `src/components/ProfileSettings.tsx` owns the recovery interaction and pending-save retry.
- Matching files under `apps/frontend/tests` verify each boundary independently.

---

### Task 1: Firebase verification authentication contract

**Files:**
- Modify: `apps/frontend/tests/authService.test.ts`
- Modify: `apps/frontend/tests/DashboardShell.test.tsx`
- Modify: `apps/frontend/tests/sessionRouting.test.ts`
- Modify: `apps/frontend/src/services/authService.ts`
- Modify: `apps/frontend/src/services/firebaseAuthService.ts`

**Interfaces:**
- Produces: `SessionUser = Readonly<{ uid: string; email: string | null; emailVerified: boolean }>`.
- Produces: `AuthService.resendEmailVerification(): Promise<void>`.
- Produces: `AuthService.refreshEmailVerification(): Promise<SessionUser>`.
- Preserves: ordinary `getIdToken()` does not force a refresh.

- [ ] **Step 1: Write failing service tests**

Add `sendVerification: jest.fn()` to every dependency fixture and `emailVerified` to every Firebase-user fixture. Add these cases:

```ts
test('sends verification after registration', async () => {
  const user = { uid: 'new-user', email: 'user@example.com', emailVerified: false };
  const createUser = jest.fn().mockResolvedValue({ user });
  const sendVerification = jest.fn().mockResolvedValue(undefined);
  const service = createFirebaseAuthService({
    createUser, sendVerification, signIn: jest.fn(), signOut: jest.fn(),
    observe: jest.fn(), getCurrentUser: () => user
  });

  await service.register(' User@Example.COM ', 'correct-horse');

  expect(createUser).toHaveBeenCalledWith('user@example.com', 'correct-horse');
  expect(sendVerification).toHaveBeenCalledWith(user);
});

test('maps verification into the restored session', () => {
  // Capture the observer callback and emit this exact value.
  const firebaseUser = {
    uid: 'firebase-uid', email: 'person@example.com', emailVerified: true
  };
  // Expect the session listener to receive the same three public fields.
});

test('resends verification to the current user', async () => {
  // Call resendEmailVerification and expect sendVerification(currentUser) once.
});

test('reloads verification and force-refreshes the token', async () => {
  const user = {
    uid: 'firebase-uid', email: 'person@example.com', emailVerified: false,
    reload: jest.fn(), getIdToken: jest.fn().mockResolvedValue('verified-token')
  };
  user.reload.mockImplementation(async () => { user.emailVerified = true; });
  // Expect reload(), getIdToken(true), and a returned session with emailVerified true.
});

test('requires a current user for verification operations', async () => {
  // With getCurrentUser returning null, expect resend and refresh to reject with
  // 'No authenticated Firebase user.'.
});
```

Also verify that a rejected `sendVerification` promise makes `register` reject with the same error; this proves initial-send failure is surfaced instead of reported as success.

- [ ] **Step 2: Verify the tests fail**

```powershell
npm test -w apps/frontend -- --runTestsByPath tests/authService.test.ts
```

Expected: FAIL because the verification contracts do not exist.

- [ ] **Step 3: Implement the service contract**

Use these exact shapes in `authService.ts`:

```ts
export type SessionUser = Readonly<{
  uid: string;
  email: string | null;
  emailVerified: boolean;
}>;

type FirebaseUserLike = SessionUser & {
  reload?: () => Promise<void>;
  getIdToken?: (forceRefresh?: boolean) => Promise<string>;
};

type FirebaseCredentialLike = Readonly<{ user: FirebaseUserLike }>;

interface FirebaseAuthDependencies {
  createUser(email: string, password: string): Promise<FirebaseCredentialLike>;
  sendVerification(user: FirebaseUserLike): Promise<void>;
  signIn(email: string, password: string): Promise<unknown>;
  signOut(): Promise<void>;
  observe(callback: (user: FirebaseUserLike | null) => void): () => void;
  getCurrentUser(): FirebaseUserLike | null;
}
```

Extend `AuthService` with the two methods above. Add shared helpers:

```ts
function toSessionUser(user: FirebaseUserLike): SessionUser {
  return { uid: user.uid, email: user.email, emailVerified: user.emailVerified };
}

function requireCurrentUser(dependencies: FirebaseAuthDependencies) {
  const user = dependencies.getCurrentUser();
  if (!user) throw new Error('No authenticated Firebase user.');
  return user;
}
```

Implement registration, resend, and refresh:

```ts
async register(email, password) {
  const credential = await dependencies.createUser(normalizeEmail(email), password);
  await dependencies.sendVerification(credential.user);
},
async resendEmailVerification() {
  await dependencies.sendVerification(requireCurrentUser(dependencies));
},
async refreshEmailVerification() {
  const user = requireCurrentUser(dependencies);
  if (!user.reload || !user.getIdToken) {
    throw new Error('Firebase user cannot refresh email verification.');
  }
  await user.reload();
  await user.getIdToken(true);
  return toSessionUser(user);
}
```

Use `toSessionUser` in `observeSession`. Keep `getIdToken()` calling `user.getIdToken()` without an argument.

Update the authenticated fixtures in `DashboardShell.test.tsx` and `sessionRouting.test.ts` with `emailVerified: false`. Add `resendEmailVerification: jest.fn()` and `refreshEmailVerification: jest.fn()` to the `AuthService` mock in `DashboardShell.test.tsx` so it continues to satisfy the extended interface.

In `firebaseAuthService.ts`, import `sendEmailVerification` and `type User` from `firebase/auth`, then add:

```ts
sendVerification: (user) => sendEmailVerification(user as User),
```

- [ ] **Step 4: Verify service tests and types**

```powershell
npm test -w apps/frontend -- --runTestsByPath tests/authService.test.ts
npm run typecheck -w apps/frontend
```

Expected: PASS and no TypeScript errors.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/frontend/src/services/authService.ts apps/frontend/src/services/firebaseAuthService.ts apps/frontend/tests/authService.test.ts apps/frontend/tests/DashboardShell.test.tsx apps/frontend/tests/sessionRouting.test.ts
git commit -m "feat: add Firebase email verification service"
```

---

### Task 2: Synchronize verification through AuthProvider

**Files:**
- Modify: `apps/frontend/tests/AuthProvider.test.tsx`
- Modify: `apps/frontend/src/providers/AuthProvider.tsx`

**Interfaces:**
- Consumes Task 1's two `AuthService` methods.
- Produces through `useAuth()`: `resendEmailVerification(): Promise<void>`.
- Produces through `useAuth()`: `refreshEmailVerification(): Promise<boolean>`.

- [ ] **Step 1: Write a failing provider test**

Update the existing service mock with both new methods and `emailVerified: false`. Add a probe with two buttons that calls the context methods and renders `verified` or `unverified`. Configure service refresh to resolve:

```ts
{
  uid: 'firebase-uid',
  email: 'person@example.com',
  emailVerified: true
}
```

Press resend and expect one service call. Press refresh and wait for `verified` to render. Capture the refresh promise in the probe and assert it resolves to `true`.

- [ ] **Step 2: Verify the provider test fails**

```powershell
npm test -w apps/frontend -- --runTestsByPath tests/AuthProvider.test.tsx
```

Expected: FAIL because the context methods do not exist.

- [ ] **Step 3: Implement provider synchronization**

Import `useCallback`, add both methods to `AuthContextValue`, and implement:

```ts
const refreshEmailVerification = useCallback(async () => {
  const refreshedUser = await service.refreshEmailVerification();
  setUser(refreshedUser);
  return refreshedUser.emailVerified;
}, [service]);
```

Expose `resendEmailVerification: service.resendEmailVerification` and the callback in the memoized value, including the callback in its dependencies.

- [ ] **Step 4: Verify provider and service tests**

```powershell
npm test -w apps/frontend -- --runTestsByPath tests/authService.test.ts tests/AuthProvider.test.tsx
npm run typecheck -w apps/frontend
```

Expected: PASS and no TypeScript errors.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/frontend/src/providers/AuthProvider.tsx apps/frontend/tests/AuthProvider.test.tsx
git commit -m "feat: expose email verification state"
```

---

### Task 3: Classify Apollo GraphQL errors

**Files:**
- Create: `apps/frontend/tests/graphqlErrors.test.ts`
- Create: `apps/frontend/src/services/graphqlErrors.ts`

**Interfaces:**
- Produces: `hasGraphQLErrorCode(error: unknown, code: string): boolean`.

- [ ] **Step 1: Write failing classifier tests**

```ts
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { hasGraphQLErrorCode } from '../src/services/graphqlErrors';

test('recognizes a requested extension code', () => {
  const error = new CombinedGraphQLErrors({
    errors: [{ message: 'Verify email', extensions: { code: 'EMAIL_NOT_VERIFIED' } }]
  });
  expect(hasGraphQLErrorCode(error, 'EMAIL_NOT_VERIFIED')).toBe(true);
});

test.each([
  new Error('network failed'),
  new CombinedGraphQLErrors({
    errors: [{ message: 'Invalid', extensions: { code: 'BAD_USER_INPUT' } }]
  }),
  null
])('rejects unrelated error %#', (error) => {
  expect(hasGraphQLErrorCode(error, 'EMAIL_NOT_VERIFIED')).toBe(false);
});
```

- [ ] **Step 2: Verify the classifier test fails**

```powershell
npm test -w apps/frontend -- --runTestsByPath tests/graphqlErrors.test.ts
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the classifier**

```ts
import { CombinedGraphQLErrors } from '@apollo/client/errors';

export function hasGraphQLErrorCode(error: unknown, code: string): boolean {
  return CombinedGraphQLErrors.is(error) &&
    error.errors.some((item) => item.extensions?.code === code);
}
```

- [ ] **Step 4: Verify test and types**

```powershell
npm test -w apps/frontend -- --runTestsByPath tests/graphqlErrors.test.ts
npm run typecheck -w apps/frontend
```

Expected: PASS and no TypeScript errors.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/frontend/src/services/graphqlErrors.ts apps/frontend/tests/graphqlErrors.test.ts
git commit -m "test: classify GraphQL error codes"
```

---

### Task 4: Recover rejected saves in Settings

**Files:**
- Modify: `apps/frontend/tests/ProfileSettings.test.tsx`
- Modify: `apps/frontend/src/components/ProfileSettings.tsx`

**Interfaces:**
- Consumes Task 2's context methods and Task 3's error classifier.
- Preserves the existing mutation variables and generic failure message.

- [ ] **Step 1: Write failing recovery tests**

Mock the auth context:

```ts
const mockResendEmailVerification = jest.fn();
const mockRefreshEmailVerification = jest.fn();
jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: () => ({
    resendEmailVerification: mockResendEmailVerification,
    refreshEmailVerification: mockRefreshEmailVerification
  })
}));
```

Construct real Apollo errors with:

```ts
const emailNotVerifiedError = () => new CombinedGraphQLErrors({
  errors: [{
    message: 'Verify email', extensions: { code: 'EMAIL_NOT_VERIFIED' }
  }]
});
```

Add these cases with exact assertions:

- rejected save shows `Verifique seu e-mail para salvar alterações`, `Reenviar e-mail`, and `Já verifiquei`, without the generic failure;
- resend success calls the service once and shows `Enviamos um novo e-mail de verificação. Confira também a caixa de spam.`;
- resend failure shows `Não foi possível reenviar o e-mail de verificação. Tente novamente.`;
- refresh resolving `false` preserves the edited input, makes no second mutation, and shows `A verificação ainda não foi detectada.`;
- refresh resolving `true` retries with identical variables exactly once and shows `Alterações salvas com sucesso.`;
- refresh rejection shows `Não foi possível atualizar o status da verificação. Tente novamente.`;
- an unrelated mutation rejection keeps `Não foi possível salvar as alterações. Tente novamente.` and shows no verification actions.

- [ ] **Step 2: Verify the Settings tests fail**

```powershell
npm test -w apps/frontend -- --runTestsByPath tests/ProfileSettings.test.tsx
```

Expected: FAIL because there is no recovery UI.

- [ ] **Step 3: Implement save classification and reusable persistence**

Consume the auth actions and add these states:

```ts
const [verificationRequired, setVerificationRequired] = useState(false);
const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
const [resendingVerification, setResendingVerification] = useState(false);
const [refreshingVerification, setRefreshingVerification] = useState(false);
```

Extract `persistProfile(normalizedName)` to run the existing mutation, normalize the input, clear verification feedback, and set `Alterações salvas com sucesso.`. In `handleSave`, catch `unknown`; when `hasGraphQLErrorCode(error, 'EMAIL_NOT_VERIFIED')` is true, set `verificationRequired` and suppress the generic message. Preserve generic handling for every other error.

- [ ] **Step 4: Implement resend and refresh handlers**

`handleResendVerification` sets its loading flag, clears prior verification feedback, calls the provider, sets the exact success/failure copy above, and clears loading in `finally`.

`handleRefreshVerification` sets its loading flag and calls the provider. If it returns `false`, show the not-detected copy and stop. If it returns `true`, call `persistProfile(fullName.trim())` exactly once. Do not call `handleSave` recursively. If retry still returns `EMAIL_NOT_VERIFIED`, keep the panel and show the not-detected copy; for other refresh/retry failures, show the refresh-failure copy. Always clear loading in `finally`.

- [ ] **Step 5: Render the accessible recovery panel**

When `verificationRequired` is true, render a `View` labeled `Verificação de e-mail necessária`, the heading and explanation, optional feedback, and two accessible `Pressable` buttons labeled `Reenviar e-mail` and `Já verifiquei`. Style it with the existing teal/neutral palette. Disable both actions and the main save button whenever `saving`, `resendingVerification`, or `refreshingVerification` is true.

- [ ] **Step 6: Verify focused tests and quality checks**

```powershell
npm test -w apps/frontend -- --runTestsByPath tests/ProfileSettings.test.tsx tests/graphqlErrors.test.ts tests/AuthProvider.test.tsx tests/authService.test.ts
npm run typecheck -w apps/frontend
npm run lint -w apps/frontend
```

Expected: PASS with no type or lint errors.

- [ ] **Step 7: Commit**

```powershell
git add -- apps/frontend/src/components/ProfileSettings.tsx apps/frontend/tests/ProfileSettings.test.tsx
git commit -m "feat: recover unverified profile saves"
```

---

### Task 5: Full regression verification

**Files:**
- Verify only; no source change is expected.

**Interfaces:**
- Verifies the complete Firebase-to-Apollo-to-backend contract.

- [ ] **Step 1: Run all automated tests**

```powershell
npm test
```

Expected: all backend and frontend suites PASS.

- [ ] **Step 2: Run repository-wide static checks**

```powershell
npm run typecheck
npm run lint
git diff --check
```

Expected: exit code 0 and no whitespace errors.

- [ ] **Step 3: Build all Expo targets**

```powershell
npm run build -w apps/frontend
```

Expected: successful Web, iOS, and Android exports.

- [ ] **Step 4: Perform the Firebase smoke test**

Register a new address, confirm receipt of Firebase's email, load Ajustes, trigger the protected-save panel, resend, open the link, press **Já verifiquei**, and confirm the pending change saves. Confirm the backend logs the successful `POST /graphql`.

- [ ] **Step 5: Inspect final scope**

```powershell
git status --short
git log --oneline -5
```

Expected: only intentional pre-existing work remains uncommitted, and feature commits contain no unrelated files.
