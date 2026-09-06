import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../../../core/graphql/graphql.js';
import { requireVerifiedUserId } from '../financial-categories/financial-categories.js';

export type Expense = {
  id: string;
  userId: string;
  categoryId: string;
  costCenterId?: string | null;
  description: string;
  amount: string; // Passed as string to GraphQL
  occurredAt: Date;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export type CreateExpenseInput = {
  categoryId: string;
  costCenterId?: string;
  description: string;
  amount: string;
  occurredAt: string;
  notes?: string;
};

export type UpdateExpenseInput = {
  id: string;
  categoryId?: string;
  costCenterId?: string;
  description?: string;
  amount?: string;
  occurredAt?: string;
  notes?: string;
};

export type ExpenseRepository = {
  findMany(args: {
    where: { userId: string; deletedAt: null };
  }): Promise<Expense[]>;
  findUnique(args: {
    where: { id: string };
  }): Promise<Expense | null>;
  create(args: {
    data: {
      userId: string;
      categoryId: string;
      costCenterId?: string | null;
      description: string;
      amount: string;
      occurredAt: Date;
      notes?: string | null;
    };
  }): Promise<Expense>;
  update(args: {
    where: { id: string };
    data: Partial<{
      categoryId: string;
      costCenterId: string | null;
      description: string;
      amount: string;
      occurredAt: Date;
      notes: string | null;
      deletedAt: Date | null;
    }>;
  }): Promise<Expense>;
};

function expenseError(message: string, code: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}

export async function listMyExpenses(
  context: GraphQLContext,
  repository: ExpenseRepository
): Promise<Expense[]> {
  const userId = requireVerifiedUserId(context);
  return repository.findMany({ where: { userId, deletedAt: null } });
}

export async function createExpense(
  context: GraphQLContext,
  input: CreateExpenseInput,
  repository: ExpenseRepository
): Promise<Expense> {
  const userId = requireVerifiedUserId(context);

  if (!input.categoryId) {
    throw expenseError('Category ID is required.', 'BAD_USER_INPUT');
  }

  const description = input.description?.trim();
  if (!description || description.length > 120) {
    throw expenseError('Description must contain between 1 and 120 characters.', 'BAD_USER_INPUT');
  }

  if (!input.amount || isNaN(Number(input.amount)) || Number(input.amount) <= 0) {
    throw expenseError('Amount must be a positive number.', 'BAD_USER_INPUT');
  }

  const occurredAt = new Date(input.occurredAt);
  if (isNaN(occurredAt.getTime())) {
    throw expenseError('Invalid occurrence date.', 'BAD_USER_INPUT');
  }

  const notes = input.notes?.trim() || null;
  if (notes && notes.length > 500) {
    throw expenseError('Notes cannot exceed 500 characters.', 'BAD_USER_INPUT');
  }

  return repository.create({
    data: {
      userId,
      categoryId: input.categoryId,
      costCenterId: input.costCenterId || null,
      description,
      amount: input.amount,
      occurredAt,
      notes
    }
  });
}

export async function updateExpense(
  context: GraphQLContext,
  input: UpdateExpenseInput,
  repository: ExpenseRepository
): Promise<Expense> {
  const userId = requireVerifiedUserId(context);

  if (!input.id) {
    throw expenseError('Expense ID is required.', 'BAD_USER_INPUT');
  }

  const existing = await repository.findUnique({ where: { id: input.id } });
  if (!existing || existing.deletedAt || existing.userId !== userId) {
    throw expenseError('Expense was not found.', 'NOT_FOUND');
  }

  const updateData: Parameters<ExpenseRepository['update']>[0]['data'] = {};

  if (input.categoryId !== undefined) {
    if (!input.categoryId) throw expenseError('Category ID is required.', 'BAD_USER_INPUT');
    updateData.categoryId = input.categoryId;
  }

  if (input.costCenterId !== undefined) {
    updateData.costCenterId = input.costCenterId || null;
  }

  if (input.description !== undefined) {
    const description = input.description.trim();
    if (!description || description.length > 120) {
      throw expenseError('Description must contain between 1 and 120 characters.', 'BAD_USER_INPUT');
    }
    updateData.description = description;
  }

  if (input.amount !== undefined) {
    if (!input.amount || isNaN(Number(input.amount)) || Number(input.amount) <= 0) {
      throw expenseError('Amount must be a positive number.', 'BAD_USER_INPUT');
    }
    updateData.amount = input.amount;
  }

  if (input.occurredAt !== undefined) {
    const occurredAt = new Date(input.occurredAt);
    if (isNaN(occurredAt.getTime())) {
      throw expenseError('Invalid occurrence date.', 'BAD_USER_INPUT');
    }
    updateData.occurredAt = occurredAt;
  }

  if (input.notes !== undefined) {
    const notes = input.notes?.trim() || null;
    if (notes && notes.length > 500) {
      throw expenseError('Notes cannot exceed 500 characters.', 'BAD_USER_INPUT');
    }
    updateData.notes = notes;
  }

  return repository.update({ where: { id: input.id }, data: updateData });
}

export async function deleteExpense(
  context: GraphQLContext,
  id: string,
  repository: ExpenseRepository
): Promise<boolean> {
  const userId = requireVerifiedUserId(context);

  if (!id) {
    throw expenseError('Expense ID is required.', 'BAD_USER_INPUT');
  }

  const existing = await repository.findUnique({ where: { id } });
  if (!existing || existing.deletedAt || existing.userId !== userId) {
    throw expenseError('Expense was not found.', 'NOT_FOUND');
  }

  await repository.update({
    where: { id },
    data: { deletedAt: new Date() }
  });

  return true;
}
