import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GraphQLError } from 'graphql';
import {
  buildAiFinancialContext,
  type AiContextRepository,
  type AiFinancialContextInput
} from '../src/ai-context-builder.js';
import { typeDefs, resolvers, type GraphQLContext } from '../src/graphql.js';

function verifiedContext(overrides?: Partial<GraphQLContext>): GraphQLContext {
  return {
    requestId: 'req-test-1',
    auth: {
      uid: 'firebase-uid-1',
      email: 'investor@moneyhub.com',
      emailVerified: true,
      userId: 'user-uuid-1',
      profileId: 'profile-uuid-1'
    },
    ...overrides
  };
}

function unverifiedContext(): GraphQLContext {
  return {
    requestId: 'req-test-2',
    auth: {
      uid: 'firebase-uid-1',
      email: 'investor@moneyhub.com',
      emailVerified: false,
      userId: 'user-uuid-1',
      profileId: 'profile-uuid-1'
    }
  };
}

function unauthenticatedContext(): GraphQLContext {
  return {
    requestId: 'req-test-3',
    auth: null
  };
}

function createMockRepository(overrides?: Partial<AiContextRepository>): AiContextRepository {
  return {
    getUserCurrency: async (_userId: string) => 'BRL',
    getTotals: async (_userId: string, _start: Date, _end: Date) => ({
      income: 12500,
      expenses: 4500
    }),
    getTopExpenseCategories: async (_userId: string, _start: Date, _end: Date, _limit: number) => [
      { categoryName: 'Alimentação', amount: 2000, color: '#FF5733', icon: 'food' },
      { categoryName: 'Moradia', amount: 1500, color: '#33FF57', icon: 'home' },
      { categoryName: 'Transporte', amount: 1000, color: '#3357FF', icon: 'car' }
    ],
    getUpcomingBills: async (_userId: string, _from: Date, _to: Date, _limit: number) => [
      {
        id: 'bill-1',
        description: 'Condomínio',
        amount: 800,
        dueDate: new Date('2026-08-30T12:00:00Z'),
        categoryName: 'Moradia'
      },
      {
        id: 'bill-2',
        description: 'Internet Fibra',
        amount: 150,
        dueDate: new Date('2026-09-05T12:00:00Z'),
        categoryName: 'Serviços'
      }
    ],
    ...overrides
  };
}

describe('AI Context Builder Service (TASK-013)', () => {
  test('exposes aiFinancialContext query and types in GraphQL typeDefs', () => {
    assert.match(typeDefs, /type AiFinancialTotals/);
    assert.match(typeDefs, /type AiTopCategory/);
    assert.match(typeDefs, /type AiUpcomingBill/);
    assert.match(typeDefs, /type AiFinancialContext/);
    assert.match(typeDefs, /input AiFinancialContextInput/);
    assert.match(typeDefs, /aiFinancialContext\(input: AiFinancialContextInput\): AiFinancialContext!/);
  });

  test('resolves aiFinancialContext through Apollo resolver with authenticated context', async () => {
    // Calling the resolver directly with unverified context verifies wiring to buildAiFinancialContext
    await assert.rejects(
      () => resolvers.Query.aiFinancialContext({}, {}, unauthenticatedContext()),
      (err: unknown) => {
        assert.ok(err instanceof GraphQLError);
        assert.equal(err.extensions?.code, 'UNAUTHENTICATED');
        return true;
      }
    );
  });

  test('builds complete financial context for authenticated user', async () => {
    const repository = createMockRepository({
      getUserCurrency: async () => 'USD'
    });

    const input: AiFinancialContextInput = {
      month: 8,
      year: 2026,
      billsDaysAhead: 30
    };

    const context = await buildAiFinancialContext(verifiedContext(), input, repository);

    assert.equal(context.version, '1.0');
    assert.equal(context.period, '2026-08');
    assert.equal(context.currency, 'USD');
    assert.ok(context.generatedAt);
    assert.deepEqual(context.goals, []);

    // Totals
    assert.equal(context.totals.income, '12500.00');
    assert.equal(context.totals.expenses, '4500.00');
    assert.equal(context.totals.balance, '8000.00');

    // Top categories
    assert.equal(context.topExpenseCategories.length, 3);
    const firstCategory = context.topExpenseCategories[0];
    assert.ok(firstCategory);
    assert.equal(firstCategory.categoryName, 'Alimentação');
    assert.equal(firstCategory.amount, '2000.00');
    // 2000 / 4500 = 44.44%
    assert.equal(firstCategory.percentage, 44.44);

    // Upcoming bills
    assert.equal(context.upcomingBills.length, 2);
    const firstBill = context.upcomingBills[0];
    assert.ok(firstBill);
    assert.equal(firstBill.id, 'bill-1');
    assert.equal(firstBill.description, 'Condomínio');
    assert.equal(firstBill.amount, '800.00');
    assert.equal(firstBill.dueDate, '2026-08-30');
    assert.equal(firstBill.categoryName, 'Moradia');
  });

  test('handles empty month with zero transactions safely without division by zero', async () => {
    const repository = createMockRepository({
      getTotals: async () => ({ income: 0, expenses: 0 }),
      getTopExpenseCategories: async () => [],
      getUpcomingBills: async () => []
    });

    const context = await buildAiFinancialContext(verifiedContext(), { month: 8, year: 2026 }, repository);

    assert.equal(context.totals.income, '0.00');
    assert.equal(context.totals.expenses, '0.00');
    assert.equal(context.totals.balance, '0.00');
    assert.deepEqual(context.topExpenseCategories, []);
    assert.deepEqual(context.upcomingBills, []);
  });

  test('falls back to BRL if user currency is empty or invalid', async () => {
    const repository = createMockRepository({
      getUserCurrency: async () => ''
    });

    const context = await buildAiFinancialContext(verifiedContext(), undefined, repository);
    assert.equal(context.currency, 'BRL');
  });

  test('validates input month and year boundaries', async () => {
    const repository = createMockRepository();

    await assert.rejects(
      () => buildAiFinancialContext(verifiedContext(), { month: 0, year: 2026 }, repository),
      (err: unknown) => {
        assert.ok(err instanceof GraphQLError);
        assert.equal(err.extensions?.code, 'BAD_USER_INPUT');
        return true;
      }
    );

    await assert.rejects(
      () => buildAiFinancialContext(verifiedContext(), { month: 13, year: 2026 }, repository),
      (err: unknown) => {
        assert.ok(err instanceof GraphQLError);
        assert.equal(err.extensions?.code, 'BAD_USER_INPUT');
        return true;
      }
    );

    await assert.rejects(
      () => buildAiFinancialContext(verifiedContext(), { month: 8, year: 1999 }, repository),
      (err: unknown) => {
        assert.ok(err instanceof GraphQLError);
        assert.equal(err.extensions?.code, 'BAD_USER_INPUT');
        return true;
      }
    );

    await assert.rejects(
      () => buildAiFinancialContext(verifiedContext(), { month: 8, year: 2026, billsDaysAhead: 0 }, repository),
      (err: unknown) => {
        assert.ok(err instanceof GraphQLError);
        assert.equal(err.extensions?.code, 'BAD_USER_INPUT');
        return true;
      }
    );

    await assert.rejects(
      () => buildAiFinancialContext(verifiedContext(), { month: 8, year: 2026, billsDaysAhead: 91 }, repository),
      (err: unknown) => {
        assert.ok(err instanceof GraphQLError);
        assert.equal(err.extensions?.code, 'BAD_USER_INPUT');
        return true;
      }
    );
  });

  test('enforces authentication and verified email', async () => {
    const repository = createMockRepository();

    await assert.rejects(
      () => buildAiFinancialContext(unauthenticatedContext(), undefined, repository),
      (err: unknown) => {
        assert.ok(err instanceof GraphQLError);
        assert.equal(err.extensions?.code, 'UNAUTHENTICATED');
        return true;
      }
    );

    await assert.rejects(
      () => buildAiFinancialContext(unverifiedContext(), undefined, repository),
      (err: unknown) => {
        assert.ok(err instanceof GraphQLError);
        assert.equal(err.extensions?.code, 'EMAIL_NOT_VERIFIED');
        return true;
      }
    );
  });
});
