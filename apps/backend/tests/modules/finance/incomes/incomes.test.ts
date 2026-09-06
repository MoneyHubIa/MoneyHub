import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GraphQLError } from 'graphql';
import {
  createIncome,
  deleteIncome,
  listMyIncomes,
  updateIncome,
  type Income,
  type IncomeRepository
} from '../../../../src/modules/finance/incomes/incomes.js';
import { typeDefs } from '../../../../src/core/graphql/graphql.js';

const income: Income = {
  id: 'inc-1',
  userId: 'user-1',
  categoryId: 'cat-1',
  costCenterId: null,
  description: 'Salário Mensal',
  amount: '5000.00',
  occurredAt: new Date('2026-01-05T10:00:00Z'),
  notes: 'Salário referente a Dezembro',
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

function createRepository(overrides: Partial<IncomeRepository> = {}): IncomeRepository {
  return {
    findMany: async () => [income],
    findUnique: async ({ where }) => (where.id === 'inc-1' ? income : null),
    create: async ({ data }) => ({
      id: 'inc-new',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...data
    }),
    update: async ({ where, data }) => ({
      ...income,
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

describe('incomes', () => {
  test('exposes income query and mutations in GraphQL typeDefs', () => {
    assert.match(typeDefs, /myIncomes: \[Income!\]!/);
    assert.match(typeDefs, /createIncome\(input: CreateIncomeInput!\): Income!/);
    assert.match(typeDefs, /updateIncome\(input: UpdateIncomeInput!\): Income!/);
    assert.match(typeDefs, /deleteIncome\(id: ID!\): Boolean!/);
  });

  test('lists incomes for authenticated user', async () => {
    const result = await listMyIncomes(verifiedContext(), createRepository());
    assert.equal(result.length, 1);
    assert.equal(result[0]?.description, 'Salário Mensal');
    assert.equal(result[0]?.amount, '5000.00');
  });

  test('creates income with valid input', async () => {
    let createdData: unknown = null;
    const repository = createRepository({
      create: async ({ data }) => {
        createdData = data;
        return {
          id: 'inc-2',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          ...data
        };
      }
    });

    const result = await createIncome(
      verifiedContext(),
      {
        categoryId: 'cat-1',
        description: '  Freelance Projeto  ',
        amount: '1250.50',
        occurredAt: '2026-01-10T12:00:00Z',
        notes: 'Pagamento 50%'
      },
      repository
    );

    assert.equal(result.description, 'Freelance Projeto');
    assert.deepEqual(createdData, {
      userId: 'user-1',
      categoryId: 'cat-1',
      costCenterId: null,
      description: 'Freelance Projeto',
      amount: '1250.50',
      occurredAt: new Date('2026-01-10T12:00:00Z'),
      notes: 'Pagamento 50%'
    });
  });

  test('updates income for authenticated owner', async () => {
    let updatedWhere: { id: string } | null = null as { id: string } | null;
    const repository = createRepository({
      update: async ({ where, data }) => {
        updatedWhere = where;
        return { ...income, ...data };
      }
    });

    const result = await updateIncome(
      verifiedContext(),
      { id: 'inc-1', description: 'Salário Atualizado', amount: '5500.00' },
      repository
    );

    assert.equal(updatedWhere?.id, 'inc-1');
    assert.equal(result.description, 'Salário Atualizado');
    assert.equal(result.amount, '5500.00');
  });

  test('soft-deletes income by setting deletedAt timestamp', async () => {
    let updatedData: unknown = null;
    const repository = createRepository({
      update: async ({ data }) => {
        updatedData = data;
        return { ...income, ...data };
      }
    });

    const success = await deleteIncome(verifiedContext(), 'inc-1', repository);
    assert.equal(success, true);
    assert.ok(updatedData && (updatedData as { deletedAt: Date }).deletedAt instanceof Date);
  });

  test('rejects unauthenticated requests', async () => {
    await assert.rejects(
      listMyIncomes({ requestId: 'req-1', auth: null }, createRepository()),
      (error) => {
        expectCode(error, 'UNAUTHENTICATED');
        return true;
      }
    );
  });

  test('rejects unverified email for income operations', async () => {
    const context = verifiedContext();
    context.auth.emailVerified = false;

    await assert.rejects(
      createIncome(
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

  test('rejects updating income belonging to another user', async () => {
    const repository = createRepository({
      findUnique: async () => ({ ...income, userId: 'other-user' })
    });

    await assert.rejects(
      updateIncome(verifiedContext(), { id: 'inc-1', description: 'Hack' }, repository),
      (error) => {
        expectCode(error, 'NOT_FOUND');
        return true;
      }
    );
  });

  test('rejects invalid income inputs (negative amount or invalid date)', async () => {
    await assert.rejects(
      createIncome(
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
      createIncome(
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
