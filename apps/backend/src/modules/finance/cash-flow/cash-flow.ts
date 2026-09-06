import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../../../core/graphql/graphql.js';
import { requireVerifiedUserId } from '../financial-categories/financial-categories.js';
import { getPrismaClient } from '../../../core/database/database.js';

export type CashFlowGranularity = 'DAILY' | 'MONTHLY';

export type CashFlowInput = {
  granularity?: CashFlowGranularity;
  year?: number;
  month?: number;
  monthsCount?: number;
};

export type CashFlowDataPoint = {
  label: string;
  date: string;
  income: string;
  expense: string;
  net: string;
  accumulatedBalance: string;
};

export type CashFlowTotals = {
  totalIncome: string;
  totalExpense: string;
  netBalance: string;
};

export type CashFlowResult = {
  granularity: CashFlowGranularity;
  dataPoints: CashFlowDataPoint[];
  totals: CashFlowTotals;
};

export type CashFlowTransactionItem = {
  amount: number;
  date: Date;
};

export type CashFlowRepository = {
  getIncomesBetween(args: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<CashFlowTransactionItem[]>;
  getExpensesBetween(args: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<CashFlowTransactionItem[]>;
};

const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
] as const;

function padZero(num: number): string {
  return num < 10 ? `0${num}` : String(num);
}

export function cashFlowRepository(): CashFlowRepository {
  const prisma = getPrismaClient();

  return {
    async getIncomesBetween({ userId, startDate, endDate }) {
      const rows = await prisma.income.findMany({
        where: {
          userId,
          deletedAt: null,
          occurredAt: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          amount: true,
          occurredAt: true
        }
      });

      return rows.map((r) => ({
        amount: Number(r.amount),
        date: r.occurredAt
      }));
    },
    async getExpensesBetween({ userId, startDate, endDate }) {
      const rows = await prisma.expense.findMany({
        where: {
          userId,
          deletedAt: null,
          occurredAt: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          amount: true,
          occurredAt: true
        }
      });

      return rows.map((r) => ({
        amount: Number(r.amount),
        date: r.occurredAt
      }));
    }
  };
}

export async function getCashFlow(
  context: GraphQLContext,
  input: CashFlowInput | undefined,
  repository: CashFlowRepository
): Promise<CashFlowResult> {
  const userId = requireVerifiedUserId(context);

  const now = new Date();
  const granularity = input?.granularity ?? 'DAILY';
  const year = input?.year ?? now.getUTCFullYear();
  const month = input?.month ?? (now.getUTCMonth() + 1);
  const monthsCount = input?.monthsCount ?? 6;

  if (month < 1 || month > 12) {
    throw new GraphQLError('Month must be between 1 and 12.', {
      extensions: { code: 'BAD_USER_INPUT' }
    });
  }

  if (year < 2000 || year > 2100) {
    throw new GraphQLError('Year must be between 2000 and 2100.', {
      extensions: { code: 'BAD_USER_INPUT' }
    });
  }

  if (monthsCount < 1 || monthsCount > 24) {
    throw new GraphQLError('monthsCount must be between 1 and 24.', {
      extensions: { code: 'BAD_USER_INPUT' }
    });
  }

  if (granularity === 'DAILY') {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999));

    const [incomes, expenses] = await Promise.all([
      repository.getIncomesBetween({ userId, startDate, endDate }),
      repository.getExpensesBetween({ userId, startDate, endDate })
    ]);

    const dailyIncomes: Record<number, number> = {};
    const dailyExpenses: Record<number, number> = {};

    for (const item of incomes) {
      const day = item.date.getUTCDate();
      dailyIncomes[day] = (dailyIncomes[day] ?? 0) + item.amount;
    }

    for (const item of expenses) {
      const day = item.date.getUTCDate();
      dailyExpenses[day] = (dailyExpenses[day] ?? 0) + item.amount;
    }

    let runningAccumulated = 0;
    let totalIncomeNum = 0;
    let totalExpenseNum = 0;

    const dataPoints: CashFlowDataPoint[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const income = dailyIncomes[day] ?? 0;
      const expense = dailyExpenses[day] ?? 0;
      const net = income - expense;
      runningAccumulated += net;
      totalIncomeNum += income;
      totalExpenseNum += expense;

      dataPoints.push({
        label: `${padZero(day)}/${padZero(month)}`,
        date: `${year}-${padZero(month)}-${padZero(day)}`,
        income: income.toFixed(2),
        expense: expense.toFixed(2),
        net: net.toFixed(2),
        accumulatedBalance: runningAccumulated.toFixed(2)
      });
    }

    return {
      granularity: 'DAILY',
      dataPoints,
      totals: {
        totalIncome: totalIncomeNum.toFixed(2),
        totalExpense: totalExpenseNum.toFixed(2),
        netBalance: (totalIncomeNum - totalExpenseNum).toFixed(2)
      }
    };
  }

  // Monthly Granularity
  const endMonthDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  // Start from (monthsCount - 1) months prior to the target (year, month)
  const startMonthIndex = month - monthsCount;
  const startYear = year + Math.floor(startMonthIndex / 12);
  const startMonth = ((startMonthIndex % 12) + 12) % 12; // 0-11
  const startDate = new Date(Date.UTC(startYear, startMonth, 1, 0, 0, 0, 0));

  const [incomes, expenses] = await Promise.all([
    repository.getIncomesBetween({ userId, startDate, endDate: endMonthDate }),
    repository.getExpensesBetween({ userId, startDate, endDate: endMonthDate })
  ]);

  const monthKeys: Array<{ y: number; m: number; key: string; label: string }> = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const key = `${y}-${padZero(m)}`;
    const label = `${MONTH_NAMES_SHORT[m - 1]}/${String(y).slice(2)}`;
    monthKeys.push({ y, m, key, label });
  }

  const monthlyIncomes: Record<string, number> = {};
  const monthlyExpenses: Record<string, number> = {};

  for (const item of incomes) {
    const y = item.date.getUTCFullYear();
    const m = item.date.getUTCMonth() + 1;
    const key = `${y}-${padZero(m)}`;
    monthlyIncomes[key] = (monthlyIncomes[key] ?? 0) + item.amount;
  }

  for (const item of expenses) {
    const y = item.date.getUTCFullYear();
    const m = item.date.getUTCMonth() + 1;
    const key = `${y}-${padZero(m)}`;
    monthlyExpenses[key] = (monthlyExpenses[key] ?? 0) + item.amount;
  }

  let runningAccumulated = 0;
  let totalIncomeNum = 0;
  let totalExpenseNum = 0;

  const dataPoints: CashFlowDataPoint[] = [];

  for (const item of monthKeys) {
    const income = monthlyIncomes[item.key] ?? 0;
    const expense = monthlyExpenses[item.key] ?? 0;
    const net = income - expense;
    runningAccumulated += net;
    totalIncomeNum += income;
    totalExpenseNum += expense;

    dataPoints.push({
      label: item.label,
      date: item.key,
      income: income.toFixed(2),
      expense: expense.toFixed(2),
      net: net.toFixed(2),
      accumulatedBalance: runningAccumulated.toFixed(2)
    });
  }

  return {
    granularity: 'MONTHLY',
    dataPoints,
    totals: {
      totalIncome: totalIncomeNum.toFixed(2),
      totalExpense: totalExpenseNum.toFixed(2),
      netBalance: (totalIncomeNum - totalExpenseNum).toFixed(2)
    }
  };
}
