import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createTestDatabase } from '../../helpers/pglite-prisma.js';
import { withDatabaseClient } from '../../../src/core/database/database.js';
import type { GraphQLContext } from '../../../src/core/graphql/graphql.js';
import { accounts } from '../../../src/modules/finance/banking/banking.js';
import { money } from '../../../src/modules/finance/banking/rules.js';
import { aggregateCents } from '../../../src/modules/finance/financial-read-model.js';
import { dashboardSummaryRepository, getDashboardSummary } from '../../../src/modules/finance/dashboard-summary/dashboard-summary.js';
import { cashFlowRepository, getCashFlow } from '../../../src/modules/finance/cash-flow/cash-flow.js';
import { categoryAnalysisRepository, getCategoryAnalysis } from '../../../src/modules/finance/category-analysis/category-analysis.js';
import { periodComparisonRepository, getPeriodComparison } from '../../../src/modules/finance/period-comparison/period-comparison.js';

test('financial aggregates match persisted movements in one SQL query per read', async t => {
  let queries: string[] = [];
  const database = await createTestDatabase(query => queries.push(query));
  const db = database.prisma;
  try {
    await withDatabaseClient(db, async () => {
      const user = await db.user.create({ data: { firebaseUid: randomUUID(), email: `${randomUUID()}@example.test` } });
      const stranger = await db.user.create({ data: { firebaseUid: randomUUID(), email: `${randomUUID()}@example.test` } });
      const context: GraphQLContext = { requestId: 'aggregate-test', auth: { uid: user.firebaseUid, userId: user.id, profileId: null, email: user.email, emailVerified: true } };
      const first = await db.financialAccount.findFirstOrThrow({ where: { userId: user.id, isDefault: true } });
      const second = await db.financialAccount.findFirstOrThrow({ where: { userId: user.id, isDefault: false } });
      const foreign = await db.financialAccount.findFirstOrThrow({ where: { userId: stranger.id, isDefault: true } });
      const category = await db.financialCategory.create({ data: { userId: user.id, name: 'History', type: 'BOTH' } });
      const category2 = await db.financialCategory.create({ data: { userId: user.id, name: 'Other', type: 'BOTH' } });
      const foreignCategory = await db.financialCategory.create({ data: { userId: stranger.id, name: 'Private', type: 'BOTH' } });
      const common = { userId: user.id, financialAccountId: first.id, categoryId: category.id, description: 'Fixture' };
      for (const [amount, date, financialAccountId, categoryId] of [
        ['0.10', '2028-02-01T00:00:00.000Z', first.id, category.id],
        ['0.20', '2028-02-29T23:59:59.999Z', first.id, category.id],
        ['10.01', '2028-02-15T02:00:00.000Z', second.id, category2.id],
        ['7.00', '2028-01-31T23:59:59.999Z', first.id, category.id],
        ['9.00', '2028-03-01T00:00:00.000Z', first.id, category.id]
      ]) await db.income.create({ data: { ...common, financialAccountId: financialAccountId!, categoryId: categoryId!, amount: amount!, occurredAt: new Date(date!) } });
      await db.expense.createMany({ data: [
        { ...common, amount: '0.31', occurredAt: new Date('2028-02-01T00:00:00Z') },
        { ...common, amount: '20.00', financialAccountId: second.id, categoryId: category2.id, occurredAt: new Date('2028-02-29T23:59:59.999Z') },
        { ...common, amount: '100.00', occurredAt: new Date('2028-02-01'), deletedAt: new Date() }
      ] });
      await db.income.create({ data: { ...common, amount: '100.00', occurredAt: new Date('2028-02-01'), deletedAt: new Date() } });
      await db.income.create({ data: { ...common, userId: stranger.id, financialAccountId: foreign.id, categoryId: foreignCategory.id, amount: '999.00', occurredAt: new Date('2028-02-01') } });
      for (const status of ['COMPLETED', 'PENDING', 'CANCELLED']) {
        await db.transfer.create({ data: { userId: user.id, sourceId: first.id, destinationId: second.id, amount: status === 'COMPLETED' ? '1.02' : '100.00', status, dueDate: new Date('2028-02-01'), operationId: randomUUID() } });
      }
      await db.financialAccount.update({ where: { id: first.id }, data: { initialBalance: '9007199254740993.01' } });
      await db.financialAccount.update({ where: { id: second.id }, data: { initialBalance: '-10.00', archived: true } });
      await db.financialCategory.update({ where: { id: category.id }, data: { deletedAt: new Date() } });
      await database.db.exec("SET TIME ZONE 'America/Sao_Paulo'");

      async function singleQuery<T>(work: () => Promise<T>): Promise<T> {
        queries = [];
        const result = await work();
        assert.equal(queries.length, 1, 'Each aggregate must use exactly one SQL round trip.');
        return result;
      }

      await t.test('balances include initial balance, archived accounts and completed transfers exactly', async () => {
        const result = await singleQuery(() => accounts(context));
        assert.equal(result.length, 2);
        assert.equal(result[0]!.id, first.id);
        assert.equal(result[0]!.initialBalance, '9007199254740993.01');
        assert.equal(result[0]!.balance, '9007199254741007.98');
        assert.equal(result.find(item => item.id === second.id)!.balance, '-18.97');
        assert.ok(result.find(item => item.id === second.id)!.archived);
      });

      for (const selection of [undefined, null, [first.id], [second.id], [foreign.id], []]) {
        await t.test(`UTC boundaries and account selection ${selection === null ? 'null' : JSON.stringify(selection?.map(id => id === first.id ? 'first' : id === second.id ? 'second' : 'foreign'))}`, async () => {
          const where = { userId: user.id, deletedAt: null, ...(selection ? { financialAccountId: { in: selection } } : {}) };
          // Compare persisted instants in application UTC; do not let the adapter's
          // Date parameter formatting become the oracle for session-timezone tests.
          const inMonth = (row: { occurredAt: Date }) => row.occurredAt >= new Date('2028-02-01T00:00:00.000Z')
            && row.occurredAt <= new Date('2028-02-29T23:59:59.999Z');
          const incomes = (await db.income.findMany({ where })).filter(inMonth);
          const expenses = (await db.expense.findMany({ where })).filter(inMonth);
          const incomeTotal = incomes.reduce((sum, row) => sum + aggregateCents(String(row.amount)), 0n);
          const expenseTotal = expenses.reduce((sum, row) => sum + aggregateCents(String(row.amount)), 0n);
          const summary = await singleQuery(() => getDashboardSummary(context, { month: 2, year: 2028 }, dashboardSummaryRepository(selection)));
          assert.equal(summary.totalIncome, money(incomeTotal));
          assert.equal(summary.totalExpense, money(expenseTotal));
          assert.equal(summary.incomeCount, incomes.length);
          assert.equal(summary.expenseCount, expenses.length);
          const flow = await singleQuery(() => getCashFlow(context, { month: 2, year: 2028 }, cashFlowRepository(selection)));
          assert.equal(flow.dataPoints.length, 29);
          assert.equal(flow.totals.totalIncome, summary.totalIncome);
          assert.equal(flow.totals.totalExpense, summary.totalExpense);
          assert.equal(flow.dataPoints.at(-1)!.accumulatedBalance, summary.netBalance);
          const monthly = await singleQuery(() => getCashFlow(context, { month: 2, year: 2028, granularity: 'MONTHLY', monthsCount: 3 }, cashFlowRepository(selection)));
          assert.deepEqual(monthly.dataPoints.map(item => item.date), ['2027-12', '2028-01', '2028-02']);
          assert.equal(monthly.dataPoints[2]!.income, summary.totalIncome);
          for (const type of ['INCOME', 'EXPENSE'] as const) {
            const analysis = await singleQuery(() => getCategoryAnalysis(context, { month: 2, year: 2028, type }, categoryAnalysisRepository(selection)));
            const transactions = type === 'INCOME' ? incomes : expenses;
            assert.equal(analysis.totalAmount, type === 'INCOME' ? summary.totalIncome : summary.totalExpense);
            assert.equal(analysis.items.reduce((sum, item) => sum + item.transactionCount, 0), transactions.length);
            for (const item of analysis.items) {
              const group = transactions.filter(row => row.categoryId === item.categoryId);
              assert.equal(item.totalAmount, money(group.reduce((sum, row) => sum + aggregateCents(String(row.amount)), 0n)));
              assert.equal(item.categoryName, item.categoryId === category.id ? 'History' : 'Other');
            }
          }
          const comparison = await singleQuery(() => getPeriodComparison(context, { baseMonth: 2, baseYear: 2028 }, periodComparisonRepository(selection)));
          assert.equal(comparison.basePeriod.totalIncome, summary.totalIncome);
          assert.equal(comparison.basePeriod.totalExpense, summary.totalExpense);
          assert.equal(comparison.comparisonPeriod.month, 1);
          const same = await singleQuery(() => getPeriodComparison(context, { baseMonth: 2, baseYear: 2028, comparisonMonth: 2, comparisonYear: 2028 }, periodComparisonRepository(selection)));
          assert.deepEqual(same.basePeriod, same.comparisonPeriod);
          assert.equal(same.delta.netBalanceDelta, '0.00');
        });
      }
      await t.test('empty months and year boundaries remain zero filled', async () => {
        const result = await singleQuery(() => getPeriodComparison(context, { baseMonth: 1, baseYear: 2027 }, periodComparisonRepository()));
        assert.equal(result.comparisonPeriod.month, 12);
        assert.equal(result.comparisonPeriod.year, 2026);
        assert.equal(result.basePeriod.totalIncome, '0.00');
        assert.equal(result.delta.incomePercentage, 0);
      });
    });
  } finally { await database.close(); }
});

test('summary preserves cents above the Number safe integer range', async () => {
  const result = await getDashboardSummary({ requestId: 'exact', auth: { uid: 'uid', userId: 'user', profileId: null, email: 'user@example.test', emailVerified: true } }, { month: 1, year: 2026 }, {
    getSummary: async () => ({ incomeTotal: '9007199254740993.01', expenseTotal: '9007199254740993.00', incomeCount: 1, expenseCount: 1 })
  });
  assert.equal(result.netBalance, '0.01');
  assert.equal(result.totalIncome, '9007199254740993.01');
});
