import { expect, test } from '@playwright/test';
import { createEmulatorUser, deleteEmulatorUser, login, uniqueCredentials } from '../fixtures/auth';

test('@financial accounts, installments, card payment and scheduled transfer', async ({ page }) => {
  const credentials = uniqueCredentials('banking');
  const { uid } = await createEmulatorUser({ ...credentials, emailVerified: true });
  try {
    await login(page, credentials.email, credentials.password);
    await page.getByLabel('Nome completo').fill('Pessoa Banking');
    await page.getByRole('button', { name: 'Concluir Cadastro' }).click();
    await page.getByRole('button', { name: 'Contas financeiras', exact: true }).click();
    await expect(page.getByText('Conta Corrente', { exact: true })).toBeVisible();
    await expect(page.getByText('Investimentos', { exact: true }).first()).toBeVisible();
    await page.getByLabel('Nome da conta').fill('Reserva E2E');
    await page.getByLabel('Número da conta').fill('0001-0');
    await page.getByLabel('Saldo inicial').fill('1000');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText('Reserva E2E', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Categorias', exact: true }).click();
    await page.getByLabel('Nome da categoria').fill('Compras E2E');
    await page.getByRole('button', { name: 'Adicionar Categoria' }).click();
    await expect(page.getByText('Compras E2E', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Contas a Pagar', exact: true }).click();
    await page.getByRole('button', { name: 'Nova Conta a Pagar', exact: true }).click();
    await page.getByLabel('Descrição da conta a pagar').fill('Parcelas E2E');
    await page.getByLabel('Valor da conta a pagar').fill('100');
    await page.getByRole('button', { name: 'Categoria', exact: true }).click();
    await page.getByRole('button', { name: 'Compras E2E', exact: true }).click();
    await page.getByRole('button', { name: 'Parcelamento', exact: true }).click();
    await page.getByRole('button', { name: 'Parcelar ou Repetir', exact: true }).click();
    await page.getByLabel('Total de parcelas', { exact: true }).fill('2');
    await page.getByRole('button', { name: 'Agendar Conta a Pagar' }).click();
    await expect(page.getByText('Parcelas E2E (1/2)', { exact: true })).toBeVisible();
    await expect(page.getByText('Parcelas E2E (2/2)', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Cartões de crédito', exact: true }).click();
    await page.getByRole('button', { name: 'Conta financeira', exact: true }).click();
    await page.getByRole('button', { name: 'Reserva E2E', exact: true }).click();
    await page.getByLabel('Nome do cartão').fill('Cartão E2E');
    await page.getByLabel('Limite', { exact: true }).fill('1000');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.getByRole('button', { name: /Cartão E2E • Visa/ }).click();
    await page.getByRole('button', { name: 'Registrar compra', exact: true }).click();
    await page.getByLabel('Descrição da compra').fill('Compra E2E');
    await page.getByLabel('Valor total da compra').fill('100');
    await page.getByRole('button', { name: 'Cartão', exact: true }).click();
    await page.getByRole('button', { name: /Cartão E2E • Visa/, exact: true }).click();
    await page.getByRole('button', { name: 'Categoria', exact: true }).click();
    await page.getByRole('button', { name: 'Compras E2E', exact: true }).click();
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.getByRole('button', { name: /^Pagar fatura \d{4}/ }).click();
    await page.getByLabel('Valor do pagamento').fill('25');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText(/Pago 25.00 • Em aberto 75.00/)).toBeVisible();

    await page.getByRole('button', { name: 'Transferências', exact: true }).click();
    await page.getByRole('button', { name: 'Conta de origem', exact: true }).click();
    await page.getByRole('button', { name: 'Reserva E2E', exact: true }).click();
    await page.getByRole('button', { name: 'Conta destino', exact: true }).click();
    await page.getByRole('button', { name: 'Investimentos', exact: true }).click();
    await page.getByLabel('Valor', { exact: true }).fill('50');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.getByRole('button', { name: 'Efetivar transferência' }).click();
    await expect(page.getByText(/50.*COMPLETED/)).toBeVisible();
  } finally { await deleteEmulatorUser(uid); }
});
