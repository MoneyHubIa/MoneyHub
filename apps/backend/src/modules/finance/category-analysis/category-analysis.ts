import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../../../core/graphql/graphql.js';
import { requireVerifiedUserId } from '../financial-categories/financial-categories.js';
import { getPrismaClient } from '../../../core/database/database.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { accountSelection, aggregateCents } from '../financial-read-model.js';
import { money } from '../banking/rules.js';

export type CategoryAnalysisType = 'EXPENSE' | 'INCOME';

export type CategoryAnalysisInput = {
  financialAccountIds?: string[];
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
  amount: string | number;
  transactionCount?: number;
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
export function categoryAnalysisRepository(financialAccountIds?: string[] | null): CategoryAnalysisRepository {
  return {
    async getCategoryTransactions({ userId, type, startDate, endDate }) {
      const table = type === 'INCOME' ? Prisma.sql`incomes` : Prisma.sql`expenses`;
      const rows = await getPrismaClient().$queryRaw<Array<{
        categoryId: string; amount: string; transactionCount: number;
        id: string | null; name: string | null; color: string | null; icon: string | null;
      }>>(Prisma.sql`
        SELECT m.category_id AS "categoryId", SUM(m.amount)::text AS amount, COUNT(*)::int AS "transactionCount",
          c.id, c.name, c.color, c.icon
        FROM ${table} m LEFT JOIN financial_categories c ON c.id = m.category_id AND c.user_id = m.user_id
        WHERE m.user_id = ${userId}::uuid AND m.deleted_at IS NULL
          AND m.occurred_at >= ${startDate.toISOString()}::timestamptz AND m.occurred_at <= ${endDate.toISOString()}::timestamptz ${accountSelection(financialAccountIds)}
        GROUP BY m.category_id, c.id, c.name, c.color, c.icon
      `);
      return rows.map(row => ({
        categoryId: row.categoryId, amount: row.amount, transactionCount: row.transactionCount,
        category: row.id ? { id: row.id, name: row.name!, color: row.color!, icon: row.icon! } : null
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
      total: bigint;
      count: number;
    }
  >();

  let grandTotal = 0n;

  for (const item of transactions) {
    const amount = aggregateCents(item.amount);
    grandTotal += amount;
    const catId = item.categoryId;
    const existing = grouped.get(catId);

    if (existing) {
      existing.total += amount;
      existing.count += item.transactionCount ?? 1;
    } else {
      grouped.set(catId, {
        categoryId: catId,
        categoryName: item.category?.name ?? 'Sem categoria',
        categoryColor: item.category?.color ?? '#64748b',
        categoryIcon: item.category?.icon ?? 'folder',
        total: amount,
        count: item.transactionCount ?? 1
      });
    }
  }

  const items: CategoryAnalysisItem[] = Array.from(grouped.values())
    .map((g) => {
      const pct = grandTotal > 0 ? (Number(g.total) / Number(grandTotal)) * 100 : 0;
      return {
        categoryId: g.categoryId,
        categoryName: g.categoryName,
        categoryColor: g.categoryColor,
        categoryIcon: g.categoryIcon,
        totalAmount: money(g.total),
        percentage: Number(pct.toFixed(2)),
        transactionCount: g.count
      };
    })
    .sort((a, b) => {
      const delta = aggregateCents(b.totalAmount) - aggregateCents(a.totalAmount);
      return delta > 0n ? 1 : delta < 0n ? -1 : 0;
    });

  return {
    type,
    month,
    year,
    totalAmount: money(grandTotal),
    items
  };
}
