import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPrismaClient, disconnectDatabase } from '../../../../src/core/database/database.js';
import { createSeries, updateSeries, purchase, payCard, reverseCardPayment, syncSeries, type SeriesInput } from '../../../../src/modules/finance/banking/banking.js';
import type { GraphQLContext } from '../../../../src/core/graphql/graphql.js';

// Exercise service orchestration without opening a network connection.
type Row = Record<string, unknown>;
function repository() {
  const tables: Record<string, Row[]> = {};
  const matches = (row: Row, where: Row): boolean => Object.entries(where).every(([key, value]) => {
    if (key === 'card') return true;
    if (key === 'cardId_operationId') return matches(row, value as Row);
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('in' in value) return (value.in as unknown[]).includes(row[key]);
      return matches(row, value as Row);
    }
    if (value === null) return row[key] == null;
    return value instanceof Date ? Number(row[key]) === Number(value) : row[key] === value;
  });
  const model = (name: string) => {
    const rows: Row[] = [];
    tables[name] = rows;
    return {
      findMany: async ({ where = {} }: { where?: Row } = {}) => rows.filter(row => matches(row, where)).map(row => ({ ...row })),
      findFirst: async ({ where }: { where: Row }) => rows.find(row => matches(row, where)) ?? null,
      findUnique: async ({ where }: { where: Row }) => rows.find(row => matches(row, where)) ?? null,
      create: async ({ data }: { data: Row }) => {
        const row = { id: name + rows.length, paidAmount: '0.00', deletedAt: null, cancelled: false, ...data };
        rows.push(row); return { ...row };
      },
      update: async ({ where, data }: { where: Row; data: Row }) => Object.assign(rows.find(row => matches(row, where))!, data),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        for (const row of rows.filter(row => matches(row, where))) Object.assign(row, data);
      }
    };
  };
  const tx = Object.fromEntries(['financialAccount', 'financialCategory', 'creditCard', 'creditCardPurchase', 'creditCardPayment', 'expense', 'accountPayable', 'accountReceivable', 'financialSeries'].map(name => [name, model(name)]));
  return { tables, tx: { ...tx, $queryRaw: async () => [] } };
}

test('banking services preserve statement debt, series edits and reminders', async t => {
  const originalUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://review:review@127.0.0.1:1/review?sslmode=disable';
  const db = getPrismaClient();
  const { tables, tx } = repository();
  const originalTransaction = db.$transaction;
  db.$transaction = (async (callback: (value: unknown) => unknown) => callback(tx)) as typeof originalTransaction;
  const originalFindMany = db.financialSeries.findMany;
  db.financialSeries.findMany = (async () => tables.financialSeries!.map(row => ({ ...row }))) as typeof originalFindMany;
  t.after(async () => {
    db.financialSeries.findMany = originalFindMany;
    db.$transaction = originalTransaction;
    t.mock.restoreAll(); await disconnectDatabase();
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
  });
  const context = { auth: { userId: 'owner', emailVerified: true } } as GraphQLContext;
  tables.financialAccount!.push({ id: 'account', userId: 'owner', archived: false });
  tables.financialCategory!.push({ id: 'category', userId: 'owner', deletedAt: null, type: 'EXPENSE' });
  tables.creditCard!.push({ id: 'card', userId: 'owner', financialAccountId: 'account', archived: false, dueDay: 10, closingDay: 3, dynamicDays: null, businessDays: false });
  const buy = { operationId: 'one', cardId: 'card', categoryId: 'category', description: 'Item', amount: '100.00', purchasedOn: '2026-10-01', total: 1, first: 1 };
  await purchase(context, buy);
  await purchase(context, buy);
  await assert.rejects(purchase(context, { ...buy, amount: '99.00' }));
  const fullPayment = { cardId: 'card', operationId: 'payment', dueDate: '2026-10-10', paidOn: '2026-10-01', amount: '100.00' };
  await payCard(context, fullPayment);
  await payCard(context, fullPayment);
  await assert.rejects(payCard(context, { ...fullPayment, amount: '99.00' }));
  await purchase(context, { ...buy, operationId: 'two', amount: '20.00', purchasedOn: '2026-10-02' });
  assert.equal(tables.accountPayable![0]!.amount, '20.00');
  await payCard(context, { cardId: 'card', operationId: 'partial', dueDate: '2026-10-10', paidOn: '2026-10-02', amount: '5.00' });
  await purchase(context, { ...buy, operationId: 'three', amount: '10.00' });
  assert.equal(tables.accountPayable![0]!.amount, '25.00');
  await reverseCardPayment(context, 'creditCardPayment1');
  await reverseCardPayment(context, 'creditCardPayment1');
  assert.equal(tables.accountPayable![0]!.amount, '30.00');

  const series: SeriesInput = { operationId: 'series', financialAccountId: 'account', categoryId: 'category', description: 'Parcelas', amount: '300.00', dueDate: '2026-10-01', type: 'EXPENSE', reminderOffsetDays: 3, schedule: { mode: 'INSTALLMENTS', first: 1, total: 3, frequency: 'MONTHLY' } };
  await createSeries(context, series);
  await createSeries(context, series);
  assert.equal(tables.accountPayable!.filter(row => row.seriesId === 'series').length, 3);
  await assert.rejects(createSeries(context, { ...series, amount: '301.00' }));
  const edit = { id: 'series', financialAccountId: 'account', categoryId: 'category', description: 'Alterada', amount: '100.00' };
  await updateSeries(context, { ...edit, fromNumber: 3, dueDate: '2026-12-01' });
  assert.equal(tables.accountPayable!.find(row => row.seriesId === 'series' && row.installmentNumber === 3)!.reminderOffsetDays, 3);
  const settled = tables.accountPayable!.find(row => row.seriesId === 'series' && row.installmentNumber === 2)!;
  settled.status = 'PAID';
  await updateSeries(context, { ...edit, fromNumber: 1, dueDate: '2026-10-01', reminderOffsetDays: null });
  assert.equal(settled.reminderOffsetDays, 3);
  assert.equal(tables.accountPayable!.find(row => row.seriesId === 'series' && row.installmentNumber === 1)!.reminderOffsetDays, null);
  await assert.rejects(createSeries(context, { ...series, operationId: 'invalid', reminderOffsetDays: 2 }));
  const fixed = { ...series, operationId: 'fixed', dueDate: new Date().toISOString().slice(0, 10), amount: '10.00', schedule: { ...series.schedule, mode: 'FIXED' as const } };
  await createSeries(context, fixed);
  const last = tables.accountPayable!.filter(row => row.seriesId === 'fixed').pop()!;
  tables.accountPayable!.splice(tables.accountPayable!.indexOf(last), 1);
  await syncSeries(context);
  assert.equal(tables.accountPayable!.find(row => row.seriesId === 'fixed' && row.installmentNumber === last.installmentNumber)!.reminderOffsetDays, 3);
  assert.equal((tables.financialSeries!.find(row => row.id === 'fixed')!.spec as SeriesInput).reminderOffsetDays, 3);
});
