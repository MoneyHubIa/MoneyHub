import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  createFinancialGoal, updateFinancialGoal, deleteFinancialGoal, getFinancialGoal,
  listMyFinancialGoals, getFinancialGoalsSummary, recordFinancialGoalMovement,
  getFinancialGoalMovements, financialGoalStatus, financialGoalProgress,
  type FinancialGoal, type FinancialGoalMovement, type FinancialGoalsRepository,
  type GoalTransaction
} from '../../../../src/modules/finance/financial-goals/financial-goals.js';
import type { GraphQLContext } from '../../../../src/core/graphql/graphql.js';

export const owner: GraphQLContext = { requestId: 'test', auth: {
  uid: 'firebase', email: 'goals@example.com', emailVerified: true,
  userId: randomUUID(), profileId: randomUUID()
} };
const input = { name: ' Reserva ', targetAmount: '1000', startDate: '2026-01-01', deadline: '2027-01-01' };
const code = (expected: string) => (error: unknown) => {
  assert.equal((error as { extensions: { code: string } }).extensions.code, expected); return true;
};

function store() {
  const goals: FinancialGoal[] = [];
  const movements: FinancialGoalMovement[] = [];
  const tx: GoalTransaction = {
    lock: async (userId, id) => goals.find(g => g.id === id && g.userId === userId && !g.deletedAt) ?? null,
    update: async (id, data) => Object.assign(goals.find(g => g.id === id)!, data),
    findOperation: async (goalId, operationId) => movements.find(m => m.goalId === goalId && m.operationId === operationId) ?? null,
    createMovement: async data => { const m = { ...data, id: randomUUID(), createdAt: new Date() }; movements.push(m); return m; }
  };
  const repository: FinancialGoalsRepository = {
    list: async userId => goals.filter(g => g.userId === userId && !g.deletedAt),
    find: tx.lock,
    create: async data => { const g = { ...data, id: randomUUID(), accumulatedAmount: '0.00', deletedAt: null, createdAt: new Date(), updatedAt: new Date() }; goals.push(g); return g; },
    transaction: async work => work(tx),
    movements: async (goalId, after) => {
      const all = movements.filter(m => m.goalId === goalId).reverse();
      const index = after ? all.findIndex(m => m.id === after) : -1;
      if (after && index === -1) return null;
      return all.slice(index + 1, index + 22);
    }
  };
  return { repository, movements, goals };
}
const movement = (goalId: string, amount: string, type: 'CONTRIBUTION' | 'WITHDRAWAL' = 'CONTRIBUTION') => ({ goalId, amount, type, occurredOn: '2026-02-01', operationId: randomUUID() });

test('CRUD, owner isolation, soft deletion and preserved history', async () => {
  const { repository, movements } = store();
  const goal = await createFinancialGoal(owner, input, repository);
  assert.equal(goal.name, 'Reserva'); assert.equal(goal.targetAmount, '1000.00'); assert.equal(goal.accumulatedAmount, '0.00');
  await recordFinancialGoalMovement(owner, movement(goal.id, '250'), repository);
  await updateFinancialGoal(owner, { id: goal.id, name: 'Viagem', description: ' teste ', targetAmount: '500.00' }, repository);
  assert.equal(goal.description, 'teste'); assert.equal(goal.targetAmount, '500.00');
  const other = { ...owner, auth: { ...owner.auth!, userId: randomUUID() } };
  for (const action of [() => getFinancialGoal(other, goal.id, repository), () => updateFinancialGoal(other, { id: goal.id, name: 'x' }, repository), () => deleteFinancialGoal(other, goal.id, repository), () => recordFinancialGoalMovement(other, movement(goal.id, '1'), repository), () => getFinancialGoalMovements(other, goal.id, undefined, repository)]) {
    await assert.rejects(action, code('NOT_FOUND'));
  }
  assert.deepEqual(await listMyFinancialGoals(other, repository), []);
  assert.deepEqual(await getFinancialGoalsSummary(owner, repository), { count: 1, activeCount: 1, completedCount: 0, overdueCount: 0, totalAccumulated: '250.00', totalTarget: '500.00' });
  await deleteFinancialGoal(owner, goal.id, repository);
  assert.equal(movements.length, 1); assert.deepEqual(await listMyFinancialGoals(owner, repository), []);
  await assert.rejects(() => getFinancialGoal(owner, goal.id, repository), code('NOT_FOUND'));
  await assert.rejects(() => recordFinancialGoalMovement(owner, movement(goal.id, '1'), repository), code('NOT_FOUND'));
});

test('authorization requires authentication, verified email, user and profile', async () => {
  const { repository } = store();
  for (const [context, expected] of [
    [{ ...owner, auth: null }, 'UNAUTHENTICATED'],
    [{ ...owner, auth: { ...owner.auth!, emailVerified: false } }, 'EMAIL_NOT_VERIFIED'],
    [{ ...owner, auth: { ...owner.auth!, userId: null } }, 'PROFILE_NOT_FOUND'],
    [{ ...owner, auth: { ...owner.auth!, profileId: null } }, 'PROFILE_NOT_FOUND']
  ] as const) {
    await assert.rejects(() => createFinancialGoal(context, input, repository), code(expected));
    await assert.rejects(() => listMyFinancialGoals(context, repository), code(expected));
  }
});

test('validates decimal precision, bounds, names, dates and IDs', async () => {
  const { repository } = store();
  for (const targetAmount of ['0', '-1', '1.001', '1e3', 'Infinity', '1000000000000', '']) {
    await assert.rejects(() => createFinancialGoal(owner, { ...input, targetAmount }, repository), code('BAD_USER_INPUT'));
  }
  for (const patch of [{ name: '' }, { name: 'x'.repeat(121) }, { description: 'x'.repeat(501) }, { startDate: '2026-02-30' }, { deadline: '2025-12-31' }, { startDate: '01/01/2026' }]) {
    await assert.rejects(() => createFinancialGoal(owner, { ...input, ...patch }, repository), code('BAD_USER_INPUT'));
  }
  const goal = await createFinancialGoal(owner, input, repository);
  await assert.rejects(() => updateFinancialGoal(owner, { id: goal.id, startDate: '2028-01-01' }, repository), code('BAD_USER_INPUT'));
  await assert.rejects(() => getFinancialGoal(owner, 'invalid', repository), code('BAD_USER_INPUT'));
  for (const patch of [{ amount: '0' }, { amount: '0.001' }, { occurredOn: '2026-02-30' }, { operationId: 'x' }, { notes: 'x'.repeat(501) }, { type: 'INVALID' as 'CONTRIBUTION' }]) {
    await assert.rejects(() => recordFinancialGoalMovement(owner, { ...movement(goal.id, '1'), ...patch }, repository), code('BAD_USER_INPUT'));
  }
});

test('exact decimals, completion, overfunding, reopening, insufficient funds and idempotence', async () => {
  const { repository, movements } = store();
  const goal = await createFinancialGoal(owner, { ...input, targetAmount: '0.30' }, repository);
  const first = movement(goal.id, '0.10');
  await recordFinancialGoalMovement(owner, first, repository);
  await recordFinancialGoalMovement(owner, first, repository);
  assert.equal(movements.length, 1); assert.equal(goal.accumulatedAmount, '0.10');
  await assert.rejects(() => recordFinancialGoalMovement(owner, { ...first, amount: '0.20' }, repository), code('BAD_USER_INPUT'));
  await recordFinancialGoalMovement(owner, movement(goal.id, '0.20'), repository);
  assert.equal(goal.accumulatedAmount, '0.30'); assert.equal(financialGoalStatus(goal), 'COMPLETED');
  await recordFinancialGoalMovement(owner, movement(goal.id, '0.30'), repository);
  assert.equal(financialGoalProgress(goal), 200);
  await recordFinancialGoalMovement(owner, movement(goal.id, '0.40', 'WITHDRAWAL'), repository);
  assert.equal(goal.accumulatedAmount, '0.20'); assert.equal(financialGoalStatus(goal), 'ACTIVE');
  await assert.rejects(() => recordFinancialGoalMovement(owner, movement(goal.id, '0.21', 'WITHDRAWAL'), repository), code('BAD_USER_INPUT'));
  assert.equal(goal.accumulatedAmount, '0.20'); assert.equal(movements.length, 4);
  assert.equal(financialGoalStatus(goal, new Date('2027-01-02')), 'OVERDUE');
  assert.equal(financialGoalStatus(goal, new Date('2027-01-01')), 'ACTIVE');
});

test('history has 20 item pages, scoped cursor and no missing or duplicated entries', async () => {
  const { repository } = store(); const goal = await createFinancialGoal(owner, input, repository);
  for (let i = 0; i < 25; i++) await recordFinancialGoalMovement(owner, movement(goal.id, '1'), repository);
  const first = await getFinancialGoalMovements(owner, goal.id, undefined, repository);
  assert.equal(first.nodes.length, 20); assert.equal(first.hasNextPage, true);
  const second = await getFinancialGoalMovements(owner, goal.id, first.endCursor!, repository);
  assert.equal(second.nodes.length, 5); assert.equal(second.hasNextPage, false);
  assert.equal(new Set([...first.nodes, ...second.nodes].map(m => m.id)).size, 25);
  await assert.rejects(() => getFinancialGoalMovements(owner, goal.id, randomUUID(), repository), code('BAD_USER_INPUT'));
});
