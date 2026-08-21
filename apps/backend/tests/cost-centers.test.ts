import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GraphQLError } from 'graphql';
import {
  createCostCenter,
  deleteCostCenter,
  listMyCostCenters,
  updateCostCenter,
  type CostCenter,
  type CostCenterRepository
} from '../src/cost-centers.js';
import { typeDefs } from '../src/graphql.js';

const costCenter: CostCenter = {
  id: 'cc-1',
  userId: 'user-1',
  name: 'Pessoal',
  description: 'Despesas do dia a dia',
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

function createRepository(overrides: Partial<CostCenterRepository> = {}): CostCenterRepository {
  return {
    findMany: async () => [costCenter],
    findUnique: async ({ where }) => (where.id === 'cc-1' ? costCenter : null),
    create: async ({ data }) => ({
      id: 'cc-new',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      description: data.description ?? null,
      name: data.name,
      userId: data.userId
    }),
    update: async ({ where, data }) => ({
      ...costCenter,
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

describe('cost centers', () => {
  test('exposes cost center queries and mutations in GraphQL typeDefs', () => {
    assert.match(typeDefs, /myCostCenters: \[CostCenter!\]!/);
    assert.match(typeDefs, /createCostCenter\(input: CreateCostCenterInput!\): CostCenter!/);
    assert.match(typeDefs, /updateCostCenter\(input: UpdateCostCenterInput!\): CostCenter!/);
    assert.match(typeDefs, /deleteCostCenter\(id: ID!\): Boolean!/);
  });

  test('lists cost centers for authenticated user', async () => {
    const result = await listMyCostCenters(verifiedContext(), createRepository());
    assert.equal(result.length, 1);
    assert.equal(result[0]?.name, 'Pessoal');
  });

  test('creates cost center with normalized input', async () => {
    let createdData: unknown = null;
    const repository = createRepository({
      create: async ({ data }) => {
        createdData = data;
        return {
          id: 'cc-2',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          description: data.description ?? null,
          name: data.name,
          userId: data.userId
        };
      }
    });

    const result = await createCostCenter(
      verifiedContext(),
      { name: '  Projetos  ', description: '  Projetos freelancers  ' },
      repository
    );

    assert.equal(result.name, 'Projetos');
    assert.deepEqual(createdData, {
      userId: 'user-1',
      name: 'Projetos',
      description: 'Projetos freelancers'
    });
  });

  test('updates cost center for authenticated owner', async () => {
    let updatedWhere: { id: string } | null = null as { id: string } | null;
    const repository = createRepository({
      update: async ({ where, data }) => {
        updatedWhere = where;
        return { ...costCenter, ...data };
      }
    });

    const result = await updateCostCenter(
      verifiedContext(),
      { id: 'cc-1', name: 'Pessoal & Familia' },
      repository
    );

    assert.equal(updatedWhere?.id, 'cc-1');
    assert.equal(result.name, 'Pessoal & Familia');
  });

  test('soft-deletes cost center', async () => {
    let updatedData: unknown = null;
    const repository = createRepository({
      update: async ({ data }) => {
        updatedData = data;
        return { ...costCenter, ...data };
      }
    });

    const success = await deleteCostCenter(verifiedContext(), 'cc-1', repository);
    assert.equal(success, true);
    assert.ok(updatedData && (updatedData as { deletedAt: Date }).deletedAt instanceof Date);
  });

  test('rejects unauthenticated requests', async () => {
    await assert.rejects(
      listMyCostCenters({ requestId: 'req-1', auth: null }, createRepository()),
      (error) => {
        expectCode(error, 'UNAUTHENTICATED');
        return true;
      }
    );
  });

  test('rejects unverified email for cost center operations', async () => {
    const context = verifiedContext();
    context.auth.emailVerified = false;

    await assert.rejects(
      createCostCenter(context, { name: 'Teste' }, createRepository()),
      (error) => {
        expectCode(error, 'EMAIL_NOT_VERIFIED');
        return true;
      }
    );
  });

  test('rejects updating cost center belonging to another user', async () => {
    const repository = createRepository({
      findUnique: async () => ({ ...costCenter, userId: 'other-user' })
    });

    await assert.rejects(
      updateCostCenter(verifiedContext(), { id: 'cc-1', name: 'Hack' }, repository),
      (error) => {
        expectCode(error, 'NOT_FOUND');
        return true;
      }
    );
  });

  test('rejects invalid cost center inputs', async () => {
    await assert.rejects(
      createCostCenter(verifiedContext(), { name: '  ' }, createRepository()),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );
  });
});
