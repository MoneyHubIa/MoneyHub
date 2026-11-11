import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../../../core/graphql/graphql.js';
import { requireVerifiedUserId } from '../financial-categories/financial-categories.js';
import { aggregateCents, readPeriodTotals, type FinancialPeriodTotals } from '../financial-read-model.js';
import { money } from '../banking/rules.js';

export type DashboardSummary = {
  totalIncome: string;
  totalExpense: string;
  netBalance: string;
  incomeCount: number;
  expenseCount: number;
  month: number;
  year: number;
};

export type DashboardSummaryInput = {
  month?: number;
  year?: number;
};

export type DashboardSummaryRepository = {
  getSummary(args: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<FinancialPeriodTotals>;
};

export function dashboardSummaryRepository(financialAccountIds?: string[] | null): DashboardSummaryRepository {
  return { getSummary: async ({ userId, startDate, endDate }) => (await readPeriodTotals(userId, [{ startDate, endDate }], financialAccountIds))[0]! };
}

export async function getDashboardSummary(
  context: GraphQLContext,
  input: DashboardSummaryInput | undefined,
  repository: DashboardSummaryRepository
): Promise<DashboardSummary> {
  const userId = requireVerifiedUserId(context);

  const now = new Date();
  const year = input?.year ?? now.getUTCFullYear();
  const month = input?.month ?? (now.getUTCMonth() + 1);

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

  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const totals = await repository.getSummary({ userId, startDate, endDate });
  const totalIncomeNum = aggregateCents(totals.incomeTotal);
  const totalExpenseNum = aggregateCents(totals.expenseTotal);
  const netBalanceNum = totalIncomeNum - totalExpenseNum;

  return {
    totalIncome: money(totalIncomeNum),
    totalExpense: money(totalExpenseNum),
    netBalance: money(netBalanceNum),
    incomeCount: totals.incomeCount,
    expenseCount: totals.expenseCount,
    month,
    year
  };
}
