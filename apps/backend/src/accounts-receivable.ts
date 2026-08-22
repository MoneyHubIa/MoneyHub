import { GraphQLError } from 'graphql';
import type { GraphQLContext } from './graphql.js';
import { requireVerifiedUserId } from './financial-categories.js';

export type AccountReceivableStatus = 'PENDING' | 'RECEIVED' | 'OVERDUE' | 'CANCELLED';

export type AccountReceivable = {
  id: string;
  userId: string;
  categoryId: string;
  costCenterId?: string | null;
  description: string;
  amount: string;
  dueDate: Date;
  status: AccountReceivableStatus;
  receivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export type CreateAccountReceivableInput = {
  categoryId: string;
  costCenterId?: string;
  description: string;
  amount: string;
  dueDate: string;
  status?: AccountReceivableStatus;
};

export type UpdateAccountReceivableInput = {
  id: string;
  categoryId?: string;
  costCenterId?: string;
  description?: string;
  amount?: string;
  dueDate?: string;
  status?: AccountReceivableStatus;
  receivedAt?: string | null;
};

export type AccountReceivableRepository = {
  findMany(args: {
    where: {
      userId: string;
      deletedAt: null;
      status?: AccountReceivableStatus;
    };
  }): Promise<AccountReceivable[]>;
  findUnique(args: {
    where: { id: string };
  }): Promise<AccountReceivable | null>;
  create(args: {
    data: {
      userId: string;
      categoryId: string;
      costCenterId?: string | null;
      description: string;
      amount: string;
      dueDate: Date;
      status?: AccountReceivableStatus;
      receivedAt?: Date | null;
    };
  }): Promise<AccountReceivable>;
  update(args: {
    where: { id: string };
    data: {
      categoryId?: string;
      costCenterId?: string | null;
      description?: string;
      amount?: string;
      dueDate?: Date;
      status?: AccountReceivableStatus;
      receivedAt?: Date | null;
      deletedAt?: Date;
    };
  }): Promise<AccountReceivable>;
  createIncomeFromReceivable?(args: {
    data: {
      userId: string;
      categoryId: string;
      costCenterId?: string | null;
      description: string;
      amount: string;
      occurredAt: Date;
      notes?: string | null;
    };
  }): Promise<void>;
};

const validStatuses = new Set<AccountReceivableStatus>(['PENDING', 'RECEIVED', 'OVERDUE', 'CANCELLED']);

export function accountReceivableError(message: string, code: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code }
  });
}

export async function listMyAccountsReceivable(
  context: GraphQLContext,
  statusFilter: AccountReceivableStatus | undefined,
  repository: AccountReceivableRepository
): Promise<AccountReceivable[]> {
  const userId = requireVerifiedUserId(context);

  if (statusFilter && !validStatuses.has(statusFilter)) {
    throw accountReceivableError('Invalid status filter.', 'BAD_USER_INPUT');
  }

  return repository.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(statusFilter ? { status: statusFilter } : {})
    }
  });
}

export async function createAccountReceivable(
  context: GraphQLContext,
  input: CreateAccountReceivableInput,
  repository: AccountReceivableRepository
): Promise<AccountReceivable> {
  const userId = requireVerifiedUserId(context);

  if (!input.categoryId) {
    throw accountReceivableError('Category ID is required.', 'BAD_USER_INPUT');
  }

  const description = input.description?.trim();
  if (!description || description.length > 120) {
    throw accountReceivableError('Description must contain between 1 and 120 characters.', 'BAD_USER_INPUT');
  }

  if (!input.amount || isNaN(Number(input.amount)) || Number(input.amount) <= 0) {
    throw accountReceivableError('Amount must be a positive number.', 'BAD_USER_INPUT');
  }

  const dueDate = new Date(input.dueDate);
  if (isNaN(dueDate.getTime())) {
    throw accountReceivableError('Invalid due date.', 'BAD_USER_INPUT');
  }

  const status: AccountReceivableStatus = input.status ?? 'PENDING';
  if (!validStatuses.has(status)) {
    throw accountReceivableError('Invalid account receivable status.', 'BAD_USER_INPUT');
  }

  const receivedAt = status === 'RECEIVED' ? new Date() : null;

  return repository.create({
    data: {
      userId,
      categoryId: input.categoryId,
      costCenterId: input.costCenterId || null,
      description,
      amount: input.amount,
      dueDate,
      status,
      receivedAt
    }
  });
}

export async function updateAccountReceivable(
  context: GraphQLContext,
  input: UpdateAccountReceivableInput,
  repository: AccountReceivableRepository
): Promise<AccountReceivable> {
  const userId = requireVerifiedUserId(context);

  if (!input.id) {
    throw accountReceivableError('Account Receivable ID is required.', 'BAD_USER_INPUT');
  }

  const existing = await repository.findUnique({ where: { id: input.id } });
  if (!existing || existing.deletedAt || existing.userId !== userId) {
    throw accountReceivableError('Account receivable was not found.', 'NOT_FOUND');
  }

  const data: Parameters<AccountReceivableRepository['update']>[0]['data'] = {};

  if (input.description !== undefined) {
    const desc = input.description.trim();
    if (!desc || desc.length > 120) {
      throw accountReceivableError('Description must contain between 1 and 120 characters.', 'BAD_USER_INPUT');
    }
    data.description = desc;
  }

  if (input.amount !== undefined) {
    if (isNaN(Number(input.amount)) || Number(input.amount) <= 0) {
      throw accountReceivableError('Amount must be a positive number.', 'BAD_USER_INPUT');
    }
    data.amount = input.amount;
  }

  if (input.dueDate !== undefined) {
    const due = new Date(input.dueDate);
    if (isNaN(due.getTime())) {
      throw accountReceivableError('Invalid due date.', 'BAD_USER_INPUT');
    }
    data.dueDate = due;
  }

  if (input.status !== undefined) {
    if (!validStatuses.has(input.status)) {
      throw accountReceivableError('Invalid account receivable status.', 'BAD_USER_INPUT');
    }
    data.status = input.status;
    if (input.status === 'RECEIVED' && !existing.receivedAt && input.receivedAt === undefined) {
      data.receivedAt = new Date();
    } else if (input.status !== 'RECEIVED') {
      data.receivedAt = null;
    }
  }

  if (input.receivedAt !== undefined) {
    if (input.receivedAt === null) {
      data.receivedAt = null;
    } else {
      const received = new Date(input.receivedAt);
      if (isNaN(received.getTime())) {
        throw accountReceivableError('Invalid received date.', 'BAD_USER_INPUT');
      }
      data.receivedAt = received;
    }
  }

  if (input.categoryId !== undefined) {
    data.categoryId = input.categoryId;
  }

  if (input.costCenterId !== undefined) {
    data.costCenterId = input.costCenterId || null;
  }

  return repository.update({
    where: { id: input.id },
    data
  });
}

export async function markAccountReceivableReceived(
  context: GraphQLContext,
  args: { id: string; receivedAt?: string },
  repository: AccountReceivableRepository
): Promise<AccountReceivable> {
  const userId = requireVerifiedUserId(context);

  if (!args.id) {
    throw accountReceivableError('Account Receivable ID is required.', 'BAD_USER_INPUT');
  }

  const existing = await repository.findUnique({ where: { id: args.id } });
  if (!existing || existing.deletedAt || existing.userId !== userId) {
    throw accountReceivableError('Account receivable was not found.', 'NOT_FOUND');
  }

  const receivedAt = args.receivedAt ? new Date(args.receivedAt) : new Date();
  if (isNaN(receivedAt.getTime())) {
    throw accountReceivableError('Invalid received date.', 'BAD_USER_INPUT');
  }

  const updated = await repository.update({
    where: { id: args.id },
    data: {
      status: 'RECEIVED',
      receivedAt
    }
  });

  if (repository.createIncomeFromReceivable) {
    await repository.createIncomeFromReceivable({
      data: {
        userId,
        categoryId: existing.categoryId,
        costCenterId: existing.costCenterId ?? null,
        description: `[Recebido] ${existing.description}`,
        amount: existing.amount,
        occurredAt: receivedAt,
        notes: `Baixa da conta a receber #${existing.id}`
      }
    });
  }

  return updated;
}

export async function deleteAccountReceivable(
  context: GraphQLContext,
  args: { id: string },
  repository: AccountReceivableRepository
): Promise<boolean> {
  const userId = requireVerifiedUserId(context);

  if (!args.id) {
    throw accountReceivableError('Account Receivable ID is required.', 'BAD_USER_INPUT');
  }

  const existing = await repository.findUnique({ where: { id: args.id } });
  if (!existing || existing.deletedAt || existing.userId !== userId) {
    throw accountReceivableError('Account receivable was not found.', 'NOT_FOUND');
  }

  await repository.update({
    where: { id: args.id },
    data: { deletedAt: new Date() }
  });

  return true;
}
