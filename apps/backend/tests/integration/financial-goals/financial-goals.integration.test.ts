import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../src/generated/prisma/client.js';
import { financialGoalsRepository } from '../../../src/modules/finance/financial-goals/financial-goals-repository.js';
import { createFinancialGoal, recordFinancialGoalMovement, getFinancialGoalMovements, deleteFinancialGoal, updateFinancialGoal, goalCents } from '../../../src/modules/finance/financial-goals/financial-goals.js';
import type { GraphQLContext } from '../../../src/core/graphql/graphql.js';
import { buildAiFinancialContext, aiContextRepository } from '../../../src/modules/ai/context-builder/ai-context-builder.js';

const databaseUrl = process.env.FINANCIAL_GOALS_TEST_DATABASE_URL;
test('PostgreSQL: concurrent movements, withdrawals, idempotence, pagination, isolation and AI', { skip: !databaseUrl }, async () => {
  const parsed = new URL(databaseUrl!);
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname), 'Integration tests require a local database.');
  assert.equal(parsed.pathname, '/moneyhub_e2e', 'Integration tests require the disposable moneyhub_e2e database.');
  const pool = new pg.Pool({ connectionString: databaseUrl!, ssl: false, max: 10 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const repository = financialGoalsRepository(() => prisma);
  const createdUsers: string[] = [];
  try {
    const user = await prisma.user.create({ data: { firebaseUid: randomUUID(), email: `${randomUUID()}@example.test`, profile: { create: { fullName: 'Goals Integration' } } }, include: { profile: true } });
    createdUsers.push(user.id);
    const context: GraphQLContext = { requestId: 'integration', auth: { uid: user.firebaseUid, email: user.email, emailVerified: true, userId: user.id, profileId: user.profile!.id } };
    const goal = await createFinancialGoal(context, { name: 'Reserva', targetAmount: '1000', startDate: '2026-01-01', deadline: '2027-01-01' }, repository);
    const contribution = (amount: string) => ({ goalId: goal.id, type: 'CONTRIBUTION' as const, amount, occurredOn: '2026-02-01', operationId: randomUUID() });
    await Promise.all(Array.from({ length: 25 }, () => recordFinancialGoalMovement(context, contribution('10.01'), repository)));
    assert.equal((await repository.find(user.id, goal.id))?.accumulatedAmount, '250.25');
    const duplicate = contribution('49.75');
    await Promise.all(Array.from({ length: 5 }, () => recordFinancialGoalMovement(context, duplicate, repository)));
    assert.equal(await prisma.financialGoalMovement.count({ where: { goalId: goal.id } }), 26);
    assert.equal((await repository.find(user.id, goal.id))?.accumulatedAmount, '300.00');
    const withdrawals = await Promise.allSettled(Array.from({ length: 5 }, () => recordFinancialGoalMovement(context, { ...contribution('100.00'), type: 'WITHDRAWAL' }, repository)));
    assert.equal(withdrawals.filter(result => result.status === 'fulfilled').length, 3);
    assert.equal(withdrawals.filter(result => result.status === 'rejected').length, 2);
    const history = await prisma.financialGoalMovement.findMany({ where: { goalId: goal.id } });
    const total = history.reduce((sum, movement) => sum + goalCents(movement.amount.toFixed(2)) * (movement.type === 'WITHDRAWAL' ? -1n : 1n), 0n);
    assert.equal(total, 0n);
    assert.equal((await repository.find(user.id, goal.id))?.accumulatedAmount, '0.00');
    const first = await getFinancialGoalMovements(context, goal.id, undefined, repository);
    const second = await getFinancialGoalMovements(context, goal.id, first.endCursor!, repository);
    assert.equal(first.nodes.length, 20); assert.equal(second.nodes.length, 9);
    assert.equal(new Set([...first.nodes, ...second.nodes].map(m => m.id)).size, 29);
    const another = await createFinancialGoal(context, { name: 'Outro cursor', targetAmount: '1', startDate: '2026-01-01', deadline: '2027-01-01' }, repository);
    await assert.rejects(() => getFinancialGoalMovements(context, another.id, first.endCursor!, repository), { extensions: { code: 'BAD_USER_INPUT' } });
    const ai = await buildAiFinancialContext(context, undefined, aiContextRepository(() => prisma));
    assert.ok(ai.goals.some(g => g.includes('Reserva; alvo: 1000.00; acumulado: 0.00;')));
    const other = { ...context, auth: { ...context.auth!, userId: randomUUID() } };
    assert.equal(await repository.find(other.auth.userId, goal.id), null);
    await assert.rejects(() => recordFinancialGoalMovement(other, contribution('1'), repository), { extensions: { code: 'NOT_FOUND' } });
    // The same lock serializes deletion and recording, preserving whichever commits first.
    const racing = await Promise.allSettled([
      recordFinancialGoalMovement(context, contribution('1'), repository),
      deleteFinancialGoal(context, goal.id, repository),
      updateFinancialGoal(context, { id: goal.id, name: 'Reserva editada' }, repository)
    ]);
    assert.equal(racing[1]!.status, 'fulfilled');
    assert.equal(await repository.find(user.id, goal.id), null);
    const deleted = await prisma.financialGoal.findUniqueOrThrow({ where: { id: goal.id } });
    const preserved = await prisma.financialGoalMovement.findMany({ where: { goalId: goal.id } });
    assert.equal(goalCents(deleted.accumulatedAmount.toFixed(2)), preserved.reduce((sum, m) => sum + goalCents(m.amount.toFixed(2)) * (m.type === 'WITHDRAWAL' ? -1n : 1n), 0n));
    assert.ok(deleted.deletedAt);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await prisma.$disconnect();
    await pool.end();
  }
});
