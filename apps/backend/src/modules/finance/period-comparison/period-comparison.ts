import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../../../core/graphql/graphql.js';
import { requireVerifiedUserId } from '../financial-categories/financial-categories.js';
import { aggregateCents, readPeriodTotals } from '../financial-read-model.js';
import { money } from '../banking/rules.js';

export type PeriodComparisonInput = {
  financialAccountIds?: string[];
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
  incomeTotal: string | number;
  expenseTotal: string | number;
  incomeCount: number;
  expenseCount: number;
};

export type PeriodComparisonRepository = {
  getPeriodsMetrics(userId: string, periods: Array<{ month: number; year: number }>): Promise<RawPeriodMetrics[]>;
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
export function periodComparisonRepository(financialAccountIds?: string[] | null): PeriodComparisonRepository {
  return {
    getPeriodsMetrics: (userId, periods) => readPeriodTotals(userId, periods.map(({ month, year }) => ({
      startDate: new Date(Date.UTC(year, month - 1, 1)),
      endDate: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
    })), financialAccountIds)
  };
}

function calculatePercentageChange(current: bigint, previous: bigint): number {
  if (previous === 0n) {
    return current > 0 ? 100.0 : current < 0 ? -100.0 : 0.0;
  }
  const change = (Number(current - previous) / Math.abs(Number(previous))) * 100;
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

  const [baseRaw, compRaw] = await repository.getPeriodsMetrics(userId, [
    { month: baseMonth, year: baseYear }, { month: comparisonMonth, year: comparisonYear }
  ]);
  if (!baseRaw || !compRaw) throw new Error('Missing period aggregate.');
  const baseIncome = aggregateCents(baseRaw.incomeTotal);
  const baseExpense = aggregateCents(baseRaw.expenseTotal);
  const compIncome = aggregateCents(compRaw.incomeTotal);
  const compExpense = aggregateCents(compRaw.expenseTotal);

  const baseNet = baseIncome - baseExpense;
  const compNet = compIncome - compExpense;

  const baseSavingsRate =
    baseIncome > 0 && baseNet > 0
      ? Number(((Number(baseNet) / Number(baseIncome)) * 100).toFixed(2))
      : 0;

  const compSavingsRate =
    compIncome > 0 && compNet > 0
      ? Number(((Number(compNet) / Number(compIncome)) * 100).toFixed(2))
      : 0;

  const basePeriod: PeriodMetrics = {
    month: baseMonth,
    year: baseYear,
    label: `${MONTH_NAMES[baseMonth - 1]}/${baseYear}`,
    totalIncome: money(baseIncome),
    totalExpense: money(baseExpense),
    netBalance: money(baseNet),
    savingsRate: baseSavingsRate,
    incomeCount: baseRaw.incomeCount,
    expenseCount: baseRaw.expenseCount
  };

  const comparisonPeriod: PeriodMetrics = {
    month: comparisonMonth,
    year: comparisonYear,
    label: `${MONTH_NAMES[comparisonMonth - 1]}/${comparisonYear}`,
    totalIncome: money(compIncome),
    totalExpense: money(compExpense),
    netBalance: money(compNet),
    savingsRate: compSavingsRate,
    incomeCount: compRaw.incomeCount,
    expenseCount: compRaw.expenseCount
  };

  const delta: PeriodComparisonDelta = {
    incomeDelta: money(baseIncome - compIncome),
    incomePercentage: calculatePercentageChange(baseIncome, compIncome),
    expenseDelta: money(baseExpense - compExpense),
    expensePercentage: calculatePercentageChange(baseExpense, compExpense),
    netBalanceDelta: money(baseNet - compNet),
    netBalancePercentage: calculatePercentageChange(baseNet, compNet),
    savingsRateDelta: Number((baseSavingsRate - compSavingsRate).toFixed(2))
  };

  return {
    basePeriod,
    comparisonPeriod,
    delta
  };
}
