import { GraphQLError } from 'graphql';
import type { GraphQLContext } from './graphql.js';
import { requireVerifiedUserId } from './financial-categories.js';

export type Income = {
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

export type CreateIncomeInput = {
  categoryId: string;
  costCenterId?: string;
  description: string;
  amount: string;
  occurredAt: string;
  notes?: string;
};

export type UpdateIncomeInput = {
  id: string;
  categoryId?: string;
  costCenterId?: string;
  description?: string;
  amount?: string;
  occurredAt?: string;
  notes?: string;
};

export type IncomeRepository = {
  findMany(args: {
    where: { userId: string; deletedAt: null };
  }): Promise<Income[]>;
  findUnique(args: {
    where: { id: string };
  }): Promise<Income | null>;
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
  }): Promise<Income>;
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
  }): Promise<Income>;
};

function incomeError(message: string, code: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}

export async function listMyIncomes(
  context: GraphQLContext,
  repository: IncomeRepository
): Promise<Income[]> {
  const userId = requireVerifiedUserId(context);
  return repository.findMany({ where: { userId, deletedAt: null } });
}

export async function createIncome(
  context: GraphQLContext,
  input: CreateIncomeInput,
  repository: IncomeRepository
): Promise<Income> {
  const userId = requireVerifiedUserId(context);

  if (!input.categoryId) {
    throw incomeError('Category ID is required.', 'BAD_USER_INPUT');
  }

  const description = input.description?.trim();
  if (!description || description.length > 120) {
    throw incomeError('Description must contain between 1 and 120 characters.', 'BAD_USER_INPUT');
  }

  if (!input.amount || isNaN(Number(input.amount)) || Number(input.amount) <= 0) {
    throw incomeError('Amount must be a positive number.', 'BAD_USER_INPUT');
  }

  const occurredAt = new Date(input.occurredAt);
  if (isNaN(occurredAt.getTime())) {
    throw incomeError('Invalid occurrence date.', 'BAD_USER_INPUT');
  }

  const notes = input.notes?.trim() || null;
  if (notes && notes.length > 500) {
    throw incomeError('Notes cannot exceed 500 characters.', 'BAD_USER_INPUT');
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

export async function updateIncome(
  context: GraphQLContext,
  input: UpdateIncomeInput,
  repository: IncomeRepository
): Promise<Income> {
  const userId = requireVerifiedUserId(context);

  if (!input.id) {
    throw incomeError('Income ID is required.', 'BAD_USER_INPUT');
  }

  const existing = await repository.findUnique({ where: { id: input.id } });
  if (!existing || existing.deletedAt || existing.userId !== userId) {
    throw incomeError('Income was not found.', 'NOT_FOUND');
  }

  const updateData: Parameters<IncomeRepository['update']>[0]['data'] = {};

  if (input.categoryId !== undefined) {
    if (!input.categoryId) throw incomeError('Category ID is required.', 'BAD_USER_INPUT');
    updateData.categoryId = input.categoryId;
  }

  if (input.costCenterId !== undefined) {
    updateData.costCenterId = input.costCenterId || null;
  }

  if (input.description !== undefined) {
    const description = input.description.trim();
    if (!description || description.length > 120) {
      throw incomeError('Description must contain between 1 and 120 characters.', 'BAD_USER_INPUT');
    }
    updateData.description = description;
  }

  if (input.amount !== undefined) {
    if (!input.amount || isNaN(Number(input.amount)) || Number(input.amount) <= 0) {
      throw incomeError('Amount must be a positive number.', 'BAD_USER_INPUT');
    }
    updateData.amount = input.amount;
  }

  if (input.occurredAt !== undefined) {
    const occurredAt = new Date(input.occurredAt);
    if (isNaN(occurredAt.getTime())) {
      throw incomeError('Invalid occurrence date.', 'BAD_USER_INPUT');
    }
    updateData.occurredAt = occurredAt;
  }

  if (input.notes !== undefined) {
    const notes = input.notes?.trim() || null;
    if (notes && notes.length > 500) {
      throw incomeError('Notes cannot exceed 500 characters.', 'BAD_USER_INPUT');
    }
    updateData.notes = notes;
  }

  return repository.update({ where: { id: input.id }, data: updateData });
}

export async function deleteIncome(
  context: GraphQLContext,
  id: string,
  repository: IncomeRepository
): Promise<boolean> {
  const userId = requireVerifiedUserId(context);

  if (!id) {
    throw incomeError('Income ID is required.', 'BAD_USER_INPUT');
  }

  const existing = await repository.findUnique({ where: { id } });
  if (!existing || existing.deletedAt || existing.userId !== userId) {
    throw incomeError('Income was not found.', 'NOT_FOUND');
  }

  await repository.update({
    where: { id },
    data: { deletedAt: new Date() }
  });

  return true;
}
