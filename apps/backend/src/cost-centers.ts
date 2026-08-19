import { GraphQLError } from 'graphql';
import type { GraphQLContext } from './graphql.js';
import { requireVerifiedUserId } from './financial-categories.js';

export type CostCenter = {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export type CreateCostCenterInput = {
  name: string;
  description?: string;
};

export type UpdateCostCenterInput = {
  id: string;
  name?: string;
  description?: string;
};

export type CostCenterRepository = {
  findMany(args: {
    where: { userId: string; deletedAt: null };
  }): Promise<CostCenter[]>;
  findUnique(args: {
    where: { id: string };
  }): Promise<CostCenter | null>;
  create(args: {
    data: { userId: string; name: string; description?: string | null };
  }): Promise<CostCenter>;
  update(args: {
    where: { id: string };
    data: Partial<{ name: string; description: string | null; deletedAt: Date | null }>;
  }): Promise<CostCenter>;
};

function costCenterError(message: string, code: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}

export async function listMyCostCenters(
  context: GraphQLContext,
  repository: CostCenterRepository
): Promise<CostCenter[]> {
  const userId = requireVerifiedUserId(context);
  return repository.findMany({ where: { userId, deletedAt: null } });
}

export async function createCostCenter(
  context: GraphQLContext,
  input: CreateCostCenterInput,
  repository: CostCenterRepository
): Promise<CostCenter> {
  const userId = requireVerifiedUserId(context);

  const name = input.name?.trim();
  if (!name || name.length > 60) {
    throw costCenterError('Cost center name must contain between 1 and 60 characters.', 'BAD_USER_INPUT');
  }

  const description = input.description?.trim() || null;
  if (description && description.length > 255) {
    throw costCenterError('Cost center description must contain at most 255 characters.', 'BAD_USER_INPUT');
  }

  return repository.create({
    data: {
      userId,
      name,
      description
    }
  });
}

export async function updateCostCenter(
  context: GraphQLContext,
  input: UpdateCostCenterInput,
  repository: CostCenterRepository
): Promise<CostCenter> {
  const userId = requireVerifiedUserId(context);

  if (!input.id) {
    throw costCenterError('Cost center ID is required.', 'BAD_USER_INPUT');
  }

  const existing = await repository.findUnique({ where: { id: input.id } });
  if (!existing || existing.deletedAt || existing.userId !== userId) {
    throw costCenterError('Cost center was not found.', 'NOT_FOUND');
  }

  const updateData: Partial<{ name: string; description: string | null }> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name || name.length > 60) {
      throw costCenterError('Cost center name must contain between 1 and 60 characters.', 'BAD_USER_INPUT');
    }
    updateData.name = name;
  }

  if (input.description !== undefined) {
    const description = input.description.trim() || null;
    if (description && description.length > 255) {
      throw costCenterError('Cost center description must contain at most 255 characters.', 'BAD_USER_INPUT');
    }
    updateData.description = description;
  }

  return repository.update({ where: { id: input.id }, data: updateData });
}

export async function deleteCostCenter(
  context: GraphQLContext,
  id: string,
  repository: CostCenterRepository
): Promise<boolean> {
  const userId = requireVerifiedUserId(context);

  if (!id) {
    throw costCenterError('Cost center ID is required.', 'BAD_USER_INPUT');
  }

  const existing = await repository.findUnique({ where: { id } });
  if (!existing || existing.deletedAt || existing.userId !== userId) {
    throw costCenterError('Cost center was not found.', 'NOT_FOUND');
  }

  await repository.update({
    where: { id },
    data: { deletedAt: new Date() }
  });

  return true;
}
