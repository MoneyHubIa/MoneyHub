import { GraphQLError } from 'graphql';
import type { GraphQLContext } from './graphql.js';
import { requireVerifiedUserId } from './financial-categories.js';

export type RecurringType = 'EXPENSE' | 'INCOME';
export type RecurrenceRule = 'MONTHLY' | 'WEEKLY' | 'YEARLY';

export type RecurringTransaction = {
  id: string;
  userId: string;
  type: RecurringType;
  categoryId: string;
  costCenterId?: string | null;
  description: string;
  amount: string;
  recurrenceRule: RecurrenceRule;
  startDate: Date;
  endDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateRecurringTransactionInput = {
  type: RecurringType;
  categoryId: string;
  costCenterId?: string;
  description: string;
  amount: string;
  recurrenceRule: RecurrenceRule;
  startDate: string;
  endDate?: string | null;
};

export type UpdateRecurringTransactionInput = {
  id: string;
  type?: RecurringType;
  categoryId?: string;
  costCenterId?: string;
  description?: string;
  amount?: string;
  recurrenceRule?: RecurrenceRule;
  startDate?: string;
  endDate?: string | null;
};

export type ProcessRecurringResult = {
  generatedPayables: number;
  generatedReceivables: number;
};

export type RecurringTransactionRepository = {
  findMany(args: {
    where: { userId: string };
  }): Promise<RecurringTransaction[]>;
  findUnique(args: {
    where: { id: string };
  }): Promise<RecurringTransaction | null>;
  create(args: {
    data: {
      userId: string;
      type: RecurringType;
      categoryId: string;
      costCenterId?: string | null;
      description: string;
      amount: string;
      recurrenceRule: RecurrenceRule;
      startDate: Date;
      endDate?: Date | null;
    };
  }): Promise<RecurringTransaction>;
  update(args: {
    where: { id: string };
    data: {
      type?: RecurringType;
      categoryId?: string;
      costCenterId?: string | null;
      description?: string;
      amount?: string;
      recurrenceRule?: RecurrenceRule;
      startDate?: Date;
      endDate?: Date | null;
    };
  }): Promise<RecurringTransaction>;
  delete(args: {
    where: { id: string };
  }): Promise<RecurringTransaction>;
  createPayable?(args: {
    data: {
      userId: string;
      categoryId: string;
      costCenterId?: string | null;
      description: string;
      amount: string;
      dueDate: Date;
      status: 'PENDING';
    };
  }): Promise<void>;
  createReceivable?(args: {
    data: {
      userId: string;
      categoryId: string;
      costCenterId?: string | null;
      description: string;
      amount: string;
      dueDate: Date;
      status: 'PENDING';
    };
  }): Promise<void>;
  findExistingPayables?(args: {
    where: {
      userId: string;
      description: string;
      dueDate: Date;
      deletedAt: null;
    };
  }): Promise<Array<{ id: string }>>;
  findExistingReceivables?(args: {
    where: {
      userId: string;
      description: string;
      dueDate: Date;
      deletedAt: null;
    };
  }): Promise<Array<{ id: string }>>;
};

const validTypes = new Set<RecurringType>(['EXPENSE', 'INCOME']);
const validRules = new Set<RecurrenceRule>(['MONTHLY', 'WEEKLY', 'YEARLY']);

export function recurringTransactionError(message: string, code: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code }
  });
}

function parseAmount(raw: string): number {
  const normalized = raw.trim().replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    throw recurringTransactionError(
      'O valor deve ser um número positivo.',
      'INVALID_AMOUNT'
    );
  }
  return value;
}

function parseDate(raw: string, fieldName = 'data'): Date {
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    throw recurringTransactionError(
      `A ${fieldName} informada é inválida.`,
      'INVALID_DATE'
    );
  }
  return d;
}

export function computeNextOccurrences(
  startDate: Date,
  rule: RecurrenceRule,
  endDate?: Date | null,
  maxHorizon: Date = new Date()
): Date[] {
  const occurrences: Date[] = [];
  const current = new Date(startDate);

  while (current <= maxHorizon) {
    if (endDate && current > endDate) {
      break;
    }
    occurrences.push(new Date(current));

    switch (rule) {
      case 'WEEKLY':
        current.setDate(current.getDate() + 7);
        break;
      case 'MONTHLY':
        current.setMonth(current.getMonth() + 1);
        break;
      case 'YEARLY':
        current.setFullYear(current.getFullYear() + 1);
        break;
    }
  }

  return occurrences;
}

export async function listMyRecurringTransactions(
  context: GraphQLContext,
  repository: RecurringTransactionRepository
): Promise<RecurringTransaction[]> {
  const userId = requireVerifiedUserId(context);
  return repository.findMany({
    where: { userId }
  });
}

export async function createRecurringTransaction(
  context: GraphQLContext,
  input: CreateRecurringTransactionInput,
  repository: RecurringTransactionRepository
): Promise<RecurringTransaction> {
  const userId = requireVerifiedUserId(context);

  if (!input.description || input.description.trim() === '') {
    throw recurringTransactionError(
      'A descrição é obrigatória.',
      'INVALID_DESCRIPTION'
    );
  }

  if (!validTypes.has(input.type)) {
    throw recurringTransactionError(
      'Tipo de recorrência inválido.',
      'INVALID_TYPE'
    );
  }

  if (!validRules.has(input.recurrenceRule)) {
    throw recurringTransactionError(
      'Frequência de recorrência inválida.',
      'INVALID_RECURRENCE_RULE'
    );
  }

  const parsedAmount = parseAmount(input.amount);
  const startDate = parseDate(input.startDate, 'data de início');
  const endDate = input.endDate ? parseDate(input.endDate, 'data de término') : null;

  if (endDate && endDate < startDate) {
    throw recurringTransactionError(
      'A data de término não pode ser anterior à data de início.',
      'INVALID_DATE_RANGE'
    );
  }

  const created = await repository.create({
    data: {
      userId,
      type: input.type,
      categoryId: input.categoryId,
      costCenterId: input.costCenterId || null,
      description: input.description.trim(),
      amount: parsedAmount.toFixed(2),
      recurrenceRule: input.recurrenceRule,
      startDate,
      endDate
    }
  });

  // Generates initial AccountPayable / AccountReceivable occurrence
  if (input.type === 'EXPENSE' && repository.createPayable) {
    await repository.createPayable({
      data: {
        userId,
        categoryId: input.categoryId,
        costCenterId: input.costCenterId || null,
        description: input.description.trim(),
        amount: parsedAmount.toFixed(2),
        dueDate: startDate,
        status: 'PENDING'
      }
    });
  } else if (input.type === 'INCOME' && repository.createReceivable) {
    await repository.createReceivable({
      data: {
        userId,
        categoryId: input.categoryId,
        costCenterId: input.costCenterId || null,
        description: input.description.trim(),
        amount: parsedAmount.toFixed(2),
        dueDate: startDate,
        status: 'PENDING'
      }
    });
  }

  return created;
}

export async function updateRecurringTransaction(
  context: GraphQLContext,
  input: UpdateRecurringTransactionInput,
  repository: RecurringTransactionRepository
): Promise<RecurringTransaction> {
  const userId = requireVerifiedUserId(context);

  const existing = await repository.findUnique({
    where: { id: input.id }
  });

  if (!existing || existing.userId !== userId) {
    throw recurringTransactionError(
      'Transação recorrente não encontrada.',
      'NOT_FOUND'
    );
  }

  if (input.type && !validTypes.has(input.type)) {
    throw recurringTransactionError(
      'Tipo de recorrência inválido.',
      'INVALID_TYPE'
    );
  }

  if (input.recurrenceRule && !validRules.has(input.recurrenceRule)) {
    throw recurringTransactionError(
      'Frequência de recorrência inválida.',
      'INVALID_RECURRENCE_RULE'
    );
  }

  let formattedAmount: string | undefined;
  if (input.amount !== undefined) {
    formattedAmount = parseAmount(input.amount).toFixed(2);
  }

  let startDate: Date | undefined;
  if (input.startDate !== undefined) {
    startDate = parseDate(input.startDate, 'data de início');
  }

  let endDate: Date | null | undefined;
  if (input.endDate !== undefined) {
    endDate = input.endDate ? parseDate(input.endDate, 'data de término') : null;
  }

  const effectiveStart = startDate ?? existing.startDate;
  const effectiveEnd = endDate !== undefined ? endDate : existing.endDate;

  if (effectiveEnd && effectiveEnd < effectiveStart) {
    throw recurringTransactionError(
      'A data de término não pode ser anterior à data de início.',
      'INVALID_DATE_RANGE'
    );
  }

  const data: Parameters<RecurringTransactionRepository['update']>[0]['data'] = {};
  if (input.type !== undefined) data.type = input.type;
  if (input.categoryId !== undefined) data.categoryId = input.categoryId;
  if (input.costCenterId !== undefined) data.costCenterId = input.costCenterId;
  if (input.description !== undefined) data.description = input.description.trim();
  if (formattedAmount !== undefined) data.amount = formattedAmount;
  if (input.recurrenceRule !== undefined) data.recurrenceRule = input.recurrenceRule;
  if (startDate !== undefined) data.startDate = startDate;
  if (endDate !== undefined) data.endDate = endDate;

  return repository.update({
    where: { id: input.id },
    data
  });
}

export async function deleteRecurringTransaction(
  context: GraphQLContext,
  id: string,
  repository: RecurringTransactionRepository
): Promise<boolean> {
  const userId = requireVerifiedUserId(context);

  const existing = await repository.findUnique({
    where: { id }
  });

  if (!existing || existing.userId !== userId) {
    throw recurringTransactionError(
      'Transação recorrente não encontrada.',
      'NOT_FOUND'
    );
  }

  await repository.delete({
    where: { id }
  });

  return true;
}

export async function processRecurringTransactions(
  context: GraphQLContext,
  repository: RecurringTransactionRepository
): Promise<ProcessRecurringResult> {
  const userId = requireVerifiedUserId(context);
  const items = await repository.findMany({
    where: { userId }
  });

  let generatedPayables = 0;
  let generatedReceivables = 0;
  const now = new Date();

  for (const item of items) {
    const dates = computeNextOccurrences(
      item.startDate,
      item.recurrenceRule,
      item.endDate,
      now
    );

    for (const d of dates) {
      if (item.type === 'EXPENSE' && repository.createPayable) {
        if (repository.findExistingPayables) {
          const existing = await repository.findExistingPayables({
            where: {
              userId,
              description: item.description,
              dueDate: d,
              deletedAt: null
            }
          });
          if (existing && existing.length > 0) {
            continue;
          }
        }
        await repository.createPayable({
          data: {
            userId,
            categoryId: item.categoryId,
            costCenterId: item.costCenterId || null,
            description: item.description,
            amount: item.amount,
            dueDate: d,
            status: 'PENDING'
          }
        });
        generatedPayables++;
      } else if (item.type === 'INCOME' && repository.createReceivable) {
        if (repository.findExistingReceivables) {
          const existing = await repository.findExistingReceivables({
            where: {
              userId,
              description: item.description,
              dueDate: d,
              deletedAt: null
            }
          });
          if (existing && existing.length > 0) {
            continue;
          }
        }
        await repository.createReceivable({
          data: {
            userId,
            categoryId: item.categoryId,
            costCenterId: item.costCenterId || null,
            description: item.description,
            amount: item.amount,
            dueDate: d,
            status: 'PENDING'
          }
        });
        generatedReceivables++;
      }
    }
  }

  return { generatedPayables, generatedReceivables };
}
