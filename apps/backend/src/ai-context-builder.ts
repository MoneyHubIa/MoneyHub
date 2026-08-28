import { GraphQLError } from 'graphql';
import type { GraphQLContext } from './graphql.js';
import { requireVerifiedUserId } from './financial-categories.js';
import { getPrismaClient } from './database.js';

export type AiFinancialTotals = {
  income: string;
  expenses: string;
  balance: string;
};

export type AiTopCategory = {
  categoryName: string;
  amount: string;
  percentage: number;
  color?: string | null;
  icon?: string | null;
};

export type AiUpcomingBill = {
  id: string;
  description: string;
  amount: string;
  dueDate: string;
  categoryName?: string | null;
};

export type AiFinancialContext = {
  version: string;
  period: string;
  currency: string;
  generatedAt: string;
  totals: AiFinancialTotals;
  topExpenseCategories: AiTopCategory[];
  upcomingBills: AiUpcomingBill[];
  goals: string[];
};

export type AiFinancialContextInput = {
  month?: number;
  year?: number;
  billsDaysAhead?: number;
};

export type RawTopCategory = {
  categoryName: string;
  amount: number;
  color?: string | null;
  icon?: string | null;
};

export type RawUpcomingBill = {
  id: string;
  description: string;
  amount: number;
  dueDate: Date;
  categoryName?: string | null;
};

export type AiContextRepository = {
  getUserCurrency(userId: string): Promise<string>;
  getTotals(userId: string, startDate: Date, endDate: Date): Promise<{ income: number; expenses: number }>;
  getTopExpenseCategories(
    userId: string,
    startDate: Date,
    endDate: Date,
    limit: number
  ): Promise<RawTopCategory[]>;
  getUpcomingBills(
    userId: string,
    fromDate: Date,
    toDate: Date,
    limit: number
  ): Promise<RawUpcomingBill[]>;
};

export function aiContextRepository(): AiContextRepository {
  const prisma = getPrismaClient();

  return {
    async getUserCurrency(userId: string): Promise<string> {
      const profile = await prisma.profile.findUnique({
        where: { userId },
        select: { preferredCurrency: true }
      });
      return profile?.preferredCurrency ?? 'BRL';
    },

    async getTotals(userId: string, startDate: Date, endDate: Date) {
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

      const income = incomes.reduce((acc, curr) => acc + Number(curr.amount), 0);
      const expenseTotal = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);

      return {
        income,
        expenses: expenseTotal
      };
    },

    async getTopExpenseCategories(
      userId: string,
      startDate: Date,
      endDate: Date,
      limit: number
    ): Promise<RawTopCategory[]> {
      const expenses = await prisma.expense.findMany({
        where: {
          userId,
          deletedAt: null,
          occurredAt: { gte: startDate, lte: endDate }
        },
        include: {
          category: {
            select: {
              name: true,
              color: true,
              icon: true
            }
          }
        }
      });

      const categoryMap = new Map<
        string,
        { categoryName: string; amount: number; color?: string | null; icon?: string | null }
      >();

      for (const exp of expenses) {
        const catName = exp.category.name;
        const current = categoryMap.get(catName);
        const amountNum = Number(exp.amount);

        if (current) {
          current.amount += amountNum;
        } else {
          categoryMap.set(catName, {
            categoryName: catName,
            amount: amountNum,
            color: exp.category.color,
            icon: exp.category.icon
          });
        }
      }

      return Array.from(categoryMap.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, limit);
    },

    async getUpcomingBills(
      userId: string,
      fromDate: Date,
      toDate: Date,
      limit: number
    ): Promise<RawUpcomingBill[]> {
      const bills = await prisma.accountPayable.findMany({
        where: {
          userId,
          deletedAt: null,
          status: 'PENDING',
          dueDate: { gte: fromDate, lte: toDate }
        },
        include: {
          category: {
            select: { name: true }
          }
        },
        orderBy: { dueDate: 'asc' },
        take: limit
      });

      return bills.map((bill) => ({
        id: bill.id,
        description: bill.description,
        amount: Number(bill.amount),
        dueDate: bill.dueDate,
        categoryName: bill.category?.name ?? null
      }));
    }
  };
}

export async function buildAiFinancialContext(
  context: GraphQLContext,
  input: AiFinancialContextInput | undefined,
  repository: AiContextRepository
): Promise<AiFinancialContext> {
  const userId = requireVerifiedUserId(context);

  const now = new Date();
  const year = input?.year ?? now.getUTCFullYear();
  const month = input?.month ?? (now.getUTCMonth() + 1);
  const billsDaysAhead = input?.billsDaysAhead ?? 30;

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

  if (billsDaysAhead < 1 || billsDaysAhead > 90) {
    throw new GraphQLError('billsDaysAhead must be between 1 and 90.', {
      extensions: { code: 'BAD_USER_INPUT' }
    });
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999));

  const fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const toDate = new Date(fromDate.getTime() + billsDaysAhead * 24 * 60 * 60 * 1000 + (23 * 3600 + 59 * 60 + 59) * 1000 + 999);

  const [userCurrency, totals, rawTopCategories, rawUpcomingBills] = await Promise.all([
    repository.getUserCurrency(userId),
    repository.getTotals(userId, startDate, endDate),
    repository.getTopExpenseCategories(userId, startDate, endDate, 5),
    repository.getUpcomingBills(userId, fromDate, toDate, 10)
  ]);

  const currency = userCurrency?.trim() ? userCurrency.trim() : 'BRL';
  const balance = totals.income - totals.expenses;

  const topExpenseCategories: AiTopCategory[] = rawTopCategories.map((cat) => {
    const percentage =
      totals.expenses > 0
        ? Number(((cat.amount / totals.expenses) * 100).toFixed(2))
        : 0;

    return {
      categoryName: cat.categoryName,
      amount: cat.amount.toFixed(2),
      percentage,
      color: cat.color,
      icon: cat.icon
    };
  });

  const upcomingBills: AiUpcomingBill[] = rawUpcomingBills.map((bill) => ({
    id: bill.id,
    description: bill.description,
    amount: bill.amount.toFixed(2),
    dueDate: bill.dueDate.toISOString().slice(0, 10),
    categoryName: bill.categoryName
  }));

  const periodStr = `${year}-${String(month).padStart(2, '0')}`;

  return {
    version: '1.0',
    period: periodStr,
    currency,
    generatedAt: new Date().toISOString(),
    totals: {
      income: totals.income.toFixed(2),
      expenses: totals.expenses.toFixed(2),
      balance: balance.toFixed(2)
    },
    topExpenseCategories,
    upcomingBills,
    goals: []
  };
}
