import { expect, test } from '@playwright/test';
import { createEmulatorUser, deleteEmulatorUser, login, uniqueCredentials } from '../fixtures/auth';

for (const theme of ['dark', 'light']) {
  test(`unified creation dispatches to movements or commitments in ${theme} mode`, async ({ page }) => {
    test.setTimeout(120_000);
    const credentials = uniqueCredentials(`unified-${theme}`);
    const { uid } = await createEmulatorUser({ ...credentials, emailVerified: true });
    const operations: Array<{ name: string; input: Record<string, unknown> }> = [];
    const incomes: Record<string, unknown>[] = [], expenses: Record<string, unknown>[] = [];
    const payables: Record<string, unknown>[] = [], receivables: Record<string, unknown>[] = [];
    try {
      await page.addInitScript((mode) => localStorage.setItem('@moneyhub:theme_mode', mode), theme);
      await page.route('**/graphql', async (route) => {
        const { operationName, variables } = route.request().postDataJSON() as { operationName: string; variables?: { input?: Record<string, unknown> } };
        const input = variables?.input ?? {};
        const creates: Record<string, { field: string; rows: Record<string, unknown>[]; typename: string }> = {
          CreateIncome: { field: 'createIncome', rows: incomes, typename: 'Income' },
          CreateExpense: { field: 'createExpense', rows: expenses, typename: 'Expense' },
          CreateAccountPayable: { field: 'createAccountPayable', rows: payables, typename: 'AccountPayable' },
          CreateAccountReceivable: { field: 'createAccountReceivable', rows: receivables, typename: 'AccountReceivable' }
        };
        const create = creates[operationName];
        if (create) {
          operations.push({ name: operationName, input });
          const row = { id: `record-${operations.length}`, ...input, status: 'PENDING', paidAt: null, receivedAt: null, createdAt: '2026-11-01T00:00:00.000Z', __typename: create.typename };
          create.rows.push(row);
          await route.fulfill({ json: { data: { [create.field]: row } } });
          return;
        }
        if (operationName === 'CreateCommitmentSeries') {
          operations.push({ name: operationName, input });
          await route.fulfill({ json: { data: { createCommitmentSeries: `series-${operations.length}` } } });
          return;
        }
        if (operationName === 'Purchase') {
          operations.push({ name: operationName, input });
          await route.fulfill({ json: { data: { recordCardPurchase: true } } });
          return;
        }
        if (operationName === 'Transfer') {
          operations.push({ name: operationName, input });
          await route.fulfill({ json: { data: { createTransfer: { id: `transfer-${operations.length}` } } } });
          return;
        }
        const metrics = { month: 11, year: 2026, label: 'Novembro/2026', totalIncome: '0.00', totalExpense: '0.00', netBalance: '0.00', savingsRate: 0, incomeCount: 0, expenseCount: 0 };
        await route.fulfill({ json: { data: {
          me: { id: uid, needsProfileBootstrap: false },
          myProfile: { id: uid, preferredCurrency: 'BRL', fullName: 'Pessoa Unificada', theme: theme.toUpperCase() },
          dashboardSummary: metrics,
          myFinancialAccounts: [
            { id: 'bank', name: 'Banco', type: 'CHECKING', accountNumber: null, additionalData: null, initialBalance: '0.00', balance: '0.00', isDefault: true, archived: false },
            { id: 'reserve', name: 'Reserva', type: 'SAVINGS', accountNumber: null, additionalData: null, initialBalance: '0.00', balance: '0.00', isDefault: false, archived: false },
            { id: 'old-account', name: 'Conta arquivada', type: 'CHECKING', accountNumber: null, additionalData: null, initialBalance: '0.00', balance: '0.00', isDefault: false, archived: true }
          ],
          myCategories: [{ id: 'common', name: 'Categoria comum', type: 'BOTH', color: '#008866', icon: 'Tag' }],
          myCreditCards: [
            { id: 'card', name: 'Principal', brand: 'Visa', archived: false },
            { id: 'old-card', name: 'Arquivado', brand: 'Visa', archived: true }
          ],
          myCostCenters: [{ id: 'center', name: 'Centro financeiro', description: null }],
          myIncomes: incomes, myExpenses: expenses, myAccountsPayable: payables, myAccountsReceivable: receivables,
          overdueAccountsPayable: [], overdueAccountsReceivable: [], myFinancialGoals: [],
          financialGoalsSummary: { count: 0, totalAccumulated: '0.00', totalTarget: '0.00' },
          syncAgendaNotifications: [], syncFinancialSeries: true, myNotifications: [],
          cashFlow: { granularity: 'DAILY', dataPoints: [], totals: metrics },
          categoryAnalysis: { type: 'EXPENSE', month: 11, year: 2026, totalAmount: '0.00', items: [] },
          periodComparison: { basePeriod: metrics, comparisonPeriod: metrics, delta: { incomeDelta: '0.00', incomePercentage: 0, expenseDelta: '0.00', expensePercentage: 0, netBalanceDelta: '0.00', netBalancePercentage: 0, savingsRateDelta: 0 } }
        } } });
      });
      await login(page, credentials.email, credentials.password);
      await expect(page.getByRole('heading', { name: 'Dashboard financeiro', exact: true })).toBeVisible();
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        for (const kind of ['Pagar', 'Receber']) {
          for (const mode of ['direct', 'pending', 'Parcelar ou Repetir', 'Fixa mensal']) {
            await page.getByRole('button', { name: 'Novo lançamento rápido', exact: true }).click();
            const choices = page.getByTestId('quick-action-options');
            await expect(choices.getByRole('button')).toHaveCount(4);
            await expect(choices.getByText('Transação', { exact: true })).toHaveCount(0);
            await choices.getByRole('button', { name: `Criar Conta a ${kind}`, exact: true }).click();
            const dialog = page.getByRole('heading', { name: `Nova Conta a ${kind}`, exact: true }).locator('..').locator('..').locator('..');
            await expect(dialog.getByRole('button', { name: 'Parcelamento', exact: true })).toContainText('Não recorrente');
            await expect(dialog.getByRole('button', { name: 'Conta financeira', exact: true })).toContainText('Banco');
            const description = `${kind}-${mode}-${width}`;
            await dialog.getByLabel(`Descrição da conta a ${kind.toLowerCase()}`, { exact: true }).fill(description);
            await dialog.getByLabel(`Valor da conta a ${kind.toLowerCase()}`, { exact: true }).fill('100,01');
            await dialog.getByLabel('Data do lançamento', { exact: true }).fill('15/11/2026');
            const amountBox = (await dialog.getByLabel(`Valor da conta a ${kind.toLowerCase()}`, { exact: true }).boundingBox())!;
            const dateBox = (await dialog.getByLabel('Data do lançamento', { exact: true }).locator('..').boundingBox())!;
            const dateInputBox = (await dialog.getByLabel('Data do lançamento', { exact: true }).boundingBox())!;
            const calendarBox = (await dialog.getByRole('button', { name: 'Abrir calendário', exact: true }).boundingBox())!;
            expect(amountBox.width).toBeLessThanOrEqual(96);
            expect(dateBox.width).toBeGreaterThanOrEqual(160);
            expect(dateInputBox.x + dateInputBox.width).toBeLessThanOrEqual(dateBox.x + dateBox.width + 1);
            expect(calendarBox.x + calendarBox.width).toBeLessThanOrEqual(dateBox.x + dateBox.width + 1);
            if (width >= 390) {
              expect(dateBox.x).toBeGreaterThan(amountBox.x + amountBox.width);
              expect(Math.abs(dateBox.y - amountBox.y)).toBeLessThanOrEqual(1);
              expect(Math.abs(dateBox.height - amountBox.height)).toBeLessThanOrEqual(1);
            }
            if (mode === 'direct' && kind === 'Pagar' && width === 390) await dialog.screenshot({ path: test.info().outputPath(`amount-date-${theme}.png`) });
            await expect(dialog.getByRole('button', { name: 'Categoria comum', exact: true })).toHaveCount(0);
            await dialog.getByRole('button', { name: 'Categoria', exact: true }).click();
            await dialog.getByRole('button', { name: 'Categoria comum', exact: true }).click();
            await expect(dialog.getByRole('button', { name: 'Categoria', exact: true })).toContainText('Categoria comum');
            await expect(dialog.getByRole('button', { name: 'Categoria comum', exact: true })).toHaveCount(0);
            await expect(dialog.getByRole('button', { name: 'Parcelar ou Repetir', exact: true })).toHaveCount(0);
            await expect(dialog.getByRole('button', { name: 'Banco', exact: true })).toHaveCount(0);
            await expect(dialog.getByRole('button', { name: 'Centro financeiro', exact: true })).toHaveCount(0);
            await dialog.getByRole('button', { name: 'Conta financeira', exact: true }).click();
            await dialog.getByRole('button', { name: 'Banco', exact: true }).click();
            await dialog.getByRole('button', { name: 'Centro de Custo', exact: true }).click();
            await dialog.getByRole('button', { name: 'Centro financeiro', exact: true }).click();
            for (const label of ['Categoria', 'Parcelamento', 'Conta financeira', 'Centro de Custo']) {
              const selector = dialog.getByRole('button', { name: label, exact: true });
              await expect(selector).toHaveAttribute('aria-expanded', 'false');
              const box = (await selector.boundingBox())!;
              const bounds = (await dialog.boundingBox())!;
              expect(box.x).toBeGreaterThanOrEqual(bounds.x);
              expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
            }
            const count = operations.length;
            if (mode === 'pending') {
              await dialog.getByRole('switch', { name: 'Já efetivada', exact: true }).click();
              await expect(dialog.getByLabel('Vencimento', { exact: true })).toHaveValue('15/11/2026');
              await dialog.getByRole('button', { name: '3 dias antes', exact: true }).click();
            } else if (mode !== 'direct') {
              await dialog.getByRole('button', { name: 'Parcelamento', exact: true }).click();
              await expect(dialog.getByRole('button', { name: 'Repetir', exact: true })).toHaveCount(0);
              await dialog.getByRole('button', { name: mode, exact: true }).click();
              await expect(dialog.getByRole('switch', { name: 'Já efetivada', exact: true })).not.toBeChecked();
              if (mode !== 'Fixa mensal') {
                const first = dialog.getByLabel('Parcela inicial', { exact: true });
                const total = dialog.getByLabel('Total de parcelas', { exact: true });
                const increase = dialog.getByRole('button', { name: 'Aumentar parcela inicial', exact: true });
                const decrease = dialog.getByRole('button', { name: 'Diminuir parcela inicial', exact: true });
                await expect(first).toHaveValue('1');
                await expect(decrease).toBeDisabled();
                await increase.click();
                await expect(first).toHaveValue('2');
                await expect(total).toHaveValue('1');
                await expect(dialog.getByRole('button', { name: `Agendar Conta a ${kind}`, exact: true })).toBeDisabled();
                await decrease.click();
                await total.fill('3');
                const firstBox = (await first.boundingBox())!;
                const totalBox = (await total.boundingBox())!;
                const parcelamentoBox = (await dialog.getByRole('button', { name: 'Parcelamento', exact: true }).boundingBox())!;
                for (const field of [first, total]) {
                  const box = await field.evaluate(element => {
                    const bounds = element.parentElement!.parentElement!.parentElement!.getBoundingClientRect();
                    return { width: bounds.width, height: bounds.height };
                  });
                  expect(box.width).toBeLessThanOrEqual(96);
                  expect(box.height).toBeLessThanOrEqual(32);
                  expect(box.width).toBeLessThan(parcelamentoBox.width * 0.6);
                }
                expect(totalBox.x).toBe(firstBox.x);
                expect(totalBox.y).toBeGreaterThan(firstBox.y + firstBox.height);
                const upBox = (await increase.boundingBox())!;
                const downBox = (await decrease.boundingBox())!;
                expect(upBox.x).toBeGreaterThanOrEqual(firstBox.x + firstBox.width);
                expect(downBox.y).toBeGreaterThanOrEqual(upBox.y + upBox.height);
                const frequency = dialog.getByRole('button', { name: 'Frequência', exact: true });
                const frequencyBox = (await frequency.boundingBox())!;
                expect(frequencyBox.width).toBeLessThanOrEqual(136);
                expect(frequencyBox.height).toBeLessThanOrEqual(28);
                const effective = dialog.getByRole('switch', { name: 'Já efetivada', exact: true });
                expect((await effective.boundingBox())!.width).toBeLessThanOrEqual(48);
                expect((await effective.boundingBox())!.height).toBeLessThanOrEqual(28);
                const effectiveLabel = dialog.getByText('Já efetivada (ocorrências geradas)', { exact: true });
                await expect(effectiveLabel).toBeVisible();
                expect(await effectiveLabel.evaluate(element => {
                  const range = document.createRange();
                  range.selectNodeContents(element);
                  return range.getClientRects().length === 1 && element.scrollWidth <= element.clientWidth + 1;
                })).toBe(true);
                await expect(frequency).toContainText('Mensal');
                await expect(dialog.getByRole('button', { name: 'Semanal', exact: true })).toHaveCount(0);
                await frequency.click();
                await dialog.getByRole('button', { name: 'Semanal', exact: true }).click();
                await expect(frequency).toContainText('Semanal');
                await expect(frequency).toHaveAttribute('aria-expanded', 'false');
                if (kind === 'Pagar' && width === 390) await dialog.screenshot({ path: test.info().outputPath(`compact-schedule-${theme}.png`) });
              }
            }
            await dialog.getByRole('button', { name: mode === 'direct' ? kind === 'Pagar' ? 'Registrar pagamento' : 'Registrar recebimento' : `Agendar Conta a ${kind}`, exact: true }).click();
            await expect(dialog).toBeHidden();
            expect(operations).toHaveLength(count + 1);
            expect(operations.at(-1)!.name).toBe(mode === 'direct' ? kind === 'Pagar' ? 'CreateExpense' : 'CreateIncome' : mode === 'pending' ? kind === 'Pagar' ? 'CreateAccountPayable' : 'CreateAccountReceivable' : 'CreateCommitmentSeries');
            expect(operations.at(-1)!.input).toMatchObject({ description, amount: '100.01', categoryId: 'common', financialAccountId: 'bank', costCenterId: 'center' });
            if (mode === 'Parcelar ou Repetir') expect(operations.at(-1)!.input.schedule).toMatchObject({ first: 1, total: 3, frequency: 'WEEKLY' });
          }
        }
        await page.getByRole('button', { name: 'Novo lançamento rápido', exact: true }).click();
        await page.getByTestId('quick-action-options').getByRole('button', { name: 'Criar Despesa Cartão', exact: true }).click();
        const cardDialog = page.getByRole('heading', { name: 'Despesa Cartão', exact: true }).locator('..').locator('..').locator('..');
        for (const label of ['Cartão', 'Categoria']) {
          await cardDialog.getByRole('button', { name: label, exact: true }).click();
          if (label === 'Cartão') await expect(cardDialog.getByRole('button', { name: 'Arquivado • Visa', exact: true })).toHaveCount(0);
          await cardDialog.getByRole('button', { name: label === 'Cartão' ? 'Principal • Visa' : 'Categoria comum', exact: true }).click();
          await expect(cardDialog.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-expanded', 'false');
        }
        await cardDialog.getByLabel('Descrição da compra', { exact: true }).fill(`Compra-${width}`);
        const cardAmount = cardDialog.getByLabel('Valor total da compra', { exact: true });
        const cardDate = cardDialog.getByLabel('Data da compra', { exact: true });
        await cardAmount.fill('100,01');
        await cardDate.fill('31/10/2026');
        const cardAmountBox = (await cardAmount.boundingBox())!;
        const cardDateBox = (await cardDate.locator('..').boundingBox())!;
        expect(cardAmountBox.width).toBeLessThanOrEqual(96);
        if (width >= 390) {
          expect(cardDateBox.x).toBeGreaterThan(cardAmountBox.x + cardAmountBox.width);
          expect(Math.abs(cardDateBox.y - cardAmountBox.y)).toBeLessThanOrEqual(1);
          expect(Math.abs(cardDateBox.height - cardAmountBox.height)).toBeLessThanOrEqual(1);
        }
        await expect(cardDialog.getByLabel('Total de parcelas', { exact: true })).toHaveCount(0);
        await cardDialog.getByRole('button', { name: 'Parcelamento', exact: true }).click();
        await cardDialog.getByRole('button', { name: 'Parcelar', exact: true }).click();
        await expect(cardDialog.getByRole('button', { name: 'Diminuir parcela inicial', exact: true })).toBeDisabled();
        await cardDialog.getByRole('button', { name: 'Aumentar parcela inicial', exact: true }).click();
        await expect(cardDialog.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled();
        await cardDialog.getByLabel('Total de parcelas', { exact: true }).fill('3');
        for (const label of ['Parcela inicial', 'Total de parcelas']) {
          const bounds = await cardDialog.getByLabel(label, { exact: true }).evaluate(element => {
            const box = element.parentElement!.parentElement!.parentElement!.getBoundingClientRect();
            return { width: box.width, height: box.height };
          });
          expect(bounds.width).toBeLessThanOrEqual(96);
          expect(bounds.height).toBeLessThanOrEqual(32);
        }
        if (width === 390) await cardDialog.screenshot({ path: test.info().outputPath(`card-purchase-${theme}.png`) });
        const purchaseCount = operations.length;
        await cardDialog.getByRole('button', { name: 'Salvar', exact: true }).click();
        await expect(cardDialog).toBeHidden();
        expect(operations).toHaveLength(purchaseCount + 1);
        expect(operations.at(-1)).toMatchObject({ name: 'Purchase', input: {
          cardId: 'card', categoryId: 'common', description: `Compra-${width}`,
          amount: '100.01', purchasedOn: '2026-10-31', first: 2, total: 3, operationId: expect.any(String)
        } });
        for (const effective of [false, true]) {
          await page.getByRole('button', { name: 'Novo lançamento rápido', exact: true }).click();
          await page.getByTestId('quick-action-options').getByRole('button', { name: 'Criar Transferência', exact: true }).click();
          await expect(page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Transferência', exact: true }) })).toBeVisible();
          const transferDialog = page.getByRole('heading', { name: 'Transferência', exact: true }).locator('..').locator('..').locator('..');
          await expect(transferDialog.getByRole('button', { name: 'Conta de origem', exact: true })).toContainText('Banco');
          await expect(transferDialog.getByRole('switch', { name: 'Já efetivada', exact: true })).not.toBeChecked();
          await transferDialog.getByRole('button', { name: 'Conta destino', exact: true }).click();
          await expect(transferDialog.getByRole('button', { name: 'Conta arquivada', exact: true })).toHaveCount(0);
          await transferDialog.getByRole('button', { name: 'Banco', exact: true }).click();
          const transferAmount = transferDialog.getByLabel('Valor', { exact: true });
          const transferDate = transferDialog.getByLabel('Data prevista', { exact: true });
          await transferAmount.fill('25,50');
          await transferDate.fill('15/11/2026');
          await expect(transferDate).toHaveValue('15/11/2026');
          await expect(transferDialog.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled();
          await transferDialog.getByRole('button', { name: 'Conta destino', exact: true }).click();
          await transferDialog.getByRole('button', { name: 'Reserva', exact: true }).click();
          if (effective) await transferDialog.getByRole('switch', { name: 'Já efetivada', exact: true }).click();
          const transferAmountBox = (await transferAmount.boundingBox())!;
          const transferDateBox = (await transferDate.locator('..').boundingBox())!;
          expect(transferAmountBox.width).toBeLessThanOrEqual(96);
          if (width >= 390) {
            expect(transferDateBox.x).toBeGreaterThan(transferAmountBox.x + transferAmountBox.width);
            expect(Math.abs(transferDateBox.y - transferAmountBox.y)).toBeLessThanOrEqual(1);
          }
          expect((await transferDialog.getByRole('switch', { name: 'Já efetivada', exact: true }).boundingBox())!.height).toBeLessThanOrEqual(28);
          if (width === 390 && effective) await transferDialog.screenshot({ path: test.info().outputPath(`transfer-${theme}.png`) });
          const transferCount = operations.length;
          await expect(transferDate).toHaveValue('15/11/2026');
          await expect(transferDialog.getByRole('button', { name: 'Salvar', exact: true })).toBeEnabled();
          await transferDialog.getByRole('button', { name: 'Salvar', exact: true }).click();
          await expect(transferDialog).toBeHidden();
          await expect(page.getByRole('heading', { name: 'Dashboard financeiro', exact: true })).toBeVisible();
          expect(operations).toHaveLength(transferCount + 1);
          expect(operations.at(-1)).toMatchObject({ name: 'Transfer', input: {
            sourceId: 'bank', destinationId: 'reserve', amount: '25.50', dueDate: '2026-11-15', operationId: expect.any(String),
            ...(effective ? { effectiveDate: '2026-11-15' } : {})
          } });
          if (!effective) expect(operations.at(-1)!.input).not.toHaveProperty('effectiveDate');
        }
        await page.getByRole('button', { name: width < 1024 ? 'Pílula Extrato' : 'Extrato', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Nova Transação', exact: true })).toHaveCount(0);
        await expect(page.getByText(`Pagar-direct-${width}`, { exact: true })).toBeVisible();
        await expect(page.getByText(`Receber-direct-${width}`, { exact: true })).toBeVisible();
        await page.getByRole('button', { name: width < 1024 ? 'Pílula Dashboard' : 'Dashboard', exact: true }).click();
      }
    } finally {
      await deleteEmulatorUser(uid);
    }
  });
}
