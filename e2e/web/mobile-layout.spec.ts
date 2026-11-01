import { expect, test, type Locator, type Page } from '@playwright/test';
import { createEmulatorUser, deleteEmulatorUser, login, uniqueCredentials } from '../fixtures/auth';

async function expectTextContained(locator: Locator) {
  await expect(locator).toBeVisible();
  expect(await locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const parent = element.parentElement!.getBoundingClientRect();
    return box.left >= parent.left - 1 && box.right <= parent.right + 1
      && box.left >= 0 && box.right <= window.innerWidth
      && element.scrollHeight <= element.clientHeight + 1
      && element.scrollWidth <= element.clientWidth + 1;
  })).toBe(true);
}

async function expectCashFlowBlocksContained(page: Page) {
  const summary = page.getByTestId('cash-flow-summary');
  await expect(summary).toBeVisible();
  const summaryBox = (await summary.boundingBox())!;
  const boxes = [];
  for (const id of ['cash-flow-total-income', 'cash-flow-total-expense', 'cash-flow-net-balance']) {
    const cell = page.getByTestId(id);
    const box = (await cell.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(summaryBox.x);
    expect(box.x + box.width).toBeLessThanOrEqual(summaryBox.x + summaryBox.width + 1);
    expect(box.y).toBeGreaterThanOrEqual(summaryBox.y);
    expect(box.y + box.height).toBeLessThanOrEqual(summaryBox.y + summaryBox.height + 1);
    for (const previous of boxes) {
      const overlapWidth = Math.min(box.x + box.width, previous.x + previous.width) - Math.max(box.x, previous.x);
      const overlapHeight = Math.min(box.y + box.height, previous.y + previous.height) - Math.max(box.y, previous.y);
      expect(overlapWidth <= 1 || overlapHeight <= 1).toBe(true);
    }
    boxes.push(box);
  }
  const details = page.getByTestId('cash-flow-point-details');
  await expect(details).toBeVisible();
  expect((await details.boundingBox())!.y).toBeGreaterThanOrEqual(summaryBox.y + summaryBox.height);
  await expectTextContained(page.getByText('Saldo do Período', { exact: true }));
}

test('mobile navigation and period comparison show complete labels', async ({ page }) => {
  const credentials = uniqueCredentials('mobile-layout');
  const { uid } = await createEmulatorUser({ ...credentials, emailVerified: true });
  try {
    await page.route('**/graphql', async (route) => {
      const request = route.request().postDataJSON() as { query?: string };
      if (!request?.query?.includes('query CashFlow(')) return route.continue();
      await route.fulfill({ json: { data: { cashFlow: {
        granularity: 'DAILY',
        totals: { totalIncome: '0.00', totalExpense: '0.00', netBalance: '0.00' },
        dataPoints: [{ label: '30/11', date: '2026-11-30', income: '0.00', expense: '0.00', net: '0.00', accumulatedBalance: '0.00' }]
      } } } });
    });
    await page.setViewportSize({ width: 390, height: 900 });
    await login(page, credentials.email, credentials.password);
    await page.getByLabel('Nome completo').fill('Pessoa Mobile');
    await page.getByRole('button', { name: 'Concluir Cadastro' }).click();

    for (const width of [320, 360, 390, 430, 768]) {
      await page.setViewportSize({ width, height: 900 });
      const accountsPill = page.getByRole('button', {
        name: 'Pílula Contas a Pagar', exact: true
      });
      await accountsPill.scrollIntoViewIfNeeded();
      await expectTextContained(accountsPill.getByText('Contas a Pagar', { exact: true }));
      await expectTextContained(page.getByRole('heading', {
        name: 'Comparativo de Períodos Personalizado', exact: true
      }));
      await expectTextContained(page.getByText('Mesmo Mês do Ano Anterior (YoY)', { exact: true }));
      await expectCashFlowBlocksContained(page);
    }

    await page.getByRole('button', { name: 'Pílula Contas a Pagar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Nova Conta a Pagar', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Pílula Contas a Receber', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Nova Conta a Receber', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Pílula Dashboard', exact: true }).click();
    await page.setViewportSize({ width: 1024, height: 900 });
    await expectTextContained(page.getByRole('heading', {
      name: 'Comparativo de Períodos Personalizado', exact: true
    }));
  } finally {
    await deleteEmulatorUser(uid);
  }
});
