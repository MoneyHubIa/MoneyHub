import { expect, test, type Page } from '@playwright/test';
import { createEmulatorUser, deleteEmulatorUser, login, uniqueCredentials } from '../fixtures/auth';

async function choose(page: Page, label: string, option: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('button', { name: option, exact: true }).click();
}

for (const width of [1280, 390]) test(`@financial imports CSV, persists settled accounts and blocks reimport at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const credentials = uniqueCredentials('statement');
  const { uid } = await createEmulatorUser({ ...credentials, emailVerified: true });
  try {
    await login(page, credentials.email, credentials.password);
    await page.getByLabel('Nome completo').fill('Pessoa Importação E2E');
    await page.getByRole('button', { name: 'Concluir Cadastro' }).click();
    const navigate = async (name: string) => {
      const button = page.getByRole('button', { name: width < 768 ? `Pílula ${name}` : name, exact: true });
      await button.scrollIntoViewIfNeeded();
      await button.click();
    };
    await navigate('Categorias');
    await page.getByLabel('Nome da categoria').fill('Extrato E2E');
    await page.getByRole('button', { name: 'Adicionar Categoria' }).click();
    await expect(page.getByText('Extrato E2E', { exact: true })).toBeVisible();
    await navigate('Extrato');
    const date = new Date().toISOString().slice(0, 10).split('-').reverse().join('/');
    const file = { name: 'extrato.csv', mimeType: 'text/csv', buffer: Buffer.from(`Data;Descrição;Valor\n${date};Recebimento importado;1.000,01\n${date};Mercado importado;-100,01`) };
    const upload = async () => {
      await page.getByRole('button', { name: 'Importar extrato', exact: true }).click();
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Selecionar OFX ou CSV' }).click();
      await (await chooser).setFiles(file);
      await page.getByRole('button', { name: 'Gerar prévia' }).click();
      await expect(page.getByText('Revisar extrato.csv', { exact: true })).toBeVisible();
    };
    await upload();
    await choose(page, 'Categoria padrão das entradas', 'Extrato E2E');
    await choose(page, 'Categoria padrão das saídas', 'Extrato E2E');
    await page.getByRole('button', { name: 'Confirmar importação (2)', exact: true }).click();
    await expect(page.getByText('Importação concluída', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Concluir', exact: true }).click();
    await expect(page.getByText('Recebimento importado', { exact: true })).toBeVisible();
    await expect(page.getByText('Mercado importado', { exact: true })).toBeVisible();
    await page.reload();
    await navigate('Extrato');
    await upload();
    await expect(page.getByText('Já importada. Esta linha será ignorada.')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Confirmar importação (0)' })).toBeDisabled();
    await page.getByRole('button', { name: 'Fechar modal', exact: true }).click();
    await navigate('Dashboard');
    await expect(page.getByLabel('Saldo das contas', { exact: true }).getByText('R$ 900,00', { exact: true })).toBeVisible();
  } finally { await deleteEmulatorUser(uid); }
});
