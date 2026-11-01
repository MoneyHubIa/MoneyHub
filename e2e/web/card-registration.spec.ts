import { expect, test } from '@playwright/test';
import { createEmulatorUser, deleteEmulatorUser, login, uniqueCredentials } from '../fixtures/auth';

for (const theme of ['dark', 'light']) {
  test(`credit card registration uses compact fields and selectors in ${theme} mode`, async ({ page }) => {
    test.setTimeout(90_000);
    const credentials = uniqueCredentials(`card-registration-${theme}`);
    const { uid } = await createEmulatorUser({ ...credentials, emailVerified: true });
    const cards: Record<string, unknown>[] = [];
    const saves: Record<string, unknown>[] = [];
    try {
      await page.addInitScript(mode => localStorage.setItem('@moneyhub:theme_mode', mode), theme);
      await page.route('**/graphql', async route => {
        const { operationName, variables } = route.request().postDataJSON() as { operationName: string; variables?: { input?: Record<string, unknown> } };
        if (operationName === 'SaveCard') {
          const input = variables?.input ?? {};
          saves.push(input);
          const row = { ...input, id: input.id ?? `card-${cards.length + 1}`, statements: [], payments: [] };
          const index = cards.findIndex(card => card.id === row.id);
          if (index < 0) cards.push(row); else cards[index] = row;
          await route.fulfill({ json: { data: { saveCreditCard: { id: row.id } } } });
          return;
        }
        const metrics = { month: 11, year: 2026, label: 'Novembro/2026', totalIncome: '0.00', totalExpense: '0.00', netBalance: '0.00', savingsRate: 0, incomeCount: 0, expenseCount: 0 };
        await route.fulfill({ json: { data: {
          me: { id: uid, needsProfileBootstrap: false },
          myProfile: { id: uid, preferredCurrency: 'BRL', fullName: 'Pessoa Cadastro', theme: theme.toUpperCase() },
          dashboardSummary: metrics,
          myFinancialAccounts: [
            { id: 'bank', name: 'Banco', type: 'CHECKING', accountNumber: null, additionalData: null, initialBalance: '0.00', balance: '0.00', isDefault: true, archived: false },
            { id: 'reserve', name: 'Reserva', type: 'SAVINGS', accountNumber: null, additionalData: null, initialBalance: '0.00', balance: '0.00', isDefault: false, archived: false }
          ],
          myCreditCards: cards, creditCardBrands: ['Visa', 'Mastercard', 'Outra'], myTransfers: [],
          myCategories: [], myCostCenters: [], myIncomes: [], myExpenses: [], myAccountsPayable: [], myAccountsReceivable: [],
          overdueAccountsPayable: [], overdueAccountsReceivable: [], myFinancialGoals: [],
          financialGoalsSummary: { count: 0, totalAccumulated: '0.00', totalTarget: '0.00' },
          syncAgendaNotifications: [], syncFinancialSeries: true, myNotifications: [],
          cashFlow: { granularity: 'DAILY', dataPoints: [], totals: metrics },
          categoryAnalysis: { type: 'EXPENSE', month: 11, year: 2026, totalAmount: '0.00', items: [] },
          periodComparison: { basePeriod: metrics, comparisonPeriod: metrics, delta: { incomeDelta: '0.00', incomePercentage: 0, expenseDelta: '0.00', expensePercentage: 0, netBalanceDelta: '0.00', netBalancePercentage: 0, savingsRateDelta: 0 } }
        } } });
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await login(page, credentials.email, credentials.password);
      await expect(page.getByRole('heading', { name: 'Dashboard financeiro', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Cartões de crédito', exact: true }).click();

      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.getByRole('button', { name: 'Cadastrar cartão', exact: true }).click();
        const form = page.getByTestId('credit-card-registration');
        const dynamic = width === 390;
        await form.getByRole('button', { name: 'Conta financeira', exact: true }).click();
        await form.getByRole('button', { name: 'Reserva', exact: true }).click();
        const name = `Cartão-${theme}-${width}`;
        await form.getByLabel('Nome do cartão', { exact: true }).fill(name);
        await form.getByLabel('Limite', { exact: true }).fill('1500,25');
        await form.getByRole('button', { name: 'Bandeira', exact: true }).click();
        await form.getByRole('button', { name: dynamic ? 'Outra' : 'Mastercard', exact: true }).click();
        if (dynamic) await form.getByLabel('Nome da outra bandeira', { exact: true }).fill('Bandeira local');
        for (const [label, checked] of [['Fechamento dinâmico', dynamic], ['Vencimento no próximo dia útil', true], ['Cartão principal', true]] as const) {
          const control = form.getByRole('switch', { name: label, exact: true });
          if (await control.isChecked() !== checked) await control.click();
        }
        await form.getByLabel('Dia de vencimento', { exact: true }).fill('31');
        await expect(form.getByRole('button', { name: 'Aumentar dia de vencimento', exact: true })).toBeDisabled();
        await form.getByRole('button', { name: 'Diminuir dia de vencimento', exact: true }).click();
        await expect(form.getByLabel('Dia de vencimento', { exact: true })).toHaveValue('30');
        await form.getByLabel('Dia de vencimento', { exact: true }).fill('10');
        await form.getByLabel(dynamic ? 'Dias antes do vencimento' : 'Dia de fechamento', { exact: true }).fill(dynamic ? '7' : '3');
        expect((await form.getByLabel('Limite', { exact: true }).boundingBox())!.width).toBeLessThanOrEqual(96);
        for (const label of ['Dia de vencimento', dynamic ? 'Dias antes do vencimento' : 'Dia de fechamento']) {
          const box = await form.getByLabel(label, { exact: true }).evaluate(element => {
            const bounds = element.parentElement!.parentElement!.parentElement!.getBoundingClientRect();
            return { width: bounds.width, height: bounds.height };
          });
          expect(box.width).toBeLessThanOrEqual(96);
          expect(box.height).toBeLessThanOrEqual(32);
        }
        const accountBox = (await form.getByRole('button', { name: 'Conta financeira', exact: true }).boundingBox())!;
        const brandBox = (await form.getByRole('button', { name: 'Bandeira', exact: true }).boundingBox())!;
        expect(accountBox.width).toBeLessThanOrEqual(500);
        expect(Math.abs(accountBox.width - brandBox.width)).toBeLessThanOrEqual(1);
        for (const label of ['Vencimento no próximo dia útil', 'Fechamento dinâmico', 'Cartão principal']) {
          expect((await form.getByRole('switch', { name: label, exact: true }).boundingBox())!.height).toBeLessThanOrEqual(28);
          expect(await form.getByText(label, { exact: true }).evaluate(element => {
            const range = document.createRange();
            range.selectNodeContents(element);
            return range.getClientRects().length === 1 && element.scrollWidth <= element.clientWidth + 1;
          })).toBe(true);
        }
        if (width === 390) await form.screenshot({ path: test.info().outputPath(`card-registration-${theme}.png`) });
        const count = saves.length;
        await page.getByRole('button', { name: 'Salvar', exact: true }).click();
        await expect.poll(() => saves.length).toBe(count + 1);
        await expect(page.getByText('Operação concluída.', { exact: true })).toBeVisible();
        expect(saves.at(-1)).toEqual({
          name, financialAccountId: 'reserve', brand: dynamic ? 'Bandeira local' : 'Mastercard', creditLimit: '1500.25',
          dueDay: 10, closingDay: dynamic ? 10 : 3, dynamicDays: dynamic ? 7 : null,
          businessDays: true, isPrimary: true, archived: false
        });
      }
      await page.getByRole('button', { name: `Editar Cartão-${theme}-390`, exact: true }).click();
      const form = page.getByTestId('credit-card-registration');
      await expect(form.getByRole('button', { name: 'Bandeira', exact: true })).toContainText('Outra');
      await expect(form.getByLabel('Nome da outra bandeira', { exact: true })).toHaveValue('Bandeira local');
      await expect(form.getByRole('switch', { name: 'Fechamento dinâmico', exact: true })).toBeChecked();
      const count = saves.length;
      await page.getByRole('button', { name: 'Salvar', exact: true }).click();
      await expect.poll(() => saves.length).toBe(count + 1);
      expect(saves.at(-1)).toMatchObject({ id: 'card-2', brand: 'Bandeira local', dynamicDays: 7 });
    } finally {
      await deleteEmulatorUser(uid);
    }
  });
}
