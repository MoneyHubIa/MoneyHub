import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GraphQLError } from 'graphql';
import {
  getDashboardSummary,
  type DashboardSummaryRepository
} from '../src/dashboard-summary.js';
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

function createRepository(overrides: Partial<DashboardSummaryRepository> = {}): DashboardSummaryRepository {
  return {
    getIncomeSummary: async () => ({ sum: 5000, count: 2 }),
    getExpenseSummary: async () => ({ sum: 1800, count: 4 }),
    ...overrides
  };
}

function expectCode(error: unknown, code: string) {
  assert.ok(error instanceof GraphQLError);
  assert.equal(error.extensions.code, code);
}

describe('dashboard summary', () => {
  test('exposes dashboardSummary query in GraphQL typeDefs', () => {
    assert.match(typeDefs, /dashboardSummary\(month: Int, year: Int\): DashboardSummary!/);
  });

  test('calculates totals and net balance for authenticated user', async () => {
    const repository = createRepository({
      getIncomeSummary: async () => ({ sum: 7500.5, count: 3 }),
      getExpenseSummary: async () => ({ sum: 2500.25, count: 5 })
    });

    const result = await getDashboardSummary(verifiedContext(), { month: 1, year: 2026 }, repository);

    assert.equal(result.totalIncome, '7500.50');
    assert.equal(result.totalExpense, '2500.25');
    assert.equal(result.netBalance, '5000.25');
    assert.equal(result.incomeCount, 3);
    assert.equal(result.expenseCount, 5);
    assert.equal(result.month, 1);
    assert.equal(result.year, 2026);
  });

  test('defaults to current month and year when omitted', async () => {
    const result = await getDashboardSummary(verifiedContext(), undefined, createRepository());
    const now = new Date();

    assert.equal(result.month, now.getUTCMonth() + 1);
    assert.equal(result.year, now.getUTCFullYear());
    assert.equal(result.totalIncome, '5000.00');
    assert.equal(result.totalExpense, '1800.00');
    assert.equal(result.netBalance, '3200.00');
  });

  test('handles negative net balance when expenses exceed income', async () => {
    const repository = createRepository({
      getIncomeSummary: async () => ({ sum: 1000, count: 1 }),
      getExpenseSummary: async () => ({ sum: 2500, count: 3 })
    });

    const result = await getDashboardSummary(verifiedContext(), { month: 2, year: 2026 }, repository);

    assert.equal(result.totalIncome, '1000.00');
    assert.equal(result.totalExpense, '2500.00');
    assert.equal(result.netBalance, '-1500.00');
  });

  test('rejects unauthenticated requests', async () => {
    await assert.rejects(
      getDashboardSummary({ requestId: 'req-1', auth: null }, undefined, createRepository()),
      (error) => {
        expectCode(error, 'UNAUTHENTICATED');
        return true;
      }
    );
  });

  test('rejects invalid month numbers', async () => {
    await assert.rejects(
      getDashboardSummary(verifiedContext(), { month: 13, year: 2026 }, createRepository()),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );

    await assert.rejects(
      getDashboardSummary(verifiedContext(), { month: 0, year: 2026 }, createRepository()),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );
  });

  test('rejects out of range year numbers', async () => {
    await assert.rejects(
      getDashboardSummary(verifiedContext(), { month: 5, year: 1999 }, createRepository()),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );
  });
});
