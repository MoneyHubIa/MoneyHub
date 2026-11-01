import { expect, test, type Page } from '@playwright/test';
import { createEmulatorUser, deleteEmulatorUser, login, uniqueCredentials } from '../fixtures/auth';

const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

async function expectHorizontalOptionsContained(page: Page, id: string) {
  const options = page.getByTestId(id);
  await expect(options).toBeVisible();
  expect(await options.evaluate((scroll) => {
    const bounds = scroll.getBoundingClientRect();
    const items = [...scroll.querySelectorAll('[role="button"], [tabindex="0"]')];
    return items.length > 0 && items.every((item) => {
      const box = item.getBoundingClientRect();
      return box.top >= bounds.top - 1 && box.bottom <= bounds.bottom + 1;
    });
  })).toBe(true);
}

async function expectChatInputAtBottom(page: Page) {
  const chat = page.getByTestId('ai-chat-window');
  await expect(chat).toBeVisible();
  await expect.poll(async () => {
    const window = (await chat.boundingBox())!;
    const card = (await page.getByTestId('ai-assistant-card').boundingBox())!;
    const input = (await page.getByTestId('ai-input-bar').boundingBox())!;
    const messages = (await page.getByTestId('ai-messages').boundingBox())!;
    return Math.abs(window.y + window.height - input.y - input.height) <= 2
      && Math.abs(card.y + card.height - input.y - input.height) <= 3
      && input.x >= window.x && input.x + input.width <= window.x + window.width + 1
      && messages.y + messages.height <= input.y + 1 && messages.height > 0;
  }).toBe(true);
}

async function expectSelectorsContained(page: Page, mobile: boolean) {
  await expect(page.getByTestId('period-selectors')).toBeVisible();
  await expect.poll(() => page.getByTestId('period-selectors').evaluate((panel) => {
    const bounds = panel.getBoundingClientRect();
    const groups = ['period-base-selector', 'period-comparison-selector'].map((id) =>
      panel.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect());
    const contained = groups.every((box) => box.width > 0 && box.height > 0
      && box.top >= bounds.top && box.bottom <= bounds.bottom + 1
      && box.left >= bounds.left && box.right <= bounds.right + 1);
    const separate = groups[0].bottom <= groups[1].top || groups[0].right <= groups[1].left;
    const results = document.querySelector('[data-testid="period-comparison-results"]')!.getBoundingClientRect();
    return contained && separate && results.top >= bounds.bottom;
  })).toBe(true);

  if (mobile) {
    for (const [id, period] of [['period-base-selector', 'base'], ['period-comparison-selector', 'comparado']]) {
      const group = page.getByTestId(id!);
      for (const month of months) {
        const button = group.getByRole('button', { name: `Selecionar mês ${period} ${month}`, exact: true });
        expect(await button.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const group = element.closest('[data-testid]')!.getBoundingClientRect();
          return box.top >= group.top && box.bottom <= group.bottom + 1
            && box.left >= group.left && box.right <= group.right + 1;
        })).toBe(true);
      }
    }
  }
}

for (const mode of ['dark', 'light']) {
  test(`period selectors retain all controls within their cards in ${mode} mode`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const credentials = uniqueCredentials(`selectors-${mode}`);
    const { uid } = await createEmulatorUser({ ...credentials, emailVerified: true });
    const inputs: Array<Record<string, number>> = [];
    let aiRequests = 0;
    try {
      await page.addInitScript((theme) => localStorage.setItem('@moneyhub:theme_mode', theme), mode);
      await page.route('**/graphql', async (route) => {
        const request = route.request().postDataJSON() as { operationName: string; variables?: { input?: Record<string, number> } };
        const input = request.variables?.input;
        if (request.operationName === 'AskAiAssistant') {
          aiRequests += 1;
          await route.fulfill({ json: aiRequests === 1
            ? { errors: [{ message: 'Falha simulada da IA' }] }
            : { data: { askAiAssistant: {
              answer: 'Resposta financeira detalhada.\n'.repeat(30), provider: 'mock', model: 'mock', latencyMs: 10,
              usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }, contextPeriod: '11/2026', contextVersion: 'v1'
            } } }
          });
          return;
        }
        if (request.operationName === 'PeriodComparison' && input) inputs.push(input);
        const metrics = (month: number, year: number) => ({ month, year, label: `${month}/${year}`, totalIncome: '0.00', totalExpense: '1212.00', netBalance: '-1212.00', savingsRate: 0, incomeCount: 0, expenseCount: 1 });
        await route.fulfill({ json: { data: {
          me: { id: uid, needsProfileBootstrap: false },
          myProfile: { id: uid, fullName: 'Pessoa Mobile', preferredCurrency: 'BRL', theme: mode.toUpperCase() },
          dashboardSummary: { totalIncome: '0.00', totalExpense: '1212.00', netBalance: '-1212.00', incomeCount: 0, expenseCount: 1, month: 11, year: 2026 },
          myFinancialAccounts: [{ id: 'account', name: 'Conta Corrente', type: 'CHECKING', accountNumber: null, additionalData: null, initialBalance: '0.00', balance: '0.00', isDefault: true, archived: false }],
          myAccountsPayable: [], myAccountsReceivable: [], overdueAccountsPayable: [], overdueAccountsReceivable: [],
          myFinancialGoals: [], financialGoalsSummary: { count: 0, totalAccumulated: '0.00', totalTarget: '0.00' },
          myNotifications: [], syncAgendaNotifications: [],
          myCategories: [{ id: 'category', name: 'Despesas de moradia e investimentos de longo prazo', type: 'EXPENSE', color: '#008866', icon: 'Tag' }],
          myCostCenters: [{ id: 'center', name: 'Escritório e serviços de manutenção', description: null }],
          myRecurringTransactions: [],
          cashFlow: { granularity: 'DAILY', dataPoints: [], totals: { totalIncome: '0.00', totalExpense: '1212.00', netBalance: '-1212.00' } },
          categoryAnalysis: { type: 'EXPENSE', month: 11, year: 2026, totalAmount: '0.00', items: [] },
          periodComparison: {
            basePeriod: metrics(input?.baseMonth ?? 11, input?.baseYear ?? 2026),
            comparisonPeriod: metrics(input?.comparisonMonth ?? 10, input?.comparisonYear ?? 2026),
            delta: { incomeDelta: '0.00', incomePercentage: 0, expenseDelta: '0.00', expensePercentage: 0, netBalanceDelta: '0.00', netBalancePercentage: 0, savingsRateDelta: 0 }
          }
        } } });
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await login(page, credentials.email, credentials.password);
      for (const width of [320, 360, 390, 430, 768, 1024]) {
        await page.setViewportSize({ width, height: 844 });
        await expectSelectorsContained(page, width < 1024);
        if (width === 390) {
          await page.getByTestId('period-selectors').screenshot({ path: testInfo.outputPath(`selectors-${mode}.png`) });
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'Selecionar mês base Dez', exact: true }).click();
      await page.getByRole('button', { name: 'Selecionar mês comparado Jan', exact: true }).click();
      await page.getByRole('button', { name: 'Diminuir ano base', exact: true }).click();
      await page.getByRole('button', { name: 'Aumentar ano comparado', exact: true }).click();
      await expect.poll(() => inputs.some((input) => input.baseMonth === 12 && input.comparisonMonth === 1 && input.baseYear !== input.comparisonYear)).toBe(true);
      await expectSelectorsContained(page, true);
      await page.getByRole('button', { name: 'Pílula Categorias', exact: true }).click();
      await expectHorizontalOptionsContained(page, 'category-icon-options');
      await page.getByRole('button', { name: 'Pílula Recorrências', exact: true }).click();
      await expectHorizontalOptionsContained(page, 'recurrence-category-options');
      const centerSelector = page.getByRole('button', { name: 'Centro de Custo (Opcional)', exact: true });
      const centerOption = page.getByRole('button', { name: 'Escritório e serviços de manutenção', exact: true });
      await expect(centerOption).toHaveCount(0);
      await centerSelector.click();
      await expect(centerOption).toBeVisible();
      const centerBox = await centerOption.boundingBox();
      expect(centerBox!.x).toBeGreaterThanOrEqual(0);
      expect(centerBox!.x + centerBox!.width).toBeLessThanOrEqual(390);
      await centerOption.click();
      await expect(centerSelector).toHaveAttribute('aria-expanded', 'false');
      await page.getByRole('button', { name: 'Pílula MoneyHub IA', exact: true }).click();
      for (const width of [320, 390, 768, 1024]) {
        await page.setViewportSize({ width, height: 844 });
        await expectChatInputAtBottom(page);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByLabel('Mensagem para a IA').fill('Primeira pergunta');
      await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
      await expect(page.getByText(/Falha simulada da IA/)).toBeVisible();
      await expectChatInputAtBottom(page);
      await page.getByLabel('Mensagem para a IA').fill('Segunda pergunta\ncom mais detalhes');
      await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
      await expect(page.getByText('Resposta financeira detalhada.', { exact: true }).first()).toBeVisible();
      await expectChatInputAtBottom(page);
      await page.getByTestId('ai-chat-window').screenshot({ path: testInfo.outputPath(`ai-fullscreen-${mode}.png`) });
      await page.getByRole('button', { name: 'Pílula Dashboard', exact: true }).click();
      await page.getByRole('button', { name: 'Abrir Assistente Financeiro IA', exact: true }).click();
      for (const width of [320, 390, 1024]) {
        await page.setViewportSize({ width, height: 844 });
        await expectChatInputAtBottom(page);
      }
    } finally {
      await deleteEmulatorUser(uid);
    }
  });
}
