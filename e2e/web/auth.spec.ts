import { expect, test } from '@playwright/test';
import {
  createEmulatorUser,
  deleteEmulatorUser,
  deleteEmulatorUserByEmail,
  login,
  uniqueCredentials
} from '../fixtures/auth';

test('@auth validates registration and registers through the UI', async ({ page }) => {
  const credentials = uniqueCredentials('register');
  try {
    await page.goto('/register');
    await page.getByLabel('Email', { exact: true }).fill(credentials.email);
    await page.getByLabel('Senha', { exact: true }).fill(credentials.password);
    await page.getByLabel('Confirmar senha', { exact: true }).fill('senha-diferente');
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('As senhas nao coincidem.');

    await page.getByLabel('Confirmar senha', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await expect(page.getByRole('heading', { name: /verifique/i })).toBeVisible();
  } finally {
    await deleteEmulatorUserByEmail(credentials.email);
  }
});

test('@auth logs in, restores the session, and logs out', async ({ page }) => {
  const credentials = uniqueCredentials('login');
  const { uid } = await createEmulatorUser({ ...credentials, emailVerified: true });
  try {
    await login(page, credentials.email, credentials.password);
    await expect(page.getByRole('heading', { name: 'Bem-vindo ao MoneyHub!' })).toBeVisible();
    await page.getByLabel('Nome completo').fill('Pessoa E2E');
    await page.getByRole('button', { name: 'Concluir Cadastro' }).click();
    await expect(page.getByText('Dashboard financeiro')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Dashboard financeiro')).toBeVisible();
    await page.getByRole('button', { name: 'Sair' }).click();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible();
  } finally {
    await deleteEmulatorUser(uid);
  }
});

test('@auth shows a neutral invalid-credential message', async ({ page }) => {
  const credentials = uniqueCredentials('wrong-password');
  const { uid } = await createEmulatorUser({ ...credentials, emailVerified: true });
  try {
    await login(page, credentials.email, 'senha-incorreta');
    await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.');
  } finally {
    await deleteEmulatorUser(uid);
  }
});
