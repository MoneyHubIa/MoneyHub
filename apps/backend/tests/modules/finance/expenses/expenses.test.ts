import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GraphQLError } from 'graphql';
import {
  createExpense,
  deleteExpense,
  listMyExpenses,
  updateExpense,
  type Expense,
  type ExpenseRepository
} from '../../../../src/modules/finance/expenses/expenses.js';
import { typeDefs } from '../../../../src/core/graphql/graphql.js';

const expense: Expense = {
  id: 'exp-1',
  userId: 'user-1',
  categoryId: 'cat-1',
  costCenterId: null,
  description: 'Aluguel',
  amount: '1800.00',
  occurredAt: new Date('2026-01-05T10:00:00Z'),
  notes: 'Aluguel do apartamento',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null
};

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

function createRepository(overrides: Partial<ExpenseRepository> = {}): ExpenseRepository {
  return {
    findMany: async () => [expense],
    findUnique: async ({ where }) => (where.id === 'exp-1' ? expense : null),
    create: async ({ data }) => ({
      id: 'exp-new',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...data
    }),
    update: async ({ where, data }) => ({
      ...expense,
      ...data,
      id: where.id
    }),
    ...overrides
  };
}

function expectCode(error: unknown, code: string) {
  assert.ok(error instanceof GraphQLError);
  assert.equal(error.extensions.code, code);
}

describe('expenses', () => {
  test('exposes expense query and mutations in GraphQL typeDefs', () => {
    assert.match(typeDefs, /myExpenses: \[Expense!\]!/);
    assert.match(typeDefs, /createExpense\(input: CreateExpenseInput!\): Expense!/);
    assert.match(typeDefs, /updateExpense\(input: UpdateExpenseInput!\): Expense!/);
    assert.match(typeDefs, /deleteExpense\(id: ID!\): Boolean!/);
  });

  test('lists expenses for authenticated user', async () => {
    const result = await listMyExpenses(verifiedContext(), createRepository());
    assert.equal(result.length, 1);
    assert.equal(result[0]?.description, 'Aluguel');
    assert.equal(result[0]?.amount, '1800.00');
  });

  test('creates expense with valid input', async () => {
    let createdData: unknown = null;
    const repository = createRepository({
      create: async ({ data }) => {
        createdData = data;
        return {
          id: 'exp-2',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          ...data
        };
      }
    });

    const result = await createExpense(
      verifiedContext(),
      {
        categoryId: 'cat-1',
        description: '  Supermercado Semanal  ',
        amount: '450.25',
        occurredAt: '2026-01-08T15:30:00Z',
        notes: 'Compras do mês'
      },
      repository
    );

    assert.equal(result.description, 'Supermercado Semanal');
    assert.deepEqual(createdData, {
      userId: 'user-1',
      categoryId: 'cat-1',
      costCenterId: null,
      description: 'Supermercado Semanal',
      amount: '450.25',
      occurredAt: new Date('2026-01-08T15:30:00Z'),
      notes: 'Compras do mês'
    });
  });

  test('updates expense for authenticated owner', async () => {
    let updatedWhere: { id: string } | null = null as { id: string } | null;
    const repository = createRepository({
      update: async ({ where, data }) => {
        updatedWhere = where;
        return { ...expense, ...data };
      }
    });

    const result = await updateExpense(
      verifiedContext(),
      { id: 'exp-1', description: 'Aluguel Reajustado', amount: '1900.00' },
      repository
    );

    assert.equal(updatedWhere?.id, 'exp-1');
    assert.equal(result.description, 'Aluguel Reajustado');
    assert.equal(result.amount, '1900.00');
  });

  test('soft-deletes expense by setting deletedAt timestamp', async () => {
    let updatedData: unknown = null;
    const repository = createRepository({
      update: async ({ data }) => {
        updatedData = data;
        return { ...expense, ...data };
      }
    });

    const success = await deleteExpense(verifiedContext(), 'exp-1', repository);
    assert.equal(success, true);
    assert.ok(updatedData && (updatedData as { deletedAt: Date }).deletedAt instanceof Date);
  });

  test('rejects unauthenticated requests', async () => {
    await assert.rejects(
      listMyExpenses({ requestId: 'req-1', auth: null }, createRepository()),
      (error) => {
        expectCode(error, 'UNAUTHENTICATED');
        return true;
      }
    );
  });

  test('rejects unverified email for expense operations', async () => {
    const context = verifiedContext();
    context.auth.emailVerified = false;

    await assert.rejects(
      createExpense(
        context,
        {
          categoryId: 'cat-1',
          description: 'Teste',
          amount: '100',
          occurredAt: '2026-01-01'
        },
        createRepository()
      ),
      (error) => {
        expectCode(error, 'EMAIL_NOT_VERIFIED');
        return true;
      }
    );
  });

  test('rejects updating expense belonging to another user', async () => {
    const repository = createRepository({
      findUnique: async () => ({ ...expense, userId: 'other-user' })
    });

    await assert.rejects(
      updateExpense(verifiedContext(), { id: 'exp-1', description: 'Hack' }, repository),
      (error) => {
        expectCode(error, 'NOT_FOUND');
        return true;
      }
    );
  });

  test('rejects invalid expense inputs (negative amount or invalid date)', async () => {
    await assert.rejects(
      createExpense(
        verifiedContext(),
        {
          categoryId: 'cat-1',
          description: 'Teste',
          amount: '-50',
          occurredAt: '2026-01-01'
        },
        createRepository()
      ),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );

    await assert.rejects(
      createExpense(
        verifiedContext(),
        {
          categoryId: 'cat-1',
          description: 'Teste',
          amount: '50',
          occurredAt: 'data-invalida'
        },
        createRepository()
      ),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );
  });
});
