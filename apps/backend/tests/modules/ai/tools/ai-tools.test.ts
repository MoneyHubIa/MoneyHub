import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FINANCIAL_TOOLS, executeFinancialTool } from '../../../../src/modules/ai/tools/ai-tools.js';
import type { AiContextRepository } from '../../../../src/modules/ai/context-builder/ai-context-builder.js';

function createMockRepository(): AiContextRepository {
  return {
    getGoals: async () => [],
    async getUserCurrency() {
      return 'BRL';
    },
    async getTotals() {
      return {
        income: 50000,
        expenses: 32000
      };
    },
    async getTopExpenseCategories() {
      return [
        { categoryName: 'Moradia', amount: 18000, color: '#3b82f6', icon: 'home' },
        { categoryName: 'Alimentação', amount: 8000, color: '#10b981', icon: 'utensils' }
      ];
    },
    async getUpcomingBills() {
      return [
        {
          id: 'bill-1',
          description: 'Aluguel Anual',
          amount: 2500,
          dueDate: new Date('2026-10-15T00:00:00.000Z'),
          status: 'PENDING',
          categoryName: 'Moradia'
        }
      ];
    }
  };
}

describe('AI Financial Tools', () => {
  test('defines valid tool schemas', () => {
    assert.ok(Array.isArray(FINANCIAL_TOOLS));
    assert.equal(FINANCIAL_TOOLS.length, 3);

    const names = FINANCIAL_TOOLS.map((t) => t.function.name);
    assert.ok(names.includes('get_financial_summary'));
    assert.ok(names.includes('get_category_expenses'));
    assert.ok(names.includes('get_upcoming_bills'));
  });

  test('executes get_financial_summary with valid date range', async () => {
    const repo = createMockRepository();
    const result = await executeFinancialTool(
      'get_financial_summary',
      JSON.stringify({ startDate: '2025-01-01', endDate: '2025-12-31' }),
      'user-123',
      repo
    );

    assert.equal(result.success, true);
    assert.equal(result.tool, 'get_financial_summary');
    const data = result.data as Record<string, unknown>;
    assert.equal(data.period, '2025-01-01 até 2025-12-31');
    assert.equal(data.income, 'BRL 50000.00');
    assert.equal(data.expenses, 'BRL 32000.00');
    assert.equal(data.balance, 'BRL 18000.00');
    assert.ok(Array.isArray(data.topCategories));
  });

  test('handles invalid dates in get_financial_summary', async () => {
    const repo = createMockRepository();
    const result = await executeFinancialTool(
      'get_financial_summary',
      JSON.stringify({ startDate: 'invalid-date', endDate: 'also-invalid' }),
      'user-123',
      repo
    );

    assert.equal(result.success, false);
    assert.ok(result.error?.includes('Datas inválidas'));
  });

  test('handles malformed JSON arguments', async () => {
    const repo = createMockRepository();
    const result = await executeFinancialTool(
      'get_financial_summary',
      '{ invalid_json: ',
      'user-123',
      repo
    );

    assert.equal(result.success, false);
    assert.ok(result.error?.includes('Parâmetros inválidos'));
  });

  test('executes get_category_expenses with valid parameters', async () => {
    const repo = createMockRepository();
    const result = await executeFinancialTool(
      'get_category_expenses',
      JSON.stringify({ startDate: '2026-06-01', endDate: '2026-08-31', limit: 5 }),
      'user-123',
      repo
    );

    assert.equal(result.success, true);
    assert.equal(result.tool, 'get_category_expenses');
    const data = result.data as Record<string, unknown>;
    assert.equal(data.totalExpenses, 'BRL 32000.00');
    assert.ok(Array.isArray(data.categories));
  });

  test('executes get_upcoming_bills with custom daysAhead', async () => {
    const repo = createMockRepository();
    const result = await executeFinancialTool(
      'get_upcoming_bills',
      JSON.stringify({ daysAhead: 60 }),
      'user-123',
      repo
    );

    assert.equal(result.success, true);
    assert.equal(result.tool, 'get_upcoming_bills');
    const data = result.data as Record<string, unknown>;
    assert.equal(data.daysAhead, 60);
    assert.equal(data.billsCount, 1);
  });

  test('uses zero percentages when a period has no expenses', async () => {
    const repo = createMockRepository();
    repo.getTotals = async () => ({ income: 0, expenses: 0 });
    const result = await executeFinancialTool(
      'get_financial_summary',
      JSON.stringify({ startDate: '2026-09-01', endDate: '2026-09-30' }),
      'user-123',
      repo
    );

    assert.equal(result.success, true);
    const data = result.data as Record<string, unknown>;
    const categories = data.topCategories as Array<Record<string, unknown>>;
    assert.equal(categories[0]?.percentage, 0);
  });

  test('caps category limit and rejects a missing date range', async () => {
    const repo = createMockRepository();
    let receivedLimit = 0;
    repo.getTopExpenseCategories = async (
      _userId,
      _startDate,
      _endDate,
      limit
    ) => {
      receivedLimit = limit;
      return [];
    };

    const capped = await executeFinancialTool(
      'get_category_expenses',
      JSON.stringify({
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        limit: 100
      }),
      'user-123',
      repo
    );
    const missingDate = await executeFinancialTool(
      'get_category_expenses',
      JSON.stringify({ limit: 5 }),
      'user-123',
      repo
    );

    assert.equal(capped.success, true);
    assert.equal(receivedLimit, 20);
    assert.equal(missingDate.success, false);
    assert.match(missingDate.error ?? '', /Datas inv/);
  });

  test('uses upcoming bill defaults for omitted input and nullable fields', async () => {
    const repo = createMockRepository();
    repo.getUpcomingBills = async () => [{
      id: 'bill-with-defaults',
      description: 'Conta sem categoria',
      amount: 10,
      dueDate: new Date('2026-09-20T00:00:00.000Z'),
      status: null,
      categoryName: null
    }];

    const result = await executeFinancialTool(
      'get_upcoming_bills',
      '',
      'user-123',
      repo
    );

    assert.equal(result.success, true);
    const data = result.data as Record<string, unknown>;
    assert.equal(data.daysAhead, 30);
    const bills = data.bills as Array<Record<string, unknown>>;
    assert.equal(bills[0]?.status, 'PENDING');
    assert.equal(bills[0]?.category, 'Sem categoria');
  });

  test('rejects unknown tool name gracefully', async () => {
    const repo = createMockRepository();
    const result = await executeFinancialTool(
      'unknown_tool_name',
      '{}',
      'user-123',
      repo
    );

    assert.equal(result.success, false);
    assert.ok(result.error?.includes('Ferramenta desconhecida'));
  });
});
