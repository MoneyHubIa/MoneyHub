import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Auth, UserRecord } from 'firebase-admin/auth';
import { PrismaClient } from '../../../src/generated/prisma/client.js';
import { demoId } from '../../../src/demo/demo-data.js';
import { seedDemo } from '../../../src/demo/demo-seed.js';

const databaseUrl = process.env.DEMO_SEED_TEST_DATABASE_URL;

test('demo seed preserves edits, soft deletions, dates, goal balances and row counts', {
  skip: !databaseUrl
}, async () => {
  assert.equal(new URL(databaseUrl!).pathname, '/moneyhub_demo_test', 'Use a dedicated disposable database.');
  assert.ok(['db', '127.0.0.1', 'localhost'].includes(new URL(databaseUrl!).hostname), 'Remote databases are not allowed.');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl!, ssl: false }) });
  const environment = {
    DATABASE_URL: databaseUrl!, FIREBASE_PROJECT_ID: 'demo-moneyhub', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099'
  };
  let identityExists = false;
  let identityCreations = 0;
  const auth: Pick<Auth, 'getUser' | 'createUser'> = {
    async getUser() {
      if (!identityExists) throw Object.assign(new Error('Missing identity'), { code: 'auth/user-not-found' });
      return {} as UserRecord;
    },
    async createUser() {
      identityExists = true;
      identityCreations++;
      return {} as UserRecord;
    }
  };
  const userId = demoId('user');
  const counts = async () => Promise.all([
    prisma.user.count(), prisma.profile.count(), prisma.financialCategory.count(), prisma.costCenter.count(),
    prisma.income.count(), prisma.expense.count(), prisma.accountPayable.count(), prisma.accountReceivable.count(),
    prisma.recurringTransaction.count(), prisma.calendarEvent.count(), prisma.notification.count(),
    prisma.financialGoal.count(), prisma.financialGoalMovement.count()
  ]);
  try {
    await prisma.user.deleteMany({ where: { id: userId } });
    await seedDemo(prisma, auth, environment);
    const originalCounts = await counts();
    assert.deepEqual(originalCounts, [1, 1, 5, 2, 9, 13, 3, 2, 2, 2, 2, 2, 2]);
    const originalIncome = await prisma.income.findUniqueOrThrow({ where: { id: demoId('salary-0') } });
    await prisma.profile.update({ where: { userId }, data: { fullName: 'Perfil editado' } });
    const deletedAt = new Date();
    await prisma.expense.update({ where: { id: demoId('market-0') }, data: { deletedAt, amount: '99.00' } });
    // Emulate another month without modifying the real clock.
    await prisma.user.update({ where: { id: userId }, data: { createdAt: new Date('2025-01-31T12:00:00Z') } });
    await seedDemo(prisma, auth, environment);
    assert.deepEqual(await counts(), originalCounts);
    assert.equal(identityCreations, 1);
    assert.equal((await prisma.profile.findUniqueOrThrow({ where: { userId } })).fullName, 'Perfil editado');
    const expense = await prisma.expense.findUniqueOrThrow({ where: { id: demoId('market-0') } });
    assert.equal(expense.amount.toString(), '99');
    assert.deepEqual(expense.deletedAt, deletedAt);
    assert.deepEqual(await prisma.income.findUniqueOrThrow({ where: { id: originalIncome.id } }), originalIncome);
    for (const goal of await prisma.financialGoal.findMany({ include: { movements: true } })) {
      assert.equal(goal.accumulatedAmount.toString(), goal.movements[0]?.amount.toString());
    }
    identityExists = false;
    await seedDemo(prisma, auth, environment);
    assert.equal(identityCreations, 2);
    assert.deepEqual(await counts(), originalCounts);
  } finally {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
