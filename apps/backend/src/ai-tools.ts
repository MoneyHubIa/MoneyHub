import type { AiContextRepository } from './ai-context-builder.js';
import type { LlmToolDefinition } from './ai-llm-adapter.js';

export const FINANCIAL_TOOLS: LlmToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_financial_summary',
      description:
        'Obtém o resumo financeiro (totais de receitas, despesas, saldo líquido e principais categorias) para qualquer intervalo de datas.',
      parameters: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description: 'Data de início no formato YYYY-MM-DD (ex: 2025-01-01)'
          },
          endDate: {
            type: 'string',
            description: 'Data de término no formato YYYY-MM-DD (ex: 2025-12-31)'
          }
        },
        required: ['startDate', 'endDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_category_expenses',
      description:
        'Obtém o detalhamento dos gastos divididos por categoria para um período específico de datas.',
      parameters: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description: 'Data de início no formato YYYY-MM-DD'
          },
          endDate: {
            type: 'string',
            description: 'Data de término no formato YYYY-MM-DD'
          },
          limit: {
            type: 'number',
            description: 'Quantidade máxima de categorias a retornar (padrão: 10)'
          }
        },
        required: ['startDate', 'endDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_upcoming_bills',
      description:
        'Obtém as contas a pagar pendentes e em atraso para os próximos N dias.',
      parameters: {
        type: 'object',
        properties: {
          daysAhead: {
            type: 'number',
            description: 'Quantidade de dias futuros a consultar (padrão: 30)'
          }
        }
      }
    }
  }
];

export type FinancialToolResult = {
  success: boolean;
  tool: string;
  data?: Record<string, unknown> | Array<Record<string, unknown>>;
  error?: string;
};

function parseDateRange(
  startStr?: string,
  endStr?: string
): { startDate: Date; endDate: Date } | null {
  if (!startStr || !endStr) {
    return null;
  }

  const startParsed = Date.parse(
    startStr.includes('T') ? startStr : `${startStr}T00:00:00.000Z`
  );
  const endParsed = Date.parse(
    endStr.includes('T') ? endStr : `${endStr}T23:59:59.999Z`
  );

  if (Number.isNaN(startParsed) || Number.isNaN(endParsed)) {
    return null;
  }

  return {
    startDate: new Date(startParsed),
    endDate: new Date(endParsed)
  };
}

export async function executeFinancialTool(
  toolName: string,
  argsJson: string,
  userId: string,
  contextRepo: AiContextRepository
): Promise<FinancialToolResult> {
  let parsedArgs: Record<string, unknown> = {};
  try {
    parsedArgs = (JSON.parse(argsJson || '{}') as Record<string, unknown>) ?? {};
  } catch {
    return {
      success: false,
      tool: toolName,
      error: 'Parâmetros inválidos enviados para a ferramenta (JSON inválido).'
    };
  }

  const currency = await contextRepo.getUserCurrency(userId);

  switch (toolName) {
    case 'get_financial_summary': {
      const startStr = typeof parsedArgs.startDate === 'string' ? parsedArgs.startDate : undefined;
      const endStr = typeof parsedArgs.endDate === 'string' ? parsedArgs.endDate : undefined;

      const dateRange = parseDateRange(startStr, endStr);
      if (!dateRange) {
        return {
          success: false,
          tool: toolName,
          error:
            'Datas inválidas. Forneça startDate e endDate no formato YYYY-MM-DD (ex: 2025-01-01).'
        };
      }

      const [totals, topCategories] = await Promise.all([
        contextRepo.getTotals(userId, dateRange.startDate, dateRange.endDate),
        contextRepo.getTopExpenseCategories(
          userId,
          dateRange.startDate,
          dateRange.endDate,
          5
        )
      ]);

      const balance = totals.income - totals.expenses;
      const categoryTotal = totals.expenses;

      const formattedCategories = topCategories.map((c) => ({
        category: c.categoryName,
        amount: `${currency} ${c.amount.toFixed(2)}`,
        percentage:
          categoryTotal > 0
            ? Number(((c.amount / categoryTotal) * 100).toFixed(1))
            : 0
      }));

      return {
        success: true,
        tool: toolName,
        data: {
          period: `${startStr} até ${endStr}`,
          currency,
          income: `${currency} ${totals.income.toFixed(2)}`,
          expenses: `${currency} ${totals.expenses.toFixed(2)}`,
          balance: `${currency} ${balance.toFixed(2)}`,
          topCategories: formattedCategories
        }
      };
    }

    case 'get_category_expenses': {
      const startStr = typeof parsedArgs.startDate === 'string' ? parsedArgs.startDate : undefined;
      const endStr = typeof parsedArgs.endDate === 'string' ? parsedArgs.endDate : undefined;
      const limit =
        typeof parsedArgs.limit === 'number' && parsedArgs.limit > 0
          ? Math.min(parsedArgs.limit, 20)
          : 10;

      const dateRange = parseDateRange(startStr, endStr);
      if (!dateRange) {
        return {
          success: false,
          tool: toolName,
          error:
            'Datas inválidas. Forneça startDate e endDate no formato YYYY-MM-DD.'
        };
      }

      const [totals, categories] = await Promise.all([
        contextRepo.getTotals(userId, dateRange.startDate, dateRange.endDate),
        contextRepo.getTopExpenseCategories(
          userId,
          dateRange.startDate,
          dateRange.endDate,
          limit
        )
      ]);

      const categoryTotal = totals.expenses;
      const formatted = categories.map((c) => ({
        category: c.categoryName,
        amount: `${currency} ${c.amount.toFixed(2)}`,
        percentage:
          categoryTotal > 0
            ? Number(((c.amount / categoryTotal) * 100).toFixed(1))
            : 0
      }));

      return {
        success: true,
        tool: toolName,
        data: {
          period: `${startStr} até ${endStr}`,
          currency,
          totalExpenses: `${currency} ${totals.expenses.toFixed(2)}`,
          categories: formatted
        }
      };
    }

    case 'get_upcoming_bills': {
      const daysAhead =
        typeof parsedArgs.daysAhead === 'number' && parsedArgs.daysAhead > 0
          ? Math.min(parsedArgs.daysAhead, 180)
          : 30;

      const now = new Date();
      const fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const toDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

      const bills = await contextRepo.getUpcomingBills(
        userId,
        fromDate,
        toDate,
        15
      );

      const formatted = bills.map((b) => ({
        description: b.description,
        amount: `${currency} ${b.amount.toFixed(2)}`,
        dueDate: b.dueDate.toISOString().split('T')[0] ?? '',
        status: b.status ?? 'PENDING',
        category: b.categoryName ?? 'Sem categoria'
      }));

      return {
        success: true,
        tool: toolName,
        data: {
          daysAhead,
          currency,
          billsCount: formatted.length,
          bills: formatted
        }
      };
    }

    default:
      return {
        success: false,
        tool: toolName,
        error: `Ferramenta desconhecida: "${toolName}".`
      };
  }
}
