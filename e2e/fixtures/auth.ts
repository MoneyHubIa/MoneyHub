import { expect, type Page } from '@playwright/test';

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-moneyhub';
const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';

function assertSafeEmulator() {
  expect(projectId).toBe('demo-moneyhub');
  expect(emulatorHost).toMatch(/^(?:127\.0\.0\.1|localhost):9099$/);
}

export async function createEmulatorUser(input: {
  email: string;
  password: string;
  emailVerified: boolean;
}) {
  assertSafeEmulator();
  const response = await fetch(
    `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`,
    {
      method: 'POST',
      headers: {
        authorization: 'Bearer owner',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        localId: crypto.randomUUID(),
        email: input.email,
        password: input.password,
        emailVerified: input.emailVerified
      })
    }
  );
  expect(response.ok).toBe(true);
  const user = await response.json() as { localId: string };
  return { uid: user.localId };
}

export async function deleteEmulatorUser(uid: string) {
  assertSafeEmulator();
  const response = await fetch(
    `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`,
    {
      method: 'POST',
      headers: {
        authorization: 'Bearer owner',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ localId: uid })
    }
  );
  expect(response.ok).toBe(true);
}

export async function deleteEmulatorUserByEmail(email: string) {
  assertSafeEmulator();
  const response = await fetch(
    `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchGet`,
    { headers: { authorization: 'Bearer owner' } }
  );
  expect(response.ok).toBe(true);
  const body = await response.json() as {
    users?: Array<{ localId: string; email?: string }>;
  };
  const user = body.users?.find((candidate) => candidate.email === email);
  if (user) await deleteEmulatorUser(user.localId);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

export function uniqueCredentials(prefix: string) {
  const suffix = `${Date.now()}-${crypto.randomUUID()}`;
  return { email: `${prefix}-${suffix}@example.test`, password: 'Senha-E2E-123!' };
}
