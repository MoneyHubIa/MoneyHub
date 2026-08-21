import { GraphQLError } from 'graphql';
import type { GraphQLContext } from './graphql.js';
import { requireVerifiedUserId } from './financial-categories.js';

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
  getIncomeSummary(args: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<{ sum: number; count: number }>;
  getExpenseSummary(args: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<{ sum: number; count: number }>;
};

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

  const [incomes, expenses] = await Promise.all([
    repository.getIncomeSummary({ userId, startDate, endDate }),
    repository.getExpenseSummary({ userId, startDate, endDate })
  ]);

  const totalIncomeNum = incomes.sum;
  const totalExpenseNum = expenses.sum;
  const netBalanceNum = totalIncomeNum - totalExpenseNum;

  return {
    totalIncome: totalIncomeNum.toFixed(2),
    totalExpense: totalExpenseNum.toFixed(2),
    netBalance: netBalanceNum.toFixed(2),
    incomeCount: incomes.count,
    expenseCount: expenses.count,
    month,
    year
  };
}
