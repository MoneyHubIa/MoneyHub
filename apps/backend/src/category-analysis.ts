import { GraphQLError } from 'graphql';
import type { GraphQLContext } from './graphql.js';
import { requireVerifiedUserId } from './financial-categories.js';
import { getPrismaClient } from './database.js';

export type CategoryAnalysisType = 'EXPENSE' | 'INCOME';

export type CategoryAnalysisInput = {
  type?: CategoryAnalysisType;
  month?: number;
  year?: number;
};

export type CategoryAnalysisItem = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  totalAmount: string;
  percentage: number;
  transactionCount: number;
};

export type CategoryAnalysisResult = {
  type: CategoryAnalysisType;
  month: number;
  year: number;
  totalAmount: string;
  items: CategoryAnalysisItem[];
};

export type CategoryTransactionRecord = {
  amount: number;
  categoryId: string;
  category: {
    id: string;
    name: string;
    color: string;
    icon: string;
  } | null;
};

export type CategoryAnalysisRepository = {
  getCategoryTransactions(args: {
    userId: string;
    type: CategoryAnalysisType;
    startDate: Date;
    endDate: Date;
  }): Promise<CategoryTransactionRecord[]>;
};

export function categoryAnalysisRepository(): CategoryAnalysisRepository {
  const prisma = getPrismaClient();

  return {
    async getCategoryTransactions({ userId, type, startDate, endDate }) {
      if (type === 'INCOME') {
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
            categoryId: true,
            category: {
              select: {
                id: true,
                name: true,
                color: true,
                icon: true
              }
            }
          }
        });

        return rows.map((r) => ({
          amount: Number(r.amount),
          categoryId: r.categoryId,
          category: r.category
        }));
      }

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
          categoryId: true,
          category: {
            select: {
              id: true,
              name: true,
              color: true,
              icon: true
            }
          }
        }
      });

      return rows.map((r) => ({
        amount: Number(r.amount),
        categoryId: r.categoryId,
        category: r.category
      }));
    }
  };
}

export async function getCategoryAnalysis(
  context: GraphQLContext,
  input: CategoryAnalysisInput | undefined,
  repository: CategoryAnalysisRepository
): Promise<CategoryAnalysisResult> {
  const userId = requireVerifiedUserId(context);

  const now = new Date();
  const type = input?.type ?? 'EXPENSE';
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

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999));

  const transactions = await repository.getCategoryTransactions({
    userId,
    type,
    startDate,
    endDate
  });

  const grouped = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      categoryColor: string;
      categoryIcon: string;
      total: number;
      count: number;
    }
  >();

  let grandTotal = 0;

  for (const item of transactions) {
    grandTotal += item.amount;
    const catId = item.categoryId;
    const existing = grouped.get(catId);

    if (existing) {
      existing.total += item.amount;
      existing.count += 1;
    } else {
      grouped.set(catId, {
        categoryId: catId,
        categoryName: item.category?.name ?? 'Sem categoria',
        categoryColor: item.category?.color ?? '#64748b',
        categoryIcon: item.category?.icon ?? 'folder',
        total: item.amount,
        count: 1
      });
    }
  }

  const items: CategoryAnalysisItem[] = Array.from(grouped.values())
    .map((g) => {
      const pct = grandTotal > 0 ? (g.total / grandTotal) * 100 : 0;
      return {
        categoryId: g.categoryId,
        categoryName: g.categoryName,
        categoryColor: g.categoryColor,
        categoryIcon: g.categoryIcon,
        totalAmount: g.total.toFixed(2),
        percentage: Number(pct.toFixed(2)),
        transactionCount: g.count
      };
    })
    .sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount));

  return {
    type,
    month,
    year,
    totalAmount: grandTotal.toFixed(2),
    items
  };
}
