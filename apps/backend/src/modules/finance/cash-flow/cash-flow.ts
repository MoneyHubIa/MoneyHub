import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../../../core/graphql/graphql.js';
import { requireVerifiedUserId } from '../financial-categories/financial-categories.js';
import { getPrismaClient } from '../../../core/database/database.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { accountSelection, aggregateCents } from '../financial-read-model.js';
import { money } from '../banking/rules.js';

export type CashFlowGranularity = 'DAILY' | 'MONTHLY';

export type CashFlowInput = {
  financialAccountIds?: string[];
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
  amount: string | number;
  date: Date;
};

export type CashFlowRepository = {
  getMovementsBetween(args: {
    userId: string; startDate: Date; endDate: Date;
  }): Promise<{ incomes: CashFlowTransactionItem[]; expenses: CashFlowTransactionItem[] }>;
};

const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
] as const;

function padZero(num: number): string {
  return num < 10 ? `0${num}` : String(num);
}
export function cashFlowRepository(financialAccountIds?: string[] | null): CashFlowRepository {
  return {
    async getMovementsBetween({ userId, startDate, endDate }) {
      const selection = accountSelection(financialAccountIds);
      const rows = await getPrismaClient().$queryRaw<Array<{ kind: string; date: string; amount: string }>>(Prisma.sql`
        WITH movements AS (
          SELECT 'INCOME' AS kind, m.occurred_at, m.amount FROM incomes m
          WHERE m.user_id = ${userId}::uuid AND m.deleted_at IS NULL
            AND m.occurred_at >= ${startDate.toISOString()}::timestamptz AND m.occurred_at <= ${endDate.toISOString()}::timestamptz ${selection}
          UNION ALL
          SELECT 'EXPENSE' AS kind, m.occurred_at, m.amount FROM expenses m
          WHERE m.user_id = ${userId}::uuid AND m.deleted_at IS NULL
            AND m.occurred_at >= ${startDate.toISOString()}::timestamptz AND m.occurred_at <= ${endDate.toISOString()}::timestamptz ${selection}
        )
        SELECT kind, (occurred_at AT TIME ZONE 'UTC')::date::text AS date, SUM(amount)::text AS amount
        FROM movements GROUP BY kind, (occurred_at AT TIME ZONE 'UTC')::date
      `);
      const items = (kind: string) => rows.filter(row => row.kind === kind)
        .map(row => ({ amount: row.amount, date: new Date(row.date + 'T00:00:00.000Z') }));
      return { incomes: items('INCOME'), expenses: items('EXPENSE') };
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

    const { incomes, expenses } = await repository.getMovementsBetween({ userId, startDate, endDate });

    const dailyIncomes: Record<number, bigint> = {};
    const dailyExpenses: Record<number, bigint> = {};

    for (const item of incomes) {
      const day = item.date.getUTCDate();
      dailyIncomes[day] = (dailyIncomes[day] ?? 0n) + aggregateCents(item.amount);
    }

    for (const item of expenses) {
      const day = item.date.getUTCDate();
      dailyExpenses[day] = (dailyExpenses[day] ?? 0n) + aggregateCents(item.amount);
    }

    let runningAccumulated = 0n;
    let totalIncomeNum = 0n;
    let totalExpenseNum = 0n;

    const dataPoints: CashFlowDataPoint[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const income = dailyIncomes[day] ?? 0n;
      const expense = dailyExpenses[day] ?? 0n;
      const net = income - expense;
      runningAccumulated += net;
      totalIncomeNum += income;
      totalExpenseNum += expense;

      dataPoints.push({
        label: `${padZero(day)}/${padZero(month)}`,
        date: `${year}-${padZero(month)}-${padZero(day)}`,
        income: money(income),
        expense: money(expense),
        net: money(net),
        accumulatedBalance: money(runningAccumulated)
      });
    }

    return {
      granularity: 'DAILY',
      dataPoints,
      totals: {
        totalIncome: money(totalIncomeNum),
        totalExpense: money(totalExpenseNum),
        netBalance: money(totalIncomeNum - totalExpenseNum)
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

  const { incomes, expenses } = await repository.getMovementsBetween({ userId, startDate, endDate: endMonthDate });

  const monthKeys: Array<{ y: number; m: number; key: string; label: string }> = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const key = `${y}-${padZero(m)}`;
    const label = `${MONTH_NAMES_SHORT[m - 1]}/${String(y).slice(2)}`;
    monthKeys.push({ y, m, key, label });
  }

  const monthlyIncomes: Record<string, bigint> = {};
  const monthlyExpenses: Record<string, bigint> = {};

  for (const item of incomes) {
    const y = item.date.getUTCFullYear();
    const m = item.date.getUTCMonth() + 1;
    const key = `${y}-${padZero(m)}`;
    monthlyIncomes[key] = (monthlyIncomes[key] ?? 0n) + aggregateCents(item.amount);
  }

  for (const item of expenses) {
    const y = item.date.getUTCFullYear();
    const m = item.date.getUTCMonth() + 1;
    const key = `${y}-${padZero(m)}`;
    monthlyExpenses[key] = (monthlyExpenses[key] ?? 0n) + aggregateCents(item.amount);
  }

  let runningAccumulated = 0n;
  let totalIncomeNum = 0n;
  let totalExpenseNum = 0n;

  const dataPoints: CashFlowDataPoint[] = [];

  for (const item of monthKeys) {
    const income = monthlyIncomes[item.key] ?? 0n;
    const expense = monthlyExpenses[item.key] ?? 0n;
    const net = income - expense;
    runningAccumulated += net;
    totalIncomeNum += income;
    totalExpenseNum += expense;

    dataPoints.push({
      label: item.label,
      date: item.key,
      income: money(income),
      expense: money(expense),
      net: money(net),
      accumulatedBalance: money(runningAccumulated)
    });
  }

  return {
    granularity: 'MONTHLY',
    dataPoints,
    totals: {
      totalIncome: money(totalIncomeNum),
      totalExpense: money(totalExpenseNum),
      netBalance: money(totalIncomeNum - totalExpenseNum)
    }
  };
}
