import { getPrismaClient } from '../../../core/database/database.js';
import type { FinancialGoal as PrismaGoal, FinancialGoalMovement as PrismaMovement } from '../../../generated/prisma/client.js';
import type { FinancialGoal, FinancialGoalMovement, FinancialGoalsRepository } from './financial-goals.js';

function mapGoal(goal: PrismaGoal): FinancialGoal {
  return { ...goal, targetAmount: goal.targetAmount.toFixed(2), accumulatedAmount: goal.accumulatedAmount.toFixed(2) };
}
function mapMovement(movement: PrismaMovement): FinancialGoalMovement {
  return { ...movement, type: movement.type as FinancialGoalMovement['type'], amount: movement.amount.toFixed(2) };
}

export function financialGoalsRepository(prismaGetter = getPrismaClient): FinancialGoalsRepository {
  // Resolve the client lazily so authorization runs before database access.
  return {
    list: async userId => (await prismaGetter().financialGoal.findMany({
      where: { userId, deletedAt: null }, orderBy: [{ deadline: 'asc' }, { id: 'asc' }]
    })).map(mapGoal),
    find: async (userId, id) => {
      const goal = await prismaGetter().financialGoal.findFirst({ where: { id, userId, deletedAt: null } });
      return goal ? mapGoal(goal) : null;
    },
    create: async data => mapGoal(await prismaGetter().financialGoal.create({ data })),
    transaction: work => prismaGetter().$transaction(async tx => work({
      lock: async (userId, id) => {
        // Metadata updates and soft deletion use the same lock as movements.
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM financial_goals
          WHERE id = ${id}::uuid AND user_id = ${userId}::uuid AND deleted_at IS NULL
          FOR UPDATE`;
        if (!rows.length) return null;
        return mapGoal(await tx.financialGoal.findUniqueOrThrow({ where: { id } }));
      },
      update: async (id, data) => mapGoal(await tx.financialGoal.update({ where: { id }, data })),
      findOperation: async (goalId, operationId) => {
        const previous = await tx.financialGoalMovement.findUnique({ where: { goalId_operationId: { goalId, operationId } } });
        return previous ? mapMovement(previous) : null;
      },
      createMovement: async data => mapMovement(await tx.financialGoalMovement.create({ data }))
    }), { maxWait: 5000, timeout: 10000 }),
    movements: async (goalId, after) => {
      const prisma = prismaGetter();
      const cursor = after ? await prisma.financialGoalMovement.findFirst({ where: { id: after, goalId } }) : null;
      if (after && !cursor) return null;
      return (await prisma.financialGoalMovement.findMany({
        where: {
          goalId,
          ...(cursor ? { OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } }
          ] } : {})
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 21
      })).map(mapMovement);
    }
  };
}
