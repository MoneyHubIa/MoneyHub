import { GraphQLError } from 'graphql';
import type { GraphQLContext } from './graphql.js';

export type CategoryType = 'INCOME' | 'EXPENSE' | 'BOTH';

export type FinancialCategory = {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export type CreateCategoryInput = {
  name: string;
  type?: CategoryType;
  color?: string;
  icon?: string;
};

export type UpdateCategoryInput = {
  id: string;
  name?: string;
  type?: CategoryType;
  color?: string;
  icon?: string;
};

export type FinancialCategoryRepository = {
  findMany(args: {
    where: { userId: string; deletedAt: null; type?: CategoryType | { in: CategoryType[] } };
  }): Promise<FinancialCategory[]>;
  findUnique(args: {
    where: { id: string };
  }): Promise<FinancialCategory | null>;
  create(args: {
    data: { userId: string; name: string; type: CategoryType; color: string; icon: string };
  }): Promise<FinancialCategory>;
  update(args: {
    where: { id: string };
    data: Partial<{ name: string; type: CategoryType; color: string; icon: string; deletedAt: Date | null }>;
  }): Promise<FinancialCategory>;
};

function categoryError(message: string, code: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}

export function requireVerifiedUserId(context: GraphQLContext): string {
  if (!context.auth) throw categoryError('Authentication credentials are invalid.', 'UNAUTHENTICATED');
  if (!context.auth.emailVerified) throw categoryError('Email verification is required.', 'EMAIL_NOT_VERIFIED');
  if (!context.auth.userId) throw categoryError('Profile bootstrap is required.', 'PROFILE_NOT_FOUND');
  return context.auth.userId;
}

const validTypes = new Set<CategoryType>(['INCOME', 'EXPENSE', 'BOTH']);

export async function listMyCategories(
  context: GraphQLContext,
  filterType: CategoryType | undefined,
  repository: FinancialCategoryRepository
): Promise<FinancialCategory[]> {
  const userId = requireVerifiedUserId(context);
  const whereFilter: { userId: string; deletedAt: null; type?: CategoryType | { in: CategoryType[] } } = {
    userId,
    deletedAt: null
  };

  if (filterType) {
    if (!validTypes.has(filterType)) {
      throw categoryError('Invalid category type filter.', 'BAD_USER_INPUT');
    }
    whereFilter.type = { in: [filterType, 'BOTH'] };
  }

  return repository.findMany({ where: whereFilter });
}

export async function createCategory(
  context: GraphQLContext,
  input: CreateCategoryInput,
  repository: FinancialCategoryRepository
): Promise<FinancialCategory> {
  const userId = requireVerifiedUserId(context);

  const name = input.name?.trim();
  if (!name || name.length > 60) {
    throw categoryError('Category name must contain between 1 and 60 characters.', 'BAD_USER_INPUT');
  }

  const type = input.type ?? 'BOTH';
  if (!validTypes.has(type)) {
    throw categoryError('Invalid category type.', 'BAD_USER_INPUT');
  }

  const color = input.color?.trim() || '#4A5568';
  if (color.length > 20) {
    throw categoryError('Color format is invalid.', 'BAD_USER_INPUT');
  }

  const icon = input.icon?.trim() || 'tag';
  if (icon.length > 50) {
    throw categoryError('Icon name is invalid.', 'BAD_USER_INPUT');
  }

  return repository.create({
    data: {
      userId,
      name,
      type,
      color,
      icon
    }
  });
}

export async function updateCategory(
  context: GraphQLContext,
  input: UpdateCategoryInput,
  repository: FinancialCategoryRepository
): Promise<FinancialCategory> {
  const userId = requireVerifiedUserId(context);

  if (!input.id) {
    throw categoryError('Category ID is required.', 'BAD_USER_INPUT');
  }

  const existing = await repository.findUnique({ where: { id: input.id } });
  if (!existing || existing.deletedAt || existing.userId !== userId) {
    throw categoryError('Category was not found.', 'NOT_FOUND');
  }

  const updateData: Partial<{ name: string; type: CategoryType; color: string; icon: string }> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name || name.length > 60) {
      throw categoryError('Category name must contain between 1 and 60 characters.', 'BAD_USER_INPUT');
    }
    updateData.name = name;
  }

  if (input.type !== undefined) {
    if (!validTypes.has(input.type)) {
      throw categoryError('Invalid category type.', 'BAD_USER_INPUT');
    }
    updateData.type = input.type;
  }

  if (input.color !== undefined) {
    const color = input.color.trim();
    if (!color || color.length > 20) {
      throw categoryError('Color format is invalid.', 'BAD_USER_INPUT');
    }
    updateData.color = color;
  }

  if (input.icon !== undefined) {
    const icon = input.icon.trim();
    if (!icon || icon.length > 50) {
      throw categoryError('Icon name is invalid.', 'BAD_USER_INPUT');
    }
    updateData.icon = icon;
  }

  return repository.update({ where: { id: input.id }, data: updateData });
}

export async function deleteCategory(
  context: GraphQLContext,
  id: string,
  repository: FinancialCategoryRepository
): Promise<boolean> {
  const userId = requireVerifiedUserId(context);

  if (!id) {
    throw categoryError('Category ID is required.', 'BAD_USER_INPUT');
  }

  const existing = await repository.findUnique({ where: { id } });
  if (!existing || existing.deletedAt || existing.userId !== userId) {
    throw categoryError('Category was not found.', 'NOT_FOUND');
  }

  await repository.update({
    where: { id },
    data: { deletedAt: new Date() }
  });

  return true;
}
