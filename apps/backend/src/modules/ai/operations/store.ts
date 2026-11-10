import { getPrismaClient, withTransactionClient } from '../../../core/database/database.js';
import { Prisma, type AiOperationPlan, type AiOperation } from '../../../generated/prisma/client.js';
import { json, type OperationPlan, type OperationStore, type OperationTransaction } from './types.js';

function mapPlan(row: AiOperationPlan & { actions: AiOperation[] }): OperationPlan {
  return {
    ...row, status: row.status as OperationPlan['status'],
    actions: row.actions.map(action => ({
      ...action, arguments: json(action.arguments), details: json(action.details), snapshots: json(action.snapshots),
      status: action.status as OperationPlan['actions'][number]['status'], result: action.result === null ? null : json(action.result)
    }))
  };
}
const include = { actions: { orderBy: { position: 'asc' as const } } };
const dataJson = (value: unknown) => json<Prisma.InputJsonValue>(value);

export function operationStore(): OperationStore {
  return {
    async find(userId, id) {
      const row = await getPrismaClient().aiOperationPlan.findFirst({ where: { id, userId }, include });
      return row ? mapPlan(row) : null;
    },
    async transaction(work) {
      return getPrismaClient().$transaction(async tx => withTransactionClient(tx, async () => {
        const transaction: OperationTransaction = {
          async lock(userId, id) {
            // A plan lock serializes confirmation, cancellation and concurrent replays.
            await tx.$queryRaw`SELECT id FROM ai_operation_plans WHERE id = ${id}::uuid AND user_id = ${userId}::uuid FOR UPDATE`;
            await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR NO KEY UPDATE`;
            const row = await tx.aiOperationPlan.findFirst({ where: { id, userId }, include });
            return row ? mapPlan(row) : null;
          },
          async create(plan) {
            await tx.aiOperationPlan.create({ data: {
              id: plan.id, userId: plan.userId, status: plan.status,
              expiresAt: plan.expiresAt, createdAt: plan.createdAt, confirmedAt: plan.confirmedAt
            } });
            await tx.aiOperation.createMany({ data: plan.actions.map(action => ({
              id: action.id, planId: plan.id, userId: plan.userId, key: action.key, position: action.position,
              operation: action.operation, title: action.title, arguments: dataJson(action.arguments),
              details: dataJson(action.details), snapshots: dataJson(action.snapshots), status: action.status
            })) });
          },
          async setPlan(id, data) { await tx.aiOperationPlan.update({ where: { id }, data }); },
          async setAction(id, data) {
            await tx.aiOperation.update({ where: { id }, data: {
              status: data.status, ...(data.result ? { result: dataJson(data.result) } : {}), error: data.error ?? null
            } });
          },
          async setSnapshots(id, snapshots) { await tx.aiOperation.update({ where: { id }, data: { snapshots: dataJson(snapshots) } }); },
          async savepoint(callback) {
            // These SQL statements are static. Domain writes and their receipt share this transaction.
            await tx.$executeRawUnsafe('SAVEPOINT ai_operation_effect');
            try {
              const result = await callback();
              await tx.$executeRawUnsafe('RELEASE SAVEPOINT ai_operation_effect');
              return result;
            } catch (error) {
              await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ai_operation_effect');
              await tx.$executeRawUnsafe('RELEASE SAVEPOINT ai_operation_effect');
              throw error;
            }
          }
        };
        return work(transaction);
      }), { maxWait: 5000, timeout: 15000, isolationLevel: 'RepeatableRead' });
    }
  };
}
