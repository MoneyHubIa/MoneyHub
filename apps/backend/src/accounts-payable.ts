import { GraphQLError } from 'graphql';
import type { GraphQLContext } from './graphql.js';
import { requireVerifiedUserId } from './financial-categories.js';

export type AccountPayableStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export type AccountPayable = {
  id: string;
  userId: string;
  categoryId: string;
  costCenterId?: string | null;
  description: string;
  amount: string;
  dueDate: Date;
  status: AccountPayableStatus;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export type CreateAccountPayableInput = {
  categoryId: string;
  costCenterId?: string;
  description: string;
  amount: string;
  dueDate: string;
  status?: AccountPayableStatus;
};

export type UpdateAccountPayableInput = {
  id: string;
  categoryId?: string;
  costCenterId?: string;
  description?: string;
  amount?: string;
  dueDate?: string;
  status?: AccountPayableStatus;
  paidAt?: string | null;
};

export type AccountPayableRepository = {
  findMany(args: {
    where: {
      userId: string;
      deletedAt: null;
      status?: AccountPayableStatus;
    };
  }): Promise<AccountPayable[]>;
  findUnique(args: {
    where: { id: string };
  }): Promise<AccountPayable | null>;
  create(args: {
    data: {
      userId: string;
      categoryId: string;
      costCenterId?: string | null;
      description: string;
      amount: string;
      dueDate: Date;
      status?: AccountPayableStatus;
      paidAt?: Date | null;
    };
  }): Promise<AccountPayable>;
  update(args: {
    where: { id: string };
    data: {
      categoryId?: string;
      costCenterId?: string | null;
      description?: string;
      amount?: string;
      dueDate?: Date;
      status?: AccountPayableStatus;
      paidAt?: Date | null;
      deletedAt?: Date;
    };
  }): Promise<AccountPayable>;
  createExpenseFromPayable?(args: {
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

const validStatuses = new Set<AccountPayableStatus>(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']);

export function accountPayableError(message: string, code: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code }
  });
}

export async function listMyAccountsPayable(
  context: GraphQLContext,
  statusFilter: AccountPayableStatus | undefined,
  repository: AccountPayableRepository
): Promise<AccountPayable[]> {
  const userId = requireVerifiedUserId(context);

  if (statusFilter && !validStatuses.has(statusFilter)) {
    throw accountPayableError('Invalid status filter.', 'BAD_USER_INPUT');
  }

  return repository.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(statusFilter ? { status: statusFilter } : {})
    }
  });
}

export async function createAccountPayable(
  context: GraphQLContext,
  input: CreateAccountPayableInput,
  repository: AccountPayableRepository
): Promise<AccountPayable> {
  const userId = requireVerifiedUserId(context);

  if (!input.categoryId) {
    throw accountPayableError('Category ID is required.', 'BAD_USER_INPUT');
  }

  const description = input.description?.trim();
  if (!description || description.length > 120) {
    throw accountPayableError('Description must contain between 1 and 120 characters.', 'BAD_USER_INPUT');
  }

  if (!input.amount || isNaN(Number(input.amount)) || Number(input.amount) <= 0) {
    throw accountPayableError('Amount must be a positive number.', 'BAD_USER_INPUT');
  }

  const dueDate = new Date(input.dueDate);
  if (isNaN(dueDate.getTime())) {
    throw accountPayableError('Invalid due date.', 'BAD_USER_INPUT');
  }

  const status: AccountPayableStatus = input.status ?? 'PENDING';
  if (!validStatuses.has(status)) {
    throw accountPayableError('Invalid account payable status.', 'BAD_USER_INPUT');
  }

  const paidAt = status === 'PAID' ? new Date() : null;

  return repository.create({
    data: {
      userId,
      categoryId: input.categoryId,
      costCenterId: input.costCenterId || null,
      description,
      amount: input.amount,
      dueDate,
      status,
      paidAt
    }
  });
}

export async function updateAccountPayable(
  context: GraphQLContext,
  input: UpdateAccountPayableInput,
  repository: AccountPayableRepository
): Promise<AccountPayable> {
  const userId = requireVerifiedUserId(context);

  if (!input.id) {
    throw accountPayableError('Account Payable ID is required.', 'BAD_USER_INPUT');
  }

  const existing = await repository.findUnique({ where: { id: input.id } });
  if (!existing || existing.deletedAt || existing.userId !== userId) {
    throw accountPayableError('Account payable was not found.', 'NOT_FOUND');
  }

  const data: Parameters<AccountPayableRepository['update']>[0]['data'] = {};

  if (input.description !== undefined) {
    const desc = input.description.trim();
    if (!desc || desc.length > 120) {
      throw accountPayableError('Description must contain between 1 and 120 characters.', 'BAD_USER_INPUT');
    }
    data.description = desc;
  }

  if (input.amount !== undefined) {
    if (isNaN(Number(input.amount)) || Number(input.amount) <= 0) {
      throw accountPayableError('Amount must be a positive number.', 'BAD_USER_INPUT');
    }
    data.amount = input.amount;
  }

  if (input.dueDate !== undefined) {
    const due = new Date(input.dueDate);
    if (isNaN(due.getTime())) {
      throw accountPayableError('Invalid due date.', 'BAD_USER_INPUT');
    }
    data.dueDate = due;
  }

  if (input.status !== undefined) {
    if (!validStatuses.has(input.status)) {
      throw accountPayableError('Invalid account payable status.', 'BAD_USER_INPUT');
    }
    data.status = input.status;
    if (input.status === 'PAID' && !existing.paidAt && input.paidAt === undefined) {
      data.paidAt = new Date();
    } else if (input.status !== 'PAID') {
      data.paidAt = null;
    }
  }

  if (input.paidAt !== undefined) {
    if (input.paidAt === null) {
      data.paidAt = null;
    } else {
      const paid = new Date(input.paidAt);
      if (isNaN(paid.getTime())) {
        throw accountPayableError('Invalid paid date.', 'BAD_USER_INPUT');
      }
      data.paidAt = paid;
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

export async function markAccountPayablePaid(
  context: GraphQLContext,
  args: { id: string; paidAt?: string },
  repository: AccountPayableRepository
): Promise<AccountPayable> {
  const userId = requireVerifiedUserId(context);

  if (!args.id) {
    throw accountPayableError('Account Payable ID is required.', 'BAD_USER_INPUT');
  }

  const existing = await repository.findUnique({ where: { id: args.id } });
  if (!existing || existing.deletedAt || existing.userId !== userId) {
    throw accountPayableError('Account payable was not found.', 'NOT_FOUND');
  }

  const paidAt = args.paidAt ? new Date(args.paidAt) : new Date();
  if (isNaN(paidAt.getTime())) {
    throw accountPayableError('Invalid paid date.', 'BAD_USER_INPUT');
  }

  const updated = await repository.update({
    where: { id: args.id },
    data: {
      status: 'PAID',
      paidAt
    }
  });

  if (repository.createExpenseFromPayable) {
    await repository.createExpenseFromPayable({
      data: {
        userId,
        categoryId: existing.categoryId,
        costCenterId: existing.costCenterId ?? null,
        description: `[Pago] ${existing.description}`,
        amount: existing.amount,
        occurredAt: paidAt,
        notes: `Baixa da conta a pagar #${existing.id}`
      }
    });
  }

  return updated;
}

export async function deleteAccountPayable(
  context: GraphQLContext,
  args: { id: string },
  repository: AccountPayableRepository
): Promise<boolean> {
  const userId = requireVerifiedUserId(context);

  if (!args.id) {
    throw accountPayableError('Account Payable ID is required.', 'BAD_USER_INPUT');
  }

  const existing = await repository.findUnique({ where: { id: args.id } });
  if (!existing || existing.deletedAt || existing.userId !== userId) {
    throw accountPayableError('Account payable was not found.', 'NOT_FOUND');
  }

  await repository.update({
    where: { id: args.id },
    data: { deletedAt: new Date() }
  });

  return true;
}
