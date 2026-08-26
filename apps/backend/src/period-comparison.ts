import { GraphQLError } from 'graphql';
import type { GraphQLContext } from './graphql.js';
import { requireVerifiedUserId } from './financial-categories.js';
import { getPrismaClient } from './database.js';

export type PeriodComparisonInput = {
  baseMonth?: number;
  baseYear?: number;
  comparisonMonth?: number;
  comparisonYear?: number;
};

export type PeriodMetrics = {
  month: number;
  year: number;
  label: string;
  totalIncome: string;
  totalExpense: string;
  netBalance: string;
  savingsRate: number;
  incomeCount: number;
  expenseCount: number;
};

export type PeriodComparisonDelta = {
  incomeDelta: string;
  incomePercentage: number;
  expenseDelta: string;
  expensePercentage: number;
  netBalanceDelta: string;
  netBalancePercentage: number;
  savingsRateDelta: number;
};

export type PeriodComparisonResult = {
  basePeriod: PeriodMetrics;
  comparisonPeriod: PeriodMetrics;
  delta: PeriodComparisonDelta;
};

export type RawPeriodMetrics = {
  incomeTotal: number;
  expenseTotal: number;
  incomeCount: number;
  expenseCount: number;
};

export type PeriodComparisonRepository = {
  getPeriodMetrics(userId: string, month: number, year: number): Promise<RawPeriodMetrics>;
};

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
];

export function periodComparisonRepository(): PeriodComparisonRepository {
  const prisma = getPrismaClient();

  return {
    async getPeriodMetrics(userId, month, year) {
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999));

      const [incomes, expenses] = await Promise.all([
        prisma.income.findMany({
          where: {
            userId,
            deletedAt: null,
            occurredAt: { gte: startDate, lte: endDate }
          },
          select: { amount: true }
        }),
        prisma.expense.findMany({
          where: {
            userId,
            deletedAt: null,
            occurredAt: { gte: startDate, lte: endDate }
          },
          select: { amount: true }
        })
      ]);

      const incomeTotal = incomes.reduce((acc, curr) => acc + Number(curr.amount), 0);
      const expenseTotal = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);

      return {
        incomeTotal,
        expenseTotal,
        incomeCount: incomes.length,
        expenseCount: expenses.length
      };
    }
  };
}

function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100.0 : current < 0 ? -100.0 : 0.0;
  }
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return Number(change.toFixed(2));
}

export async function getPeriodComparison(
  context: GraphQLContext,
  input: PeriodComparisonInput | undefined,
  repository: PeriodComparisonRepository
): Promise<PeriodComparisonResult> {
  const userId = requireVerifiedUserId(context);

  const now = new Date();
  const baseYear = input?.baseYear ?? now.getUTCFullYear();
  const baseMonth = input?.baseMonth ?? (now.getUTCMonth() + 1);

  // Default comparison to previous month
  const prevMonthDate = new Date(Date.UTC(baseYear, baseMonth - 2, 1));
  const comparisonYear = input?.comparisonYear ?? prevMonthDate.getUTCFullYear();
  const comparisonMonth = input?.comparisonMonth ?? (prevMonthDate.getUTCMonth() + 1);

  if (baseMonth < 1 || baseMonth > 12 || comparisonMonth < 1 || comparisonMonth > 12) {
    throw new GraphQLError('Month must be between 1 and 12.', {
      extensions: { code: 'BAD_USER_INPUT' }
    });
  }

  if (baseYear < 2000 || baseYear > 2100 || comparisonYear < 2000 || comparisonYear > 2100) {
    throw new GraphQLError('Year must be between 2000 and 2100.', {
      extensions: { code: 'BAD_USER_INPUT' }
    });
  }

  const [baseRaw, compRaw] = await Promise.all([
    repository.getPeriodMetrics(userId, baseMonth, baseYear),
    repository.getPeriodMetrics(userId, comparisonMonth, comparisonYear)
  ]);

  const baseNet = baseRaw.incomeTotal - baseRaw.expenseTotal;
  const compNet = compRaw.incomeTotal - compRaw.expenseTotal;

  const baseSavingsRate =
    baseRaw.incomeTotal > 0 && baseNet > 0
      ? Number(((baseNet / baseRaw.incomeTotal) * 100).toFixed(2))
      : 0;

  const compSavingsRate =
    compRaw.incomeTotal > 0 && compNet > 0
      ? Number(((compNet / compRaw.incomeTotal) * 100).toFixed(2))
      : 0;

  const basePeriod: PeriodMetrics = {
    month: baseMonth,
    year: baseYear,
    label: `${MONTH_NAMES[baseMonth - 1]}/${baseYear}`,
    totalIncome: baseRaw.incomeTotal.toFixed(2),
    totalExpense: baseRaw.expenseTotal.toFixed(2),
    netBalance: baseNet.toFixed(2),
    savingsRate: baseSavingsRate,
    incomeCount: baseRaw.incomeCount,
    expenseCount: baseRaw.expenseCount
  };

  const comparisonPeriod: PeriodMetrics = {
    month: comparisonMonth,
    year: comparisonYear,
    label: `${MONTH_NAMES[comparisonMonth - 1]}/${comparisonYear}`,
    totalIncome: compRaw.incomeTotal.toFixed(2),
    totalExpense: compRaw.expenseTotal.toFixed(2),
    netBalance: compNet.toFixed(2),
    savingsRate: compSavingsRate,
    incomeCount: compRaw.incomeCount,
    expenseCount: compRaw.expenseCount
  };

  const delta: PeriodComparisonDelta = {
    incomeDelta: (baseRaw.incomeTotal - compRaw.incomeTotal).toFixed(2),
    incomePercentage: calculatePercentageChange(baseRaw.incomeTotal, compRaw.incomeTotal),
    expenseDelta: (baseRaw.expenseTotal - compRaw.expenseTotal).toFixed(2),
    expensePercentage: calculatePercentageChange(baseRaw.expenseTotal, compRaw.expenseTotal),
    netBalanceDelta: (baseNet - compNet).toFixed(2),
    netBalancePercentage: calculatePercentageChange(baseNet, compNet),
    savingsRateDelta: Number((baseSavingsRate - compSavingsRate).toFixed(2))
  };

  return {
    basePeriod,
    comparisonPeriod,
    delta
  };
}
