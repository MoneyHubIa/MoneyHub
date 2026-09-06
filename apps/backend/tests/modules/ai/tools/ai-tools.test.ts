import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FINANCIAL_TOOLS, executeFinancialTool } from '../../../../src/modules/ai/tools/ai-tools.js';
import type { AiContextRepository } from '../../../../src/modules/ai/context-builder/ai-context-builder.js';

function createMockRepository(): AiContextRepository {
  return {
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
