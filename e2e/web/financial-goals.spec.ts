import { expect, test, type Page } from '@playwright/test';
import { createEmulatorUser, deleteEmulatorUser, login, uniqueCredentials } from '../fixtures/auth';

async function bootstrap(page: Page, credentials: { email: string; password: string }) {
  await login(page, credentials.email, credentials.password);
  await expect(page.getByRole('heading', { name: 'Bem-vindo ao MoneyHub!' })).toBeVisible();
  await page.getByLabel('Nome completo').fill('Metas E2E');
  await page.getByRole('button', { name: 'Concluir Cadastro' }).click();
  await expect(page.getByText('Dashboard financeiro')).toBeVisible();
}
test('@financial goals persist progress, movements, dashboard and isolate accounts', async ({ page, browser }) => {
  const credentials = uniqueCredentials('goals');
  const otherCredentials = uniqueCredentials('other-goals');
  const owner = await createEmulatorUser({ ...credentials, emailVerified: true });
  const other = await createEmulatorUser({ ...otherCredentials, emailVerified: true });
  const otherContext = await browser.newContext();
  try {
    await bootstrap(page, credentials);
    await page.getByRole('button', { name: 'Metas', exact: true }).click();
    await page.getByRole('button', { name: 'Nova meta', exact: true }).click();
    await page.getByLabel('Nome da meta', { exact: true }).fill('Reserva E2E');
    await page.getByLabel('Valor-alvo', { exact: true }).fill('1000');
    await page.getByLabel('Início da meta', { exact: true }).fill('01/01/2026');
    await page.getByLabel('Prazo da meta', { exact: true }).fill('01/01/2027');
    await page.getByRole('button', { name: 'Salvar meta' }).click();
    await expect(page.getByText('Reserva E2E', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Aportar em Reserva E2E' }).click();
    await page.getByLabel('Valor do movimento').fill('250');
    await page.getByRole('button', { name: 'Registrar aporte' }).click();
    await expect(page.getByText('25%', { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Metas', exact: true }).click();
    await expect(page.getByText('25%', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Retirar de Reserva E2E' }).click();
    await page.getByLabel('Valor do movimento').fill('50');
    await page.getByRole('button', { name: 'Registrar retirada' }).click();
    await expect(page.getByText('20%', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Histórico de Reserva E2E' }).click();
    await expect(page.getByText('Retirada · R$ 50,00')).toBeVisible();
    await expect(page.getByText('Aporte · R$ 250,00')).toBeVisible();
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
    await expect(page.getByLabel('Metas no dashboard')).toContainText('R$ 200,00');
    await expect(page.getByLabel('Resumo financeiro')).toContainText('R$ 0,00');
    const otherPage = await otherContext.newPage();
    await bootstrap(otherPage, otherCredentials);
    await otherPage.getByRole('button', { name: 'Metas', exact: true }).click();
    await expect(otherPage.getByText('Crie sua primeira meta financeira.')).toBeVisible();
    await expect(otherPage.getByText('Reserva E2E', { exact: true })).toHaveCount(0);
    // GraphQL detail and mutation authorization are also checked in service/Postgres tests.
  } finally {
    await otherContext.close();
    await deleteEmulatorUser(owner.uid);
    await deleteEmulatorUser(other.uid);
  }
});
