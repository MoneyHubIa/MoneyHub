# Profile Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a verified authenticated user to view and edit their own name, currency, and theme from the Ajustes section.

**Architecture:** Extract profile authorization, validation, and persistence into a backend service that receives a Prisma-like profile repository. GraphQL maps that service to `myProfile` and `updateMyProfile`; the Expo app renders a dedicated settings component inside the existing dashboard shell and uses Apollo to query and save it.

**Tech Stack:** TypeScript, Prisma 7, Apollo Server 5, GraphQL, Expo Router, React Native, Apollo Client, Node test runner, Jest.

## Global Constraints

- Node must remain `>=22.13.0 <23`; `.nvmrc` is `22.13.0`.
- Identity and authorization come only from `GraphQLContext.auth`.
- Do not create a migration or modify Firebase identity data.
- Profile reads and updates require a verified email and an existing local profile.
- Editable currencies are `BRL`, `USD`, and `EUR`; themes are `SYSTEM`, `LIGHT`, and `DARK`.

---

### Task 1: Backend profile service and contract

**Files:**
- Create: `apps/backend/src/profile-management.ts`
- Create: `apps/backend/tests/profile-management.test.ts`
- Modify: `apps/backend/src/graphql.ts`

**Interfaces:**
- Consumes: `GraphQLContext` with `auth`, and a repository exposing `findUnique` and `update` by profile ID.
- Produces: `getMyProfile(context, repository)` and `updateMyProfile(context, input, repository)`.

- [ ] **Step 1: Write failing service tests**

```ts
test('updates only the authenticated profile with normalized values', async () => {
  const result = await updateMyProfile(verifiedContext, {
    fullName: '  Ana Silva  ', preferredCurrency: 'USD', theme: 'DARK'
  }, repository);
  assert.equal(result.fullName, 'Ana Silva');
  assert.equal(updatedProfileId, 'profile-1');
});
```

Add tests for anonymous, unverified, missing-profile, empty name, unsupported
currency, and unsupported theme errors.

- [ ] **Step 2: Run backend profile tests and verify RED**

Run: `npm test -w apps/backend -- tests/profile-management.test.ts`

Expected: fail because the service does not exist.

- [ ] **Step 3: Implement the minimal service**

```ts
export async function updateMyProfile(context, input, repository) {
  requireVerifiedProfile(context);
  return repository.update({ where: { id: context.auth.profileId }, data: normalize(input) });
}
```

Use stable GraphQL error codes `UNAUTHENTICATED`, `EMAIL_NOT_VERIFIED`,
`PROFILE_NOT_FOUND`, and `BAD_USER_INPUT`.

- [ ] **Step 4: Extend GraphQL**

Add `myProfile` and `updateMyProfile(input)` to `typeDefs`; connect their
resolvers to the service using `getPrismaClient().profile`.

- [ ] **Step 5: Run backend profile tests and verify GREEN**

Run: `npm test -w apps/backend -- tests/profile-management.test.ts`

Expected: all profile service cases pass.

### Task 2: Expo profile settings flow

**Files:**
- Create: `apps/frontend/src/components/ProfileSettings.tsx`
- Create: `apps/frontend/tests/ProfileSettings.test.tsx`
- Modify: `apps/frontend/src/components/DashboardShell.tsx`

**Interfaces:**
- Consumes: GraphQL `myProfile` and `updateMyProfile` operations through Apollo.
- Produces: an Ajustes view that loads current profile values and saves only
  `fullName`, `preferredCurrency`, and `theme`.

- [ ] **Step 1: Write failing component tests**

```tsx
test('saves the edited profile fields', async () => {
  render(<ProfileSettings />);
  fireEvent.changeText(screen.getByLabelText('Nome completo'), 'Ana Silva');
  fireEvent.press(screen.getByRole('button', { name: 'Salvar perfil' }));
  await waitFor(() => expect(mutate).toHaveBeenCalledWith(expect.objectContaining({
    variables: { input: { fullName: 'Ana Silva', preferredCurrency: 'BRL', theme: 'SYSTEM' } }
  })));
});
```

Add tests for loading persisted values, disabled controls while saving, and
visible save failure feedback.

- [ ] **Step 2: Run component tests and verify RED**

Run: `npm test -w apps/frontend -- --runInBand tests/ProfileSettings.test.tsx`

Expected: fail because `ProfileSettings` does not exist.

- [ ] **Step 3: Implement the focused settings component**

Query `myProfile`, initialize local form state after data loads, call
`updateMyProfile`, and render success or safe error feedback. Keep Firebase
credentials and email outside this component.

- [ ] **Step 4: Render the component for Ajustes**

Replace only the `activeSectionId === 'ajustes'` placeholder branch in
`DashboardShell`; preserve all other navigation behavior.

- [ ] **Step 5: Run component and dashboard tests and verify GREEN**

Run: `npm test -w apps/frontend -- --runInBand tests/ProfileSettings.test.tsx tests/DashboardShell.test.tsx`

Expected: all profile settings and dashboard navigation tests pass.

### Task 3: Completion and documentation

**Files:**
- Modify: `docs/tasks/TASK_INDEX.md`
- Modify: `docs/tasks/EPIC-02_AUTHENTICATION.md`
- Delete: `docs/superpowers/specs/2026-08-06-profile-management-design.md`

- [ ] **Step 1: Update task status**

Mark `TASK-020` Done and add a completion review describing the verified
GraphQL and Expo flow.

- [ ] **Step 2: Remove the temporary design document**

Delete the approved profile-management design document after implementation.

- [ ] **Step 3: Run full verification**

Run: `npm test`, `npm run lint`, `npm run typecheck`, and `git diff --check`.

Expected: all commands exit zero.

- [ ] **Step 4: Commit**

```bash
git add apps/backend apps/frontend docs/tasks docs/superpowers
git commit -m "feat: add profile management"
```

## Self-Review

- The plan covers contract, verified ownership, validation, persistence, Expo
  UI, feedback, tests, task status, and deletion of the temporary design.
- No profile creation, Firebase credential change, migration, or unrelated
  dashboard behavior is included.
- All interface names used by the frontend and GraphQL tasks are defined above.
