import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const frontend = 'http://localhost:8080';
const emulator = 'http://localhost:9099';
const email = 'demo@moneyhub.local';
const password = 'MoneyHubDemo123!';

async function json(url, options) {
  // Docker publishes IPv4 loopback; browsers still test the README's localhost URLs.
  const target = new URL(url);
  if (target.hostname === 'localhost') target.hostname = '127.0.0.1';
  const response = await fetch(target, { ...options, signal: AbortSignal.timeout(15000) });
  assert.ok(response.ok, `${url}: HTTP ${response.status}`);
  return response.json();
}

const health = await json('http://localhost:3000/health');
assert.equal(health.data.status, 'ok');
const identity = await json(`${emulator}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password, returnSecureToken: true })
});
assert.equal(identity.localId, 'moneyhub-demo-user');
const result = await json(`${frontend}/graphql`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${identity.idToken}` },
  body: JSON.stringify({ query: `{
    me { email emailVerified needsProfileBootstrap }
    myProfile { fullName }
    dashboardSummary { totalIncome totalExpense }
    myCategories { id }
    myCostCenters { id }
    myIncomes { id }
    myExpenses { id }
    myAccountsPayable { id }
    myAccountsReceivable { id }
    myRecurringTransactions { id }
    myFinancialGoals { id accumulatedAmount movements { nodes { amount } } }
  }` })
});
assert.equal(result.errors, undefined, JSON.stringify(result.errors));
assert.equal(result.data.me.email, email);
assert.equal(result.data.me.emailVerified, true);
assert.equal(result.data.me.needsProfileBootstrap, false);
assert.ok(Number(result.data.dashboardSummary.totalIncome) > 0);
assert.ok(Number(result.data.dashboardSummary.totalExpense) > 0);
for (const [key, value] of Object.entries(result.data)) {
  if (Array.isArray(value)) assert.ok(value.length > 0, `${key} must contain demo data`);
}
const recovery = await json(`${frontend}/auth/password-recovery`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email })
});
assert.equal(recovery.success, true);
const outbox = await json(`${emulator}/emulator/v1/projects/demo-moneyhub/oobCodes`);
assert.ok(outbox.oobCodes.some((code) => code.email === email && code.requestType === 'PASSWORD_RESET'));

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${frontend}/login`);
  await page.reload();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Metas', exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Metas', exact: true }).click();
  await expect(page.getByText('Reserva de emergência', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await expect(page.getByText('Revisar orçamento', { exact: true }).first()).toBeVisible();
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
console.log('Compose smoke passed: demo login, seeded data, Web routing, GraphQL and emulated password recovery.');
