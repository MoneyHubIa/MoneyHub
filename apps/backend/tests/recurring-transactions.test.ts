import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GraphQLError } from 'graphql';
import {
  computeNextOccurrences,
  createRecurringTransaction,
  deleteRecurringTransaction,
  listMyRecurringTransactions,
  processRecurringTransactions,
  updateRecurringTransaction,
  type RecurringTransaction,
  type RecurringTransactionRepository
} from '../src/recurring-transactions.js';
import { typeDefs } from '../src/graphql.js';

function verifiedContext() {
  return {
    requestId: 'request-1',
    auth: {
      uid: 'firebase-user-1',
      email: 'user@example.com',
      emailVerified: true,
      userId: 'user-1',
      profileId: 'profile-1'
    }
  };
}

function unverifiedContext() {
  return {
    requestId: 'request-2',
    auth: {
      uid: 'firebase-user-2',
      email: 'unverified@example.com',
      emailVerified: false,
      userId: 'user-2',
      profileId: 'profile-2'
    }
  };
}

function anonymousContext() {
  return {
    requestId: 'request-3',
    auth: null
  };
}

function createRepository(overrides: Partial<RecurringTransactionRepository> = {}): RecurringTransactionRepository & {
  store: RecurringTransaction[];
  payables: any[];
  receivables: any[];
} {
  const store: RecurringTransaction[] = [
    {
      id: 'rec-1',
      userId: 'user-1',
      type: 'EXPENSE',
      categoryId: 'cat-1',
      costCenterId: null,
      description: 'Aluguel Escritório',
      amount: '2500.00',
      recurrenceRule: 'MONTHLY',
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: null,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z')
    }
  ];

  const payables: any[] = [];
  const receivables: any[] = [];

  return {
    store,
    payables,
    receivables,
    findMany: async ({ where }) => {
      return store.filter((item) => item.userId === where.userId);
    },
    findUnique: async ({ where }) => {
      return store.find((item) => item.id === where.id) || null;
    },
    create: async ({ data }) => {
      const created: RecurringTransaction = {
        id: `rec-${store.length + 1}`,
        userId: data.userId,
        type: data.type,
        categoryId: data.categoryId,
        costCenterId: data.costCenterId ?? null,
        description: data.description,
        amount: data.amount,
        recurrenceRule: data.recurrenceRule,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      store.push(created);
      return created;
    },
    update: async ({ where, data }) => {
      const item = store.find((entry) => entry.id === where.id);
      if (!item) {
        throw new Error('Not found');
      }
      if (data.type) item.type = data.type;
      if (data.categoryId) item.categoryId = data.categoryId;
      if (data.costCenterId !== undefined) item.costCenterId = data.costCenterId ?? null;
      if (data.description !== undefined) item.description = data.description;
      if (data.amount !== undefined) item.amount = data.amount;
      if (data.recurrenceRule !== undefined) item.recurrenceRule = data.recurrenceRule;
      if (data.startDate !== undefined) item.startDate = data.startDate;
      if (data.endDate !== undefined) item.endDate = data.endDate;
      item.updatedAt = new Date();
      return item;
    },
    delete: async ({ where }) => {
      const index = store.findIndex((entry) => entry.id === where.id);
      if (index === -1) throw new Error('Not found');
      const [deleted] = store.splice(index, 1);
      return deleted!;
    },
    createPayable: async ({ data }) => {
      payables.push(data);
    },
    createReceivable: async ({ data }) => {
      receivables.push(data);
    },
    findExistingPayables: async ({ where }) => {
      return payables.filter(
        (p) =>
          p.userId === where.userId &&
          p.description === where.description &&
          new Date(p.dueDate).toISOString().split('T')[0] ===
            new Date(where.dueDate).toISOString().split('T')[0]
      );
    },
    findExistingReceivables: async ({ where }) => {
      return receivables.filter(
        (r) =>
          r.userId === where.userId &&
          r.description === where.description &&
          new Date(r.dueDate).toISOString().split('T')[0] ===
            new Date(where.dueDate).toISOString().split('T')[0]
      );
    },
    ...overrides
  };
}

describe('recurring transactions', () => {
  test('exposes recurring transactions schema in GraphQL typeDefs', () => {
    assert.match(typeDefs, /type RecurringTransaction/);
    assert.match(typeDefs, /enum RecurringType/);
    assert.match(typeDefs, /enum RecurrenceRule/);
    assert.match(typeDefs, /myRecurringTransactions: \[RecurringTransaction!\]!/);
    assert.match(typeDefs, /createRecurringTransaction/);
    assert.match(typeDefs, /processRecurringTransactions: ProcessRecurringResult!/);
  });

  test('computes next occurrences for monthly rule', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const horizon = new Date('2026-04-15T00:00:00.000Z');
    const dates = computeNextOccurrences(start, 'MONTHLY', null, horizon);
    assert.equal(dates.length, 4);
  });

  test('lists recurring transactions for authenticated user', async () => {
    const repo = createRepository();
    const result = await listMyRecurringTransactions(verifiedContext(), repo);
    assert.equal(result.length, 1);
    assert.equal(result[0]?.description, 'Aluguel Escritório');
  });

  test('creates expense recurrence and generates initial AccountPayable', async () => {
    const repo = createRepository();
    const created = await createRecurringTransaction(
      verifiedContext(),
      {
        type: 'EXPENSE',
        categoryId: 'cat-1',
        description: 'Internet Fibra',
        amount: '150.00',
        recurrenceRule: 'MONTHLY',
        startDate: '2026-08-01T00:00:00.000Z'
      },
      repo
    );

    assert.equal(created.description, 'Internet Fibra');
    assert.equal(created.amount, '150.00');
    assert.equal(repo.payables.length, 1);
    assert.equal(repo.payables[0].description, 'Internet Fibra');
    assert.equal(repo.payables[0].amount, '150.00');
    assert.equal(repo.payables[0].status, 'PENDING');
  });

  test('creates income recurrence and generates initial AccountReceivable', async () => {
    const repo = createRepository();
    const created = await createRecurringTransaction(
      verifiedContext(),
      {
        type: 'INCOME',
        categoryId: 'cat-2',
        description: 'Contrato Mensal TI',
        amount: '8000.00',
        recurrenceRule: 'MONTHLY',
        startDate: '2026-08-01T00:00:00.000Z'
      },
      repo
    );

    assert.equal(created.description, 'Contrato Mensal TI');
    assert.equal(repo.receivables.length, 1);
    assert.equal(repo.receivables[0].description, 'Contrato Mensal TI');
    assert.equal(repo.receivables[0].amount, '8000.00');
    assert.equal(repo.receivables[0].status, 'PENDING');
  });

  test('updates recurring transaction', async () => {
    const repo = createRepository();
    const updated = await updateRecurringTransaction(
      verifiedContext(),
      {
        id: 'rec-1',
        description: 'Aluguel Coworking',
        amount: '2800'
      },
      repo
    );

    assert.equal(updated.description, 'Aluguel Coworking');
    assert.equal(updated.amount, '2800.00');
  });

  test('omits undefined fields from partial recurring transaction updates', async () => {
    const repo = createRepository();
    const originalUpdate = repo.update;
    let updateData: Parameters<RecurringTransactionRepository['update']>[0]['data'] | undefined;
    repo.update = async (args) => {
      updateData = args.data;
      return originalUpdate(args);
    };

    await updateRecurringTransaction(
      verifiedContext(),
      {
        id: 'rec-1',
        description: 'Aluguel Coworking'
      },
      repo
    );

    assert.deepEqual(updateData, {
      description: 'Aluguel Coworking'
    });
  });

  test('deletes recurring transaction', async () => {
    const repo = createRepository();
    const success = await deleteRecurringTransaction(verifiedContext(), 'rec-1', repo);
    assert.equal(success, true);
    assert.equal(repo.store.length, 0);
  });

  test('processes recurring occurrences without duplicate entries', async () => {
    const repo = createRepository();
    const result = await processRecurringTransactions(verifiedContext(), repo);
    assert.equal(typeof result.generatedPayables, 'number');
    assert.equal(typeof result.generatedReceivables, 'number');
  });

  test('rejects unauthenticated requests', async () => {
    const repo = createRepository();
    await assert.rejects(
      () =>
        listMyRecurringTransactions(anonymousContext(), repo),
      (err: GraphQLError) => err.extensions?.code === 'UNAUTHENTICATED'
    );
  });

  test('rejects unverified email for recurring operations', async () => {
    const repo = createRepository();
    await assert.rejects(
      () =>
        listMyRecurringTransactions(unverifiedContext(), repo),
      (err: GraphQLError) => err.extensions?.code === 'EMAIL_NOT_VERIFIED'
    );
  });

  test('rejects invalid inputs (negative amount or invalid date range)', async () => {
    const repo = createRepository();
    await assert.rejects(
      () =>
        createRecurringTransaction(
          verifiedContext(),
          {
            type: 'EXPENSE',
            categoryId: 'cat-1',
            description: 'Assinatura',
            amount: '-50',
            recurrenceRule: 'MONTHLY',
            startDate: '2026-08-01'
          },
          repo
        ),
      (err: GraphQLError) => err.extensions?.code === 'INVALID_AMOUNT'
    );

    await assert.rejects(
      () =>
        createRecurringTransaction(
          verifiedContext(),
          {
            type: 'EXPENSE',
            categoryId: 'cat-1',
            description: 'Assinatura',
            amount: '50',
            recurrenceRule: 'MONTHLY',
            startDate: '2026-08-10',
            endDate: '2026-08-01'
          },
          repo
        ),
      (err: GraphQLError) => err.extensions?.code === 'INVALID_DATE_RANGE'
    );
  });
});
