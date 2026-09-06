import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GraphQLError } from 'graphql';
import {
  createAccountReceivable,
  deleteAccountReceivable,
  listMyAccountsReceivable,
  markAccountReceivableReceived,
  updateAccountReceivable,
  type AccountReceivable,
  type AccountReceivableRepository
} from '../../../../src/modules/finance/accounts-receivable/accounts-receivable.js';
import { typeDefs } from '../../../../src/core/graphql/graphql.js';

type IncomeFromReceivableData = Parameters<
  NonNullable<AccountReceivableRepository['createIncomeFromReceivable']>
>[0]['data'];

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

function createRepository(overrides: Partial<AccountReceivableRepository> = {}): AccountReceivableRepository {
  const store: AccountReceivable[] = [
    {
      id: 'receivable-1',
      userId: 'user-1',
      categoryId: 'cat-1',
      costCenterId: null,
      description: 'Consultoria Financeira',
      amount: '3500.00',
      dueDate: new Date('2026-08-30T00:00:00.000Z'),
      status: 'PENDING',
      receivedAt: null,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
      deletedAt: null
    }
  ];

  return {
    findMany: async ({ where }) => {
      return store.filter(
        (i) =>
          i.userId === where.userId &&
          i.deletedAt === null &&
          (!where.status || i.status === where.status)
      );
    },
    findUnique: async ({ where }) => store.find((i) => i.id === where.id) ?? null,
    create: async ({ data }) => {
      const item: AccountReceivable = {
        id: 'receivable-new',
        userId: data.userId,
        categoryId: data.categoryId,
        costCenterId: data.costCenterId ?? null,
        description: data.description,
        amount: data.amount,
        dueDate: data.dueDate,
        status: data.status ?? 'PENDING',
        receivedAt: data.receivedAt ?? null,
        reminderOffsetDays: data.reminderOffsetDays ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      };
      store.push(item);
      return item;
    },
    update: async ({ where, data }): Promise<AccountReceivable> => {
      const existing = store.find((i) => i.id === where.id);
      if (!existing) throw new Error('Not found');
      const updated: AccountReceivable = {
        ...existing,
        ...data,
        updatedAt: new Date()
      };
      const index = store.findIndex((i) => i.id === where.id);
      store[index] = updated;
      return updated;
    },
    ...overrides
  };
}

function expectCode(error: unknown, code: string) {
  assert.ok(error instanceof GraphQLError);
  assert.equal(error.extensions.code, code);
}

describe('accounts receivable', () => {
  test('exposes accounts receivable query and mutations in GraphQL typeDefs', () => {
    assert.match(typeDefs, /myAccountsReceivable\(status: AccountReceivableStatus\): \[AccountReceivable!\]!/);
    assert.match(typeDefs, /createAccountReceivable\(input: CreateAccountReceivableInput!\): AccountReceivable!/);
    assert.match(typeDefs, /updateAccountReceivable\(input: UpdateAccountReceivableInput!\): AccountReceivable!/);
    assert.match(typeDefs, /markAccountReceivableReceived\(id: ID!, receivedAt: String\): AccountReceivable!/);
    assert.match(typeDefs, /deleteAccountReceivable\(id: ID!\): Boolean!/);
    assert.match(typeDefs, /enum AccountReceivableStatus/);
  });

  test('lists accounts receivable for authenticated user with optional status filter', async () => {
    const repository = createRepository();
    const all = await listMyAccountsReceivable(verifiedContext(), undefined, repository);
    assert.equal(all.length, 1);
    assert.equal(all[0]?.description, 'Consultoria Financeira');

    const receivedOnly = await listMyAccountsReceivable(verifiedContext(), 'RECEIVED', repository);
    assert.equal(receivedOnly.length, 0);

    const pendingOnly = await listMyAccountsReceivable(verifiedContext(), 'PENDING', repository);
    assert.equal(pendingOnly.length, 1);
  });

  test('creates account receivable with valid input and default PENDING status', async () => {
    const repository = createRepository();
    const result = await createAccountReceivable(
      verifiedContext(),
      {
        categoryId: 'cat-2',
        description: 'Venda de Projeto',
        amount: '8000.00',
        dueDate: '2026-08-25T00:00:00.000Z'
      },
      repository
    );

    assert.equal(result.description, 'Venda de Projeto');
    assert.equal(result.amount, '8000.00');
    assert.equal(result.status, 'PENDING');
    assert.equal(result.receivedAt, null);
  });

  test('persists every supported reminder offset when creating and updating an account receivable', async () => {
    for (const reminderOffsetDays of [null, 0, 1, 3, 7]) {
      const repository = createRepository();
      const created = await createAccountReceivable(
        verifiedContext(),
        {
          categoryId: 'cat-2',
          description: 'Venda de Projeto',
          amount: '8000.00',
          dueDate: '2026-08-25T00:00:00.000Z',
          reminderOffsetDays
        },
        repository
      );
      assert.equal(created.reminderOffsetDays, reminderOffsetDays);

      const updated = await updateAccountReceivable(
        verifiedContext(),
        { id: 'receivable-1', reminderOffsetDays },
        repository
      );
      assert.equal(updated.reminderOffsetDays, reminderOffsetDays);
    }
  });

  test('creates account receivable directly as RECEIVED setting receivedAt', async () => {
    const repository = createRepository();
    const result = await createAccountReceivable(
      verifiedContext(),
      {
        categoryId: 'cat-2',
        description: 'Pagamento à Vista',
        amount: '1200.00',
        dueDate: '2026-08-10T00:00:00.000Z',
        status: 'RECEIVED'
      },
      repository
    );

    assert.equal(result.status, 'RECEIVED');
    assert.ok(result.receivedAt instanceof Date);
  });

  test('updates account receivable for authenticated owner', async () => {
    const repository = createRepository();
    const result = await updateAccountReceivable(
      verifiedContext(),
      {
        id: 'receivable-1',
        description: 'Consultoria Financeira Avançada',
        amount: '4000.00'
      },
      repository
    );

    assert.equal(result.description, 'Consultoria Financeira Avançada');
    assert.equal(result.amount, '4000.00');
  });

  test('marks account receivable as RECEIVED and generates an income transaction', async () => {
    const generatedIncome: { value: IncomeFromReceivableData | null } = { value: null };
    const repository = createRepository({
      createIncomeFromReceivable: async ({ data }) => {
        generatedIncome.value = data;
      }
    });

    const result = await markAccountReceivableReceived(
      verifiedContext(),
      { id: 'receivable-1' },
      repository
    );

    assert.equal(result.status, 'RECEIVED');
    assert.ok(result.receivedAt instanceof Date);
    assert.ok(generatedIncome.value);
    assert.equal(generatedIncome.value.description, '[Recebido] Consultoria Financeira');
    assert.equal(generatedIncome.value.amount, '3500.00');
    assert.equal(generatedIncome.value.categoryId, 'cat-1');
  });

  test('soft-deletes account receivable by setting deletedAt timestamp', async () => {
    const repository = createRepository();
    const result = await deleteAccountReceivable(
      verifiedContext(),
      { id: 'receivable-1' },
      repository
    );

    assert.equal(result, true);
    const remaining = await listMyAccountsReceivable(verifiedContext(), undefined, repository);
    assert.equal(remaining.length, 0);
  });

  test('rejects unauthenticated requests', async () => {
    const repository = createRepository();
    await assert.rejects(
      listMyAccountsReceivable({ requestId: 'req-1', auth: null }, undefined, repository),
      (error) => {
        expectCode(error, 'UNAUTHENTICATED');
        return true;
      }
    );
  });

  test('rejects unverified email for account receivable operations', async () => {
    const repository = createRepository();
    const unverifiedContext = {
      requestId: 'request-1',
      auth: {
        uid: 'firebase-user-1',
        email: 'user@example.com',
        emailVerified: false,
        userId: 'user-1',
        profileId: 'profile-1'
      }
    };

    await assert.rejects(
      createAccountReceivable(
        unverifiedContext,
        {
          categoryId: 'cat-1',
          description: 'Dividendos',
          amount: '500.00',
          dueDate: '2026-08-25T00:00:00.000Z'
        },
        repository
      ),
      (error) => {
        expectCode(error, 'EMAIL_NOT_VERIFIED');
        return true;
      }
    );
  });

  test('rejects updating account receivable belonging to another user', async () => {
    const repository = createRepository({
      findUnique: async () => ({
        id: 'receivable-2',
        userId: 'other-user',
        categoryId: 'cat-1',
        costCenterId: null,
        description: 'Outro recebível',
        amount: '1000.00',
        dueDate: new Date(),
        status: 'PENDING',
        receivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      })
    });

    await assert.rejects(
      updateAccountReceivable(verifiedContext(), { id: 'receivable-2', description: 'Hack' }, repository),
      (error) => {
        expectCode(error, 'NOT_FOUND');
        return true;
      }
    );
  });

  test('rejects invalid inputs (missing category, negative amount, invalid date)', async () => {
    const repository = createRepository();

    await assert.rejects(
      createAccountReceivable(
        verifiedContext(),
        {
          categoryId: '',
          description: 'Teste',
          amount: '500.00',
          dueDate: '2026-08-25T00:00:00.000Z'
        },
        repository
      ),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );

    await assert.rejects(
      createAccountReceivable(
        verifiedContext(),
        {
          categoryId: 'cat-1',
          description: 'Teste',
          amount: '-50.00',
          dueDate: '2026-08-25T00:00:00.000Z'
        },
        repository
      ),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );

    await assert.rejects(
      createAccountReceivable(
        verifiedContext(),
        {
          categoryId: 'cat-1',
          description: 'Teste',
          amount: '500.00',
          dueDate: 'data-invalida'
        },
        repository
      ),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );
  });
});
