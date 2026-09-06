import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GraphQLError } from 'graphql';
import {
  getCashFlow,
  type CashFlowRepository,
  type CashFlowTransactionItem
} from '../../../../src/modules/finance/cash-flow/cash-flow.js';
import { typeDefs } from '../../../../src/core/graphql/graphql.js';

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

function createRepository(overrides: Partial<CashFlowRepository> = {}): CashFlowRepository {
  return {
    getIncomesBetween: async () => [],
    getExpensesBetween: async () => [],
    ...overrides
  };
}

function expectCode(error: unknown, code: string) {
  assert.ok(error instanceof GraphQLError);
  assert.equal(error.extensions.code, code);
}

describe('cash-flow chart data', () => {
  test('exposes cashFlow query and types in GraphQL typeDefs', () => {
    assert.match(typeDefs, /enum CashFlowGranularity/);
    assert.match(typeDefs, /input CashFlowInput/);
    assert.match(typeDefs, /type CashFlowDataPoint/);
    assert.match(typeDefs, /type CashFlowTotals/);
    assert.match(typeDefs, /type CashFlowResult/);
    assert.match(typeDefs, /cashFlow\(input: CashFlowInput\): CashFlowResult!/);
  });

  test('aggregates daily cash flow for the requested month with zero-fill', async () => {
    const incomes: CashFlowTransactionItem[] = [
      { amount: 1500, date: new Date(Date.UTC(2026, 7, 5, 12, 0, 0)) },
      { amount: 500, date: new Date(Date.UTC(2026, 7, 5, 15, 0, 0)) },
      { amount: 1200, date: new Date(Date.UTC(2026, 7, 20, 10, 0, 0)) }
    ];
    const expenses: CashFlowTransactionItem[] = [
      { amount: 300, date: new Date(Date.UTC(2026, 7, 5, 18, 0, 0)) },
      { amount: 800, date: new Date(Date.UTC(2026, 7, 10, 14, 0, 0)) }
    ];

    const repository = createRepository({
      getIncomesBetween: async () => incomes,
      getExpensesBetween: async () => expenses
    });

    const result = await getCashFlow(
      verifiedContext(),
      { granularity: 'DAILY', month: 8, year: 2026 },
      repository
    );

    assert.equal(result.granularity, 'DAILY');
    // August has 31 days
    assert.equal(result.dataPoints.length, 31);

    // Day 5 (index 4): income 2000, expense 300, net 1700
    const day5 = result.dataPoints[4]!;
    assert.equal(day5.label, '05/08');
    assert.equal(day5.date, '2026-08-05');
    assert.equal(day5.income, '2000.00');
    assert.equal(day5.expense, '300.00');
    assert.equal(day5.net, '1700.00');
    assert.equal(day5.accumulatedBalance, '1700.00');

    // Day 10 (index 9): income 0, expense 800, net -800, accumulated 1700 - 800 = 900
    const day10 = result.dataPoints[9]!;
    assert.equal(day10.label, '10/08');
    assert.equal(day10.date, '2026-08-10');
    assert.equal(day10.income, '0.00');
    assert.equal(day10.expense, '800.00');
    assert.equal(day10.net, '-800.00');
    assert.equal(day10.accumulatedBalance, '900.00');

    // Totals
    assert.equal(result.totals.totalIncome, '3200.00');
    assert.equal(result.totals.totalExpense, '1100.00');
    assert.equal(result.totals.netBalance, '2100.00');
  });

  test('aggregates monthly cash flow across consecutive months in chronological order', async () => {
    const incomes: CashFlowTransactionItem[] = [
      { amount: 4000, date: new Date(Date.UTC(2026, 5, 10)) }, // June
      { amount: 5000, date: new Date(Date.UTC(2026, 6, 15)) }, // July
      { amount: 6000, date: new Date(Date.UTC(2026, 7, 2)) }   // August
    ];
    const expenses: CashFlowTransactionItem[] = [
      { amount: 2000, date: new Date(Date.UTC(2026, 5, 20)) }, // June
      { amount: 3500, date: new Date(Date.UTC(2026, 6, 25)) }, // July
      { amount: 1500, date: new Date(Date.UTC(2026, 7, 10)) }  // August
    ];

    const repository = createRepository({
      getIncomesBetween: async () => incomes,
      getExpensesBetween: async () => expenses
    });

    const result = await getCashFlow(
      verifiedContext(),
      { granularity: 'MONTHLY', month: 8, year: 2026, monthsCount: 6 },
      repository
    );

    assert.equal(result.granularity, 'MONTHLY');
    assert.equal(result.dataPoints.length, 6);

    // Last month (August 2026): index 5
    const aug = result.dataPoints[5]!;
    assert.equal(aug.date, '2026-08');
    assert.equal(aug.income, '6000.00');
    assert.equal(aug.expense, '1500.00');
    assert.equal(aug.net, '4500.00');

    // Totals
    assert.equal(result.totals.totalIncome, '15000.00');
    assert.equal(result.totals.totalExpense, '7000.00');
    assert.equal(result.totals.netBalance, '8000.00');
  });

  test('defaults to DAILY granularity for current month when input is undefined', async () => {
    const repository = createRepository();
    const result = await getCashFlow(verifiedContext(), undefined, repository);
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;
    const daysInMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate();

    assert.equal(result.granularity, 'DAILY');
    assert.equal(result.dataPoints.length, daysInMonth);
    assert.equal(result.totals.totalIncome, '0.00');
    assert.equal(result.totals.totalExpense, '0.00');
    assert.equal(result.totals.netBalance, '0.00');
  });

  test('rejects unauthenticated requests', async () => {
    await assert.rejects(
      getCashFlow({ requestId: 'req-1', auth: null }, undefined, createRepository()),
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
        getCashFlow(unverifiedContext(), undefined, createRepository()),
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
      getCashFlow(verifiedContext(), { month: 13 }, createRepository()),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );

    await assert.rejects(
      getCashFlow(verifiedContext(), { year: 1990 }, createRepository()),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );

    await assert.rejects(
      getCashFlow(verifiedContext(), { monthsCount: 0 }, createRepository()),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );

    await assert.rejects(
      getCashFlow(verifiedContext(), { monthsCount: 25 }, createRepository()),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );
  });
});
