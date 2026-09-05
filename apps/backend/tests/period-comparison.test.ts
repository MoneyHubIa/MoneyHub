import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GraphQLError } from 'graphql';
import {
  getPeriodComparison,
  type PeriodComparisonRepository,
  type RawPeriodMetrics
} from '../src/period-comparison.js';
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

function createRepository(
  baseMetrics: RawPeriodMetrics = { incomeTotal: 0, expenseTotal: 0, incomeCount: 0, expenseCount: 0 },
  comparisonMetrics: RawPeriodMetrics = { incomeTotal: 0, expenseTotal: 0, incomeCount: 0, expenseCount: 0 }
): PeriodComparisonRepository {
  return {
    getPeriodMetrics: async (_userId, month) => {
      // If month matches base or comparison
      return month === 8 ? baseMetrics : comparisonMetrics;
    }
  };
}

function expectCode(error: unknown, code: string) {
  assert.ok(error instanceof GraphQLError);
  assert.equal(error.extensions.code, code);
}

describe('period comparison', () => {
  test('exposes periodComparison query and types in GraphQL typeDefs', () => {
    assert.match(typeDefs, /input PeriodComparisonInput/);
    assert.match(typeDefs, /type PeriodMetrics/);
    assert.match(typeDefs, /type PeriodComparisonDelta/);
    assert.match(typeDefs, /type PeriodComparisonResult/);
    assert.match(typeDefs, /periodComparison\(input: PeriodComparisonInput\): PeriodComparisonResult!/);
  });

  test('computes period comparison metrics and deltas correctly', async () => {
    const repository: PeriodComparisonRepository = {
      getPeriodMetrics: async (_userId, month) => {
        if (month === 8) {
          // Base: Aug 2026
          return {
            incomeTotal: 10000,
            expenseTotal: 6000,
            incomeCount: 2,
            expenseCount: 10
          };
        }
        // Comparison: Jul 2026
        return {
          incomeTotal: 8000,
          expenseTotal: 5000,
          incomeCount: 2,
          expenseCount: 8
        };
      }
    };

    const result = await getPeriodComparison(
      verifiedContext(),
      {
        baseMonth: 8,
        baseYear: 2026,
        comparisonMonth: 7,
        comparisonYear: 2026
      },
      repository
    );

    // Base Period (Aug/2026)
    assert.equal(result.basePeriod.month, 8);
    assert.equal(result.basePeriod.year, 2026);
    assert.equal(result.basePeriod.totalIncome, '10000.00');
    assert.equal(result.basePeriod.totalExpense, '6000.00');
    assert.equal(result.basePeriod.netBalance, '4000.00');
    assert.equal(result.basePeriod.incomeCount, 2);
    assert.equal(result.basePeriod.expenseCount, 10);
    // Savings rate: 4000 / 10000 = 40.0%
    assert.equal(result.basePeriod.savingsRate, 40.0);

    // Comparison Period (Jul/2026)
    assert.equal(result.comparisonPeriod.month, 7);
    assert.equal(result.comparisonPeriod.year, 2026);
    assert.equal(result.comparisonPeriod.totalIncome, '8000.00');
    assert.equal(result.comparisonPeriod.totalExpense, '5000.00');
    assert.equal(result.comparisonPeriod.netBalance, '3000.00');
    // Savings rate: 3000 / 8000 = 37.5%
    assert.equal(result.comparisonPeriod.savingsRate, 37.5);

    // Deltas (Base vs Comparison: 10000 vs 8000 -> +2000, +25%)
    assert.equal(result.delta.incomeDelta, '2000.00');
    assert.equal(result.delta.incomePercentage, 25.0);

    // Expense (6000 vs 5000 -> +1000, +20%)
    assert.equal(result.delta.expenseDelta, '1000.00');
    assert.equal(result.delta.expensePercentage, 20.0);

    // Net Balance (4000 vs 3000 -> +1000, +33.33%)
    assert.equal(result.delta.netBalanceDelta, '1000.00');
    assert.equal(result.delta.netBalancePercentage, 33.33);

    // Savings Rate Delta (40.0 - 37.5 = +2.5 percentage points)
    assert.equal(result.delta.savingsRateDelta, 2.5);
  });

  test('handles zero division safely when comparison period has zero values', async () => {
    const repository: PeriodComparisonRepository = {
      getPeriodMetrics: async (_userId, month) => {
        if (month === 8) {
          return { incomeTotal: 5000, expenseTotal: 2000, incomeCount: 1, expenseCount: 1 };
        }
        return { incomeTotal: 0, expenseTotal: 0, incomeCount: 0, expenseCount: 0 };
      }
    };

    const result = await getPeriodComparison(
      verifiedContext(),
      { baseMonth: 8, baseYear: 2026, comparisonMonth: 7, comparisonYear: 2026 },
      repository
    );

    assert.equal(result.delta.incomeDelta, '5000.00');
    assert.equal(result.delta.incomePercentage, 100.0);
    assert.equal(result.delta.expenseDelta, '2000.00');
    assert.equal(result.delta.expensePercentage, 100.0);
    assert.equal(result.comparisonPeriod.savingsRate, 0);
  });

  test('defaults to current month vs previous month when input is omitted', async () => {
    const repository = createRepository();
    const result = await getPeriodComparison(verifiedContext(), undefined, repository);
    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    assert.equal(result.basePeriod.month, currentMonth);
    assert.equal(result.basePeriod.year, currentYear);
  });

  test('rejects unauthenticated requests', async () => {
    await assert.rejects(
      getPeriodComparison({ requestId: 'req-1', auth: null }, undefined, createRepository()),
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
        getPeriodComparison(unverifiedContext(), undefined, createRepository()),
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

  test('rejects invalid month or year inputs', async () => {
    await assert.rejects(
      getPeriodComparison(verifiedContext(), { baseMonth: 0 }, createRepository()),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );

    await assert.rejects(
      getPeriodComparison(verifiedContext(), { comparisonMonth: 13 }, createRepository()),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );

    await assert.rejects(
      getPeriodComparison(verifiedContext(), { baseYear: 1999 }, createRepository()),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );
  });
});
