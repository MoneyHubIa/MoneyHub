import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import type { UserRecord } from 'firebase-admin/auth';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_UID, demoDates, demoId } from '../../src/demo/demo-data.js';
import { seedDemo } from '../../src/demo/demo-seed.js';

const environment = {
  FIREBASE_PROJECT_ID: 'demo-moneyhub',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  DATABASE_URL: 'postgresql://moneyhub:moneyhub@db:5432/moneyhub?sslmode=disable'
};
const anchor = new Date('2026-01-31T23:45:00Z');
type DemoRow = Record<string, unknown> & { id: string };

function dependencies() {
  const batches: { model: string; data: DemoRow[]; skipDuplicates: boolean }[] = [];
  const goals: { where: { id: string }; update: object; create: DemoRow }[] = [];
  const models = [
    'user', 'profile', 'financialCategory', 'costCenter', 'income', 'expense',
    'accountPayable', 'accountReceivable', 'recurringTransaction', 'calendarEvent', 'notification'
  ];
  const transaction = {
    ...Object.fromEntries(models.map(model => [model, {
      createMany: async (input: { data: DemoRow[]; skipDuplicates: boolean }) => {
        batches.push({ model, ...input });
        return { count: input.data.length };
      },
      findUniqueOrThrow: async () => ({ id: demoId('user'), createdAt: anchor })
    }])),
    financialGoal: {
      upsert: async (input: typeof goals[number]) => {
        goals.push(input);
        return input.create;
      }
    }
  };
  const runTransaction = mock.fn(async (work: (tx: typeof transaction) => Promise<void>) => work(transaction));
  const prisma = { $transaction: runTransaction } as unknown as PrismaClient;
  const identity = { uid: DEMO_UID } as UserRecord;
  const auth = {
    getUser: mock.fn<(uid: string) => Promise<UserRecord>>(async () => identity),
    createUser: mock.fn<(input: object) => Promise<UserRecord>>(async () => identity)
  };
  const rows = (model: string) => batches.filter(batch => batch.model === model).flatMap(batch => batch.data);
  return { prisma, auth, batches, goals, rows, runTransaction };
}

test('demo seed reuses the existing identity and prepares consistent owner-scoped demo data', async () => {
  const { prisma, auth, batches, goals, rows } = dependencies();
  await seedDemo(prisma, auth, environment);

  assert.deepEqual(auth.getUser.mock.calls[0]?.arguments, [DEMO_UID]);
  assert.equal(auth.createUser.mock.callCount(), 0);
  assert.ok(batches.length > 0);
  assert.ok(batches.every(batch => batch.skipDuplicates));
  for (const batch of batches.filter(batch => batch.model !== 'user')) {
    assert.ok(batch.data.every(row => row.userId === demoId('user')));
  }
  assert.equal(rows('income').length, 9);
  assert.equal(rows('expense').length, 13);
  assert.equal(rows('financialCategory').length, 5);
  assert.equal(rows('costCenter').length, 2);
  const salary = rows('income').filter(row => row.categoryId === demoId('category-salary'));
  assert.deepEqual(salary.map(row => row.occurredAt), [
    new Date('2025-10-01T12:00:00Z'), new Date('2025-11-01T12:00:00Z'),
    new Date('2025-12-01T12:00:00Z'), new Date('2026-01-01T12:00:00Z')
  ]);
  const pending = rows('accountPayable').find(row => row.id === demoId('payable-pending'))!;
  assert.deepEqual(pending.dueDate, new Date('2026-02-03T00:00:00Z'));
  const notification = rows('notification').find(row => row.sourceId === pending.id)!;
  assert.deepEqual(notification.occurrenceDate, pending.dueDate);
  assert.deepEqual(notification.reminderDate, new Date('2026-01-31T00:00:00Z'));
  const paid = rows('accountPayable').find(row => row.status === 'PAID')!;
  const settlement = rows('expense').find(row => row.id === demoId('settled-streaming'))!;
  assert.equal(settlement.amount, paid.amount);
  assert.deepEqual(settlement.occurredAt, paid.paidAt);
  assert.equal(goals.length, 2);
  for (const goal of goals) {
    assert.deepEqual(goal.update, {});
    assert.equal(goal.where.id, goal.create.id);
    assert.equal(goal.create.userId, demoId('user'));
    const movement = (goal.create.movements as { create: DemoRow }).create;
    assert.equal(movement.type, 'CONTRIBUTION');
    assert.equal(movement.amount, goal.create.accumulatedAmount);
  }
});

test('demo seed creates a verified identity only when Firebase reports a missing user', async () => {
  const { prisma, auth, runTransaction } = dependencies();
  auth.getUser.mock.mockImplementation(async () => {
    throw Object.assign(new Error('Missing identity'), { code: 'auth/user-not-found' });
  });
  await seedDemo(prisma, auth, environment);
  assert.equal(auth.createUser.mock.callCount(), 1);
  assert.deepEqual(auth.createUser.mock.calls[0]?.arguments, [{
    uid: DEMO_UID, email: DEMO_EMAIL, password: DEMO_PASSWORD,
    emailVerified: true, displayName: 'Usuário Demonstração'
  }]);
  assert.equal(runTransaction.mock.callCount(), 1);
});

test('demo seed rejects unsafe configuration before accessing Firebase or the database', async () => {
  const { prisma, auth, runTransaction } = dependencies();
  await assert.rejects(seedDemo(prisma, auth, { ...environment, FIREBASE_PROJECT_ID: 'production' }), /Demo seed requires/);
  assert.equal(auth.getUser.mock.callCount(), 0);
  assert.equal(auth.createUser.mock.callCount(), 0);
  assert.equal(runTransaction.mock.callCount(), 0);
});

test('demo seed propagates Firebase failures without writing demo data', async () => {
  for (const operation of ['getUser', 'createUser'] as const) {
    const { prisma, auth, runTransaction } = dependencies();
    const failure = new Error('Firebase unavailable');
    auth.getUser.mock.mockImplementation(async () => {
      if (operation === 'getUser') throw failure;
      throw Object.assign(new Error('Missing identity'), { code: 'auth/user-not-found' });
    });
    auth.createUser.mock.mockImplementation(async () => { throw failure; });
    await assert.rejects(seedDemo(prisma, auth, environment), error => error === failure);
    assert.equal(auth.createUser.mock.callCount(), operation === 'getUser' ? 0 : 1);
    assert.equal(runTransaction.mock.callCount(), 0);
  }
});

test('demo dates use UTC across leap days and year boundaries', () => {
  const leap = demoDates(new Date('2024-02-29T23:59:59Z'));
  assert.deepEqual(leap.day(1), new Date('2024-03-01T00:00:00Z'));
  assert.deepEqual(leap.day(-1), new Date('2024-02-28T00:00:00Z'));
  assert.deepEqual(leap.month(-2), new Date('2023-12-01T12:00:00Z'));
  assert.deepEqual(leap.month(10, 15), new Date('2024-12-15T12:00:00Z'));
});
