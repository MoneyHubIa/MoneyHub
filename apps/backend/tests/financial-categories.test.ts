import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GraphQLError } from 'graphql';
import {
  createCategory,
  deleteCategory,
  listMyCategories,
  updateCategory,
  type FinancialCategory,
  type FinancialCategoryRepository
} from '../src/financial-categories.js';
import { typeDefs } from '../src/graphql.js';

const category: FinancialCategory = {
  id: 'cat-1',
  userId: 'user-1',
  name: 'Alimentação',
  type: 'EXPENSE',
  color: '#FF0000',
  icon: 'utensils',
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

function createRepository(overrides: Partial<FinancialCategoryRepository> = {}): FinancialCategoryRepository {
  return {
    findMany: async () => [category],
    findUnique: async ({ where }) => (where.id === 'cat-1' ? category : null),
    create: async ({ data }) => ({
      id: 'cat-new',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...data
    }),
    update: async ({ where, data }) => ({
      ...category,
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

describe('financial categories', () => {
  test('exposes category query and mutations in GraphQL typeDefs', () => {
    assert.match(typeDefs, /myCategories\(type: CategoryType\): \[FinancialCategory!\]!/);
    assert.match(typeDefs, /createCategory\(input: CreateCategoryInput!\): FinancialCategory!/);
    assert.match(typeDefs, /updateCategory\(input: UpdateCategoryInput!\): FinancialCategory!/);
    assert.match(typeDefs, /deleteCategory\(id: ID!\): Boolean!/);
  });

  test('lists categories for authenticated user with verified email', async () => {
    const result = await listMyCategories(verifiedContext(), undefined, createRepository());
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'Alimentação');
  });

  test('creates category with normalized input', async () => {
    let createdData: unknown = null;
    const repository = createRepository({
      create: async ({ data }) => {
        createdData = data;
        return {
          id: 'cat-2',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          ...data
        };
      }
    });

    const result = await createCategory(
      verifiedContext(),
      { name: '  Mercado  ', type: 'EXPENSE', color: '#00FF00', icon: 'shopping-cart' },
      repository
    );

    assert.equal(result.name, 'Mercado');
    assert.deepEqual(createdData, {
      userId: 'user-1',
      name: 'Mercado',
      type: 'EXPENSE',
      color: '#00FF00',
      icon: 'shopping-cart'
    });
  });

  test('updates category for authenticated owner', async () => {
    let updatedWhere: { id: string } | null = null;
    const repository = createRepository({
      update: async ({ where, data }) => {
        updatedWhere = where;
        return { ...category, ...data };
      }
    });

    const result = await updateCategory(
      verifiedContext(),
      { id: 'cat-1', name: 'Alimentação & Lazer', color: '#0000FF' },
      repository
    );

    assert.equal(updatedWhere?.id, 'cat-1');
    assert.equal(result.name, 'Alimentação & Lazer');
  });

  test('soft-deletes category by setting deletedAt timestamp', async () => {
    let updatedData: unknown = null;
    const repository = createRepository({
      update: async ({ data }) => {
        updatedData = data;
        return { ...category, ...data };
      }
    });

    const success = await deleteCategory(verifiedContext(), 'cat-1', repository);
    assert.equal(success, true);
    assert.ok(updatedData && (updatedData as { deletedAt: Date }).deletedAt instanceof Date);
  });

  test('rejects unauthenticated requests', async () => {
    await assert.rejects(
      listMyCategories({ requestId: 'req-1', auth: null }, undefined, createRepository()),
      (error) => {
        expectCode(error, 'UNAUTHENTICATED');
        return true;
      }
    );
  });

  test('rejects unverified email for category operations', async () => {
    const context = verifiedContext();
    context.auth.emailVerified = false;

    await assert.rejects(
      createCategory(context, { name: 'Teste' }, createRepository()),
      (error) => {
        expectCode(error, 'EMAIL_NOT_VERIFIED');
        return true;
      }
    );
  });

  test('rejects updating category belonging to another user', async () => {
    const repository = createRepository({
      findUnique: async () => ({ ...category, userId: 'other-user' })
    });

    await assert.rejects(
      updateCategory(verifiedContext(), { id: 'cat-1', name: 'Hack' }, repository),
      (error) => {
        expectCode(error, 'NOT_FOUND');
        return true;
      }
    );
  });

  test('rejects invalid category inputs', async () => {
    await assert.rejects(
      createCategory(verifiedContext(), { name: '  ' }, createRepository()),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );
  });
});
