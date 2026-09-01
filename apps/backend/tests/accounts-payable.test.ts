import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GraphQLError } from 'graphql';
import {
  createAccountPayable,
  deleteAccountPayable,
  listMyAccountsPayable,
  markAccountPayablePaid,
  updateAccountPayable,
  type AccountPayable,
  type AccountPayableRepository
} from '../src/accounts-payable.js';
import { typeDefs } from '../src/graphql.js';

type ExpenseFromPayableData = Parameters<
  NonNullable<AccountPayableRepository['createExpenseFromPayable']>
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

function createRepository(overrides: Partial<AccountPayableRepository> = {}): AccountPayableRepository {
  const store: AccountPayable[] = [
    {
      id: 'payable-1',
      userId: 'user-1',
      categoryId: 'cat-1',
      costCenterId: null,
      description: 'Conta de Luz',
      amount: '250.00',
      dueDate: new Date('2026-08-30T00:00:00.000Z'),
      status: 'PENDING',
      paidAt: null,
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
      const item: AccountPayable = {
        id: 'payable-new',
        userId: data.userId,
        categoryId: data.categoryId,
        costCenterId: data.costCenterId ?? null,
        description: data.description,
        amount: data.amount,
        dueDate: data.dueDate,
        status: data.status ?? 'PENDING',
        paidAt: data.paidAt ?? null,
        reminderOffsetDays: data.reminderOffsetDays ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      };
      store.push(item);
      return item;
    },
    update: async ({ where, data }): Promise<AccountPayable> => {
      const existing = store.find((i) => i.id === where.id);
      if (!existing) throw new Error('Not found');
      const updated: AccountPayable = {
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

describe('accounts payable', () => {
  test('exposes accounts payable query and mutations in GraphQL typeDefs', () => {
    assert.match(typeDefs, /myAccountsPayable\(status: AccountPayableStatus\): \[AccountPayable!\]!/);
    assert.match(typeDefs, /createAccountPayable\(input: CreateAccountPayableInput!\): AccountPayable!/);
    assert.match(typeDefs, /updateAccountPayable\(input: UpdateAccountPayableInput!\): AccountPayable!/);
    assert.match(typeDefs, /markAccountPayablePaid\(id: ID!, paidAt: String\): AccountPayable!/);
    assert.match(typeDefs, /deleteAccountPayable\(id: ID!\): Boolean!/);
    assert.match(typeDefs, /enum AccountPayableStatus/);
  });

  test('lists accounts payable for authenticated user with optional status filter', async () => {
    const repository = createRepository();
    const all = await listMyAccountsPayable(verifiedContext(), undefined, repository);
    assert.equal(all.length, 1);
    assert.equal(all[0]?.description, 'Conta de Luz');

    const paidOnly = await listMyAccountsPayable(verifiedContext(), 'PAID', repository);
    assert.equal(paidOnly.length, 0);

    const pendingOnly = await listMyAccountsPayable(verifiedContext(), 'PENDING', repository);
    assert.equal(pendingOnly.length, 1);
  });

  test('creates account payable with valid input and default PENDING status', async () => {
    const repository = createRepository();
    const result = await createAccountPayable(
      verifiedContext(),
      {
        categoryId: 'cat-2',
        description: 'Internet',
        amount: '120.50',
        dueDate: '2026-08-25T00:00:00.000Z'
      },
      repository
    );

    assert.equal(result.description, 'Internet');
    assert.equal(result.amount, '120.50');
    assert.equal(result.status, 'PENDING');
    assert.equal(result.paidAt, null);
  });

  test('persists every supported reminder offset when creating and updating an account payable', async () => {
    for (const reminderOffsetDays of [null, 0, 1, 3, 7]) {
      const repository = createRepository();
      const created = await createAccountPayable(
        verifiedContext(),
        {
          categoryId: 'cat-2',
          description: 'Internet',
          amount: '120.50',
          dueDate: '2026-08-25T00:00:00.000Z',
          reminderOffsetDays
        },
        repository
      );
      assert.equal(created.reminderOffsetDays, reminderOffsetDays);

      const updated = await updateAccountPayable(
        verifiedContext(),
        { id: 'payable-1', reminderOffsetDays },
        repository
      );
      assert.equal(updated.reminderOffsetDays, reminderOffsetDays);
    }
  });

  test('creates account payable directly as PAID setting paidAt', async () => {
    const repository = createRepository();
    const result = await createAccountPayable(
      verifiedContext(),
      {
        categoryId: 'cat-2',
        description: 'Aluguel',
        amount: '1500.00',
        dueDate: '2026-08-10T00:00:00.000Z',
        status: 'PAID'
      },
      repository
    );

    assert.equal(result.status, 'PAID');
    assert.ok(result.paidAt instanceof Date);
  });

  test('updates account payable for authenticated owner', async () => {
    const repository = createRepository();
    const result = await updateAccountPayable(
      verifiedContext(),
      {
        id: 'payable-1',
        description: 'Conta de Energia Elétrica',
        amount: '280.00'
      },
      repository
    );

    assert.equal(result.description, 'Conta de Energia Elétrica');
    assert.equal(result.amount, '280.00');
  });

  test('marks account payable as PAID and generates an expense transaction', async () => {
    const generatedExpense: { value: ExpenseFromPayableData | null } = { value: null };
    const repository = createRepository({
      createExpenseFromPayable: async ({ data }) => {
        generatedExpense.value = data;
      }
    });

    const result = await markAccountPayablePaid(
      verifiedContext(),
      { id: 'payable-1' },
      repository
    );

    assert.equal(result.status, 'PAID');
    assert.ok(result.paidAt instanceof Date);
    assert.ok(generatedExpense.value);
    assert.equal(generatedExpense.value.description, '[Pago] Conta de Luz');
    assert.equal(generatedExpense.value.amount, '250.00');
    assert.equal(generatedExpense.value.categoryId, 'cat-1');
  });

  test('soft-deletes account payable by setting deletedAt timestamp', async () => {
    const repository = createRepository();
    const result = await deleteAccountPayable(
      verifiedContext(),
      { id: 'payable-1' },
      repository
    );

    assert.equal(result, true);
    const remaining = await listMyAccountsPayable(verifiedContext(), undefined, repository);
    assert.equal(remaining.length, 0);
  });

  test('rejects unauthenticated requests', async () => {
    const repository = createRepository();
    await assert.rejects(
      listMyAccountsPayable({ requestId: 'req-1', auth: null }, undefined, repository),
      (error) => {
        expectCode(error, 'UNAUTHENTICATED');
        return true;
      }
    );
  });

  test('rejects unverified email for account payable operations', async () => {
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
      createAccountPayable(
        unverifiedContext,
        {
          categoryId: 'cat-1',
          description: 'Água',
          amount: '80.00',
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

  test('rejects updating account payable belonging to another user', async () => {
    const repository = createRepository({
      findUnique: async () => ({
        id: 'payable-2',
        userId: 'other-user',
        categoryId: 'cat-1',
        costCenterId: null,
        description: 'Outra conta',
        amount: '100.00',
        dueDate: new Date(),
        status: 'PENDING',
        paidAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      })
    });

    await assert.rejects(
      updateAccountPayable(verifiedContext(), { id: 'payable-2', description: 'Hack' }, repository),
      (error) => {
        expectCode(error, 'NOT_FOUND');
        return true;
      }
    );
  });

  test('rejects invalid inputs (missing category, negative amount, invalid date)', async () => {
    const repository = createRepository();

    await assert.rejects(
      createAccountPayable(
        verifiedContext(),
        {
          categoryId: '',
          description: 'Teste',
          amount: '50.00',
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
      createAccountPayable(
        verifiedContext(),
        {
          categoryId: 'cat-1',
          description: 'Teste',
          amount: '-10.00',
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
      createAccountPayable(
        verifiedContext(),
        {
          categoryId: 'cat-1',
          description: 'Teste',
          amount: '50.00',
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
