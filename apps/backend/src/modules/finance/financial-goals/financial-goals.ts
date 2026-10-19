import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../../../core/graphql/graphql.js';
import { requireVerifiedUserId } from '../financial-categories/financial-categories.js';

export type FinancialGoal = {
  id: string; userId: string; name: string; description: string | null;
  targetAmount: string; accumulatedAmount: string; startDate: Date; deadline: Date;
  createdAt: Date; updatedAt: Date; deletedAt: Date | null;
};
export type FinancialGoalMovement = {
  id: string; goalId: string; type: 'CONTRIBUTION' | 'WITHDRAWAL'; amount: string;
  occurredOn: Date; notes: string | null; operationId: string; createdAt: Date;
};
export type CreateFinancialGoalInput = {
  name: string; description?: string | null; targetAmount: string; startDate: string; deadline: string;
};
export type UpdateFinancialGoalInput = Partial<CreateFinancialGoalInput> & { id: string };
export type RecordFinancialGoalMovementInput = {
  goalId: string; type: FinancialGoalMovement['type']; amount: string;
  occurredOn: string; notes?: string | null; operationId: string;
};
type GoalData = Omit<FinancialGoal, 'id' | 'accumulatedAmount' | 'createdAt' | 'updatedAt' | 'deletedAt'>;
export type GoalTransaction = {
  lock(userId: string, id: string): Promise<FinancialGoal | null>;
  update(id: string, data: Partial<Omit<GoalData, 'userId'> & { accumulatedAmount: string; deletedAt: Date }>): Promise<FinancialGoal>;
  findOperation(goalId: string, operationId: string): Promise<FinancialGoalMovement | null>;
  createMovement(data: Omit<FinancialGoalMovement, 'id' | 'createdAt'>): Promise<FinancialGoalMovement>;
};
export type FinancialGoalsRepository = {
  list(userId: string): Promise<FinancialGoal[]>;
  find(userId: string, id: string): Promise<FinancialGoal | null>;
  create(data: GoalData): Promise<FinancialGoal>;
  transaction<T>(work: (tx: GoalTransaction) => Promise<T>): Promise<T>;
  movements(goalId: string, after?: string): Promise<FinancialGoalMovement[] | null>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maximumCents = 99999999999999n;
function error(message: string, code = 'BAD_USER_INPUT'): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}
function user(context: GraphQLContext) {
  const userId = requireVerifiedUserId(context);
  if (!context.auth?.profileId) throw error('Profile bootstrap is required.', 'PROFILE_NOT_FOUND');
  return userId;
}
function id(value: string) {
  if (!uuid.test(value)) throw error('A valid UUID is required.');
  return value;
}
export function goalCents(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function goalMoney(cents: bigint): string {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}
function amount(value: string) {
  if (typeof value !== 'string' || !/^\d{1,12}(\.\d{1,2})?$/.test(value)) {
    throw error('Amount must be a positive decimal with at most two decimal places.');
  }
  const cents = goalCents(value);
  if (cents <= 0n || cents > maximumCents) throw error('Amount is outside the supported range.');
  return goalMoney(cents);
}
function date(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw error('Date must use YYYY-MM-DD format.');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value < '0001-01-01') {
    throw error('Date is invalid.');
  }
  return parsed;
}
function name(raw: string) {
  const value = raw?.trim();
  if (!value || value.length > 120) throw error('Goal name must contain between 1 and 120 characters.');
  return value;
}
function notes(raw?: string | null) {
  const value = raw?.trim() || null;
  if (value && value.length > 500) throw error('Description or notes cannot exceed 500 characters.');
  return value;
}
function dates(start: Date, deadline: Date) {
  if (deadline < start) throw error('Deadline cannot precede start date.');
}
function found(goal: FinancialGoal | null): FinancialGoal {
  if (!goal) throw error('Financial goal was not found.', 'NOT_FOUND');
  return goal;
}
export function financialGoalStatus(goal: FinancialGoal, now = new Date()): 'ACTIVE' | 'COMPLETED' | 'OVERDUE' {
  if (goalCents(goal.accumulatedAmount) >= goalCents(goal.targetAmount)) return 'COMPLETED';
  return goal.deadline.toISOString().slice(0, 10) < now.toISOString().slice(0, 10) ? 'OVERDUE' : 'ACTIVE';
}
export function financialGoalProgress(goal: FinancialGoal): number {
  return Number((Number(goalCents(goal.accumulatedAmount)) / Number(goalCents(goal.targetAmount)) * 100).toFixed(2));
}
export function financialGoalRemaining(goal: FinancialGoal): string {
  const remaining = goalCents(goal.targetAmount) - goalCents(goal.accumulatedAmount);
  return goalMoney(remaining > 0n ? remaining : 0n);
}
export async function listMyFinancialGoals(context: GraphQLContext, repository: FinancialGoalsRepository) {
  return repository.list(user(context));
}
export async function getFinancialGoal(context: GraphQLContext, goalId: string, repository: FinancialGoalsRepository) {
  const userId = user(context);
  return found(await repository.find(userId, id(goalId)));
}
export async function createFinancialGoal(context: GraphQLContext, input: CreateFinancialGoalInput, repository: FinancialGoalsRepository) {
  const userId = user(context);
  const startDate = date(input.startDate); const deadline = date(input.deadline);
  dates(startDate, deadline);
  return repository.create({ userId, name: name(input.name), description: notes(input.description), targetAmount: amount(input.targetAmount), startDate, deadline });
}
export async function updateFinancialGoal(context: GraphQLContext, input: UpdateFinancialGoalInput, repository: FinancialGoalsRepository) {
  const userId = user(context); const goalId = id(input.id);
  const patch: Partial<Omit<GoalData, 'userId'>> = {};
  if (input.name !== undefined) patch.name = name(input.name);
  if (input.description !== undefined) patch.description = notes(input.description);
  if (input.targetAmount !== undefined) patch.targetAmount = amount(input.targetAmount);
  if (input.startDate !== undefined) patch.startDate = date(input.startDate);
  if (input.deadline !== undefined) patch.deadline = date(input.deadline);
  return repository.transaction(async tx => {
    const goal = found(await tx.lock(userId, goalId));
    dates(patch.startDate ?? goal.startDate, patch.deadline ?? goal.deadline);
    return tx.update(goal.id, patch);
  });
}
export async function deleteFinancialGoal(context: GraphQLContext, goalId: string, repository: FinancialGoalsRepository) {
  const userId = user(context); id(goalId);
  return repository.transaction(async tx => {
    const goal = found(await tx.lock(userId, goalId));
    await tx.update(goal.id, { deletedAt: new Date() });
    return true;
  });
}
export async function recordFinancialGoalMovement(context: GraphQLContext, input: RecordFinancialGoalMovementInput, repository: FinancialGoalsRepository) {
  const userId = user(context); const goalId = id(input.goalId); const operationId = id(input.operationId);
  if (input.type !== 'CONTRIBUTION' && input.type !== 'WITHDRAWAL') throw error('Invalid movement type.');
  const normalizedAmount = amount(input.amount); const occurredOn = date(input.occurredOn); const normalizedNotes = notes(input.notes);
  return repository.transaction(async tx => {
    const goal = found(await tx.lock(userId, goalId));
    const previous = await tx.findOperation(goal.id, operationId);
    if (previous) {
      if (previous.type !== input.type || previous.amount !== normalizedAmount || previous.occurredOn.getTime() !== occurredOn.getTime() || previous.notes !== normalizedNotes) {
        throw error('Operation ID was already used with different movement data.');
      }
      return goal;
    }
    const delta = goalCents(normalizedAmount) * (input.type === 'WITHDRAWAL' ? -1n : 1n);
    const balance = goalCents(goal.accumulatedAmount) + delta;
    if (balance < 0n) throw error('Insufficient goal balance.');
    if (balance > maximumCents) throw error('Goal balance is outside the supported range.');
    await tx.createMovement({ goalId, operationId, type: input.type, amount: normalizedAmount, occurredOn, notes: normalizedNotes });
    return tx.update(goal.id, { accumulatedAmount: goalMoney(balance) });
  });
}
export async function getFinancialGoalsSummary(context: GraphQLContext, repository: FinancialGoalsRepository) {
  const goals = await listMyFinancialGoals(context, repository);
  const states = goals.map(goal => financialGoalStatus(goal));
  return {
    count: goals.length, activeCount: states.filter(s => s === 'ACTIVE').length,
    completedCount: states.filter(s => s === 'COMPLETED').length, overdueCount: states.filter(s => s === 'OVERDUE').length,
    totalAccumulated: goalMoney(goals.reduce((sum, g) => sum + goalCents(g.accumulatedAmount), 0n)),
    totalTarget: goalMoney(goals.reduce((sum, g) => sum + goalCents(g.targetAmount), 0n))
  };
}
export async function getFinancialGoalMovements(context: GraphQLContext, goalId: string, after: string | undefined, repository: FinancialGoalsRepository) {
  await getFinancialGoal(context, goalId, repository);
  if (after) id(after);
  const page = await repository.movements(goalId, after);
  if (!page) throw error('Movement cursor was not found in this goal.');
  const nodes = page.slice(0, 20);
  return { nodes, hasNextPage: page.length > 20, endCursor: nodes.at(-1)?.id ?? null };
}
