import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GraphQLError } from 'graphql';
import {
  getCategoryAnalysis,
  type CategoryAnalysisRepository,
  type CategoryTransactionRecord
} from '../src/category-analysis.js';
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
    requestId: 'request-1',
    auth: {
      uid: 'firebase-user-1',
      email: 'user@example.com',
      emailVerified: false,
      userId: 'user-1',
      profileId: 'profile-1'
    }
  };
}

function createRepository(overrides: Partial<CategoryAnalysisRepository> = {}): CategoryAnalysisRepository {
  return {
    getCategoryTransactions: async () => [],
    ...overrides
  };
}

function expectCode(error: unknown, code: string) {
  assert.ok(error instanceof GraphQLError);
  assert.equal(error.extensions.code, code);
}

describe('category analysis', () => {
  test('exposes categoryAnalysis query and types in GraphQL typeDefs', () => {
    assert.match(typeDefs, /enum CategoryAnalysisType/);
    assert.match(typeDefs, /input CategoryAnalysisInput/);
    assert.match(typeDefs, /type CategoryAnalysisItem/);
    assert.match(typeDefs, /type CategoryAnalysisResult/);
    assert.match(typeDefs, /categoryAnalysis\(input: CategoryAnalysisInput\): CategoryAnalysisResult!/);
  });

  test('aggregates expense transactions grouped by category sorted descending by total amount', async () => {
    const transactions: CategoryTransactionRecord[] = [
      {
        amount: 1500,
        categoryId: 'cat-1',
        category: { id: 'cat-1', name: 'Moradia', color: '#3b82f6', icon: 'home' }
      },
      {
        amount: 500,
        categoryId: 'cat-1',
        category: { id: 'cat-1', name: 'Moradia', color: '#3b82f6', icon: 'home' }
      },
      {
        amount: 800,
        categoryId: 'cat-2',
        category: { id: 'cat-2', name: 'Alimentação', color: '#10b981', icon: 'utensils' }
      },
      {
        amount: 200,
        categoryId: 'cat-3',
        category: { id: 'cat-3', name: 'Transporte', color: '#f59e0b', icon: 'car' }
      }
    ];

    const repository = createRepository({
      getCategoryTransactions: async () => transactions
    });

    const result = await getCategoryAnalysis(
      verifiedContext(),
      { type: 'EXPENSE', month: 8, year: 2026 },
      repository
    );

    assert.equal(result.type, 'EXPENSE');
    assert.equal(result.month, 8);
    assert.equal(result.year, 2026);
    assert.equal(result.totalAmount, '3000.00');
    assert.equal(result.items.length, 3);

    // Rank 1: Moradia (2000 / 3000 = 66.67%)
    const item1 = result.items[0]!;
    assert.equal(item1.categoryId, 'cat-1');
    assert.equal(item1.categoryName, 'Moradia');
    assert.equal(item1.categoryColor, '#3b82f6');
    assert.equal(item1.categoryIcon, 'home');
    assert.equal(item1.totalAmount, '2000.00');
    assert.equal(item1.transactionCount, 2);
    assert.equal(item1.percentage, 66.67);

    // Rank 2: Alimentação (800 / 3000 = 26.67%)
    const item2 = result.items[1]!;
    assert.equal(item2.categoryId, 'cat-2');
    assert.equal(item2.categoryName, 'Alimentação');
    assert.equal(item2.totalAmount, '800.00');
    assert.equal(item2.transactionCount, 1);
    assert.equal(item2.percentage, 26.67);

    // Rank 3: Transporte (200 / 3000 = 6.67%)
    const item3 = result.items[2]!;
    assert.equal(item3.categoryId, 'cat-3');
    assert.equal(item3.categoryName, 'Transporte');
    assert.equal(item3.totalAmount, '200.00');
    assert.equal(item3.transactionCount, 1);
    assert.equal(item3.percentage, 6.67);
  });

  test('aggregates income transactions grouped by category', async () => {
    const transactions: CategoryTransactionRecord[] = [
      {
        amount: 7000,
        categoryId: 'cat-salario',
        category: { id: 'cat-salario', name: 'Salário', color: '#059669', icon: 'wallet' }
      },
      {
        amount: 3000,
        categoryId: 'cat-freela',
        category: { id: 'cat-freela', name: 'Freelance', color: '#0284c7', icon: 'laptop' }
      }
    ];

    const repository = createRepository({
      getCategoryTransactions: async () => transactions
    });

    const result = await getCategoryAnalysis(
      verifiedContext(),
      { type: 'INCOME', month: 8, year: 2026 },
      repository
    );

    assert.equal(result.type, 'INCOME');
    assert.equal(result.totalAmount, '10000.00');
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0]?.categoryName, 'Salário');
    assert.equal(result.items[0]?.percentage, 70.0);
    assert.equal(result.items[1]?.categoryName, 'Freelance');
    assert.equal(result.items[1]?.percentage, 30.0);
  });

  test('returns empty items array and zero total when no transactions exist in the month', async () => {
    const repository = createRepository({
      getCategoryTransactions: async () => []
    });

    const result = await getCategoryAnalysis(
      verifiedContext(),
      { type: 'EXPENSE', month: 2, year: 2026 },
      repository
    );

    assert.equal(result.totalAmount, '0.00');
    assert.deepEqual(result.items, []);
  });

  test('defaults to EXPENSE type and current month/year when input is omitted', async () => {
    const repository = createRepository();
    const result = await getCategoryAnalysis(verifiedContext(), undefined, repository);
    const now = new Date();

    assert.equal(result.type, 'EXPENSE');
    assert.equal(result.month, now.getUTCMonth() + 1);
    assert.equal(result.year, now.getUTCFullYear());
    assert.equal(result.totalAmount, '0.00');
  });

  test('rejects unauthenticated requests', async () => {
    await assert.rejects(
      getCategoryAnalysis({ requestId: 'req-1', auth: null }, undefined, createRepository()),
      (error) => {
        expectCode(error, 'UNAUTHENTICATED');
        return true;
      }
    );
  });

  test('rejects unverified email accounts when ALLOW_UNVERIFIED_EMAIL is false', async () => {
    const originalEnv = process.env.ALLOW_UNVERIFIED_EMAIL;
    try {
      delete process.env.ALLOW_UNVERIFIED_EMAIL;
      await assert.rejects(
        getCategoryAnalysis(unverifiedContext(), undefined, createRepository()),
        (error) => {
          expectCode(error, 'EMAIL_NOT_VERIFIED');
          return true;
        }
      );
    } finally {
      if (originalEnv) {
        process.env.ALLOW_UNVERIFIED_EMAIL = originalEnv;
      }
    }
  });

  test('rejects invalid inputs', async () => {
    await assert.rejects(
      getCategoryAnalysis(verifiedContext(), { month: 0 }, createRepository()),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );

    await assert.rejects(
      getCategoryAnalysis(verifiedContext(), { month: 13 }, createRepository()),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );

    await assert.rejects(
      getCategoryAnalysis(verifiedContext(), { year: 1999 }, createRepository()),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );
  });
});
