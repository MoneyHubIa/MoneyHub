import { expect, test, type Page } from '@playwright/test';
import {
  createEmulatorUser,
  deleteEmulatorUser,
  login,
  uniqueCredentials
} from '../fixtures/auth';

async function bootstrap(page: Page, email: string, password: string) {
  await login(page, email, password);
  await expect(page.getByRole('heading', { name: 'Bem-vindo ao MoneyHub!' })).toBeVisible();
  await page.getByLabel('Nome completo').fill('Pessoa Financeira E2E');
  await page.getByRole('button', { name: 'Concluir Cadastro' }).click();
  await expect(page.getByText('Dashboard financeiro')).toBeVisible();
}

async function createCategory(page: Page) {
  await page.getByRole('button', { name: 'Categorias' }).click();
  await page.getByLabel('Nome da categoria').fill('Geral E2E');
  await page.getByRole('button', { name: 'Adicionar Categoria' }).click();
  await expect(page.getByText('Geral E2E')).toBeVisible();
}

async function createTransaction(page: Page, type: 'Receita' | 'Despesa', description: string, amount: string) {
  await page.getByRole('button', { name: 'Transações' }).click();
  await page.getByText(type, { exact: true }).click();
  await page.getByLabel('Descrição da transação').fill(description);
  await page.getByLabel('Valor da transação').fill(amount);
  await page.getByRole('button', { name: 'Geral E2E' }).click();
  await page.getByRole('button', { name: 'Adicionar transação' }).click();
  await expect(page.getByText(description)).toBeVisible();
}

test('@financial persists income, expense, balance, and payable', async ({ page }) => {
  const credentials = uniqueCredentials('financial');
  const { uid } = await createEmulatorUser({ ...credentials, emailVerified: true });
  try {
    await bootstrap(page, credentials.email, credentials.password);
    await createCategory(page);
    await createTransaction(page, 'Receita', 'Receita E2E', '1000');
    await createTransaction(page, 'Despesa', 'Despesa E2E', '250');

    await page.getByRole('button', { name: 'Dashboard' }).click();
    await expect(
      page.getByLabel('Resumo financeiro').getByText('R$ 750,00', { exact: true })
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByLabel('Resumo financeiro').getByText('R$ 750,00', { exact: true })
    ).toBeVisible();

    await page.getByRole('button', { name: 'A Pagar' }).click();
    await page.getByLabel('Descrição da conta a pagar').fill('Conta E2E');
    await page.getByLabel('Valor da conta a pagar').fill('100');
    await page.getByRole('button', { name: 'Geral E2E' }).click();
    await page.getByRole('button', { name: 'Agendar Conta a Pagar' }).click();
    await expect(page.getByText('Conta E2E')).toBeVisible();
    await expect(page.getByText('Pendente', { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'A Pagar' }).click();
    await expect(page.getByText('Conta E2E')).toBeVisible();
  } finally {
    await deleteEmulatorUser(uid);
  }
});

test('@financial gets a mock AI response', async ({ page }) => {
  const credentials = uniqueCredentials('ai');
  const { uid } = await createEmulatorUser({ ...credentials, emailVerified: true });
  try {
    await bootstrap(page, credentials.email, credentials.password);
    await page.getByRole('button', { name: 'Abrir Assistente Financeiro IA' }).click();
    await page.getByLabel('Mensagem para a IA').fill('Qual é meu resumo financeiro?');
    await page.getByRole('button', { name: 'Enviar mensagem' }).click();
    await expect(page.getByText('Qual é meu resumo financeiro?')).toBeVisible();
    await expect(page.getByTestId('chat-messages-list')).toContainText(
      /Analisando seu contexto financeiro/
    );
  } finally {
    await deleteEmulatorUser(uid);
  }
});
