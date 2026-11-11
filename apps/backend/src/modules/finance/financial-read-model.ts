import { Prisma } from '../../generated/prisma/client.js';
import { getPrismaClient } from '../../core/database/database.js';

/** Monetary aggregates stay decimal in PostgreSQL and integer cents in application code. */
export function aggregateCents(value: string | number): bigint {
  const text = typeof value === 'number' ? value.toFixed(2) : value;
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) throw new Error('Invalid monetary aggregate.');
  const [whole = '0', fraction = ''] = text.replace('-', '').split('.');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return text.startsWith('-') ? -result : result;
}

/** The movement table must use alias m. An explicit empty selection matches no accounts. */
export function accountSelection(ids?: string[] | null): Prisma.Sql {
  if (ids == null) return Prisma.empty;
  if (ids.length === 0) return Prisma.sql`AND FALSE`;
  return Prisma.sql`AND m.financial_account_id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))})`;
}

export type FinancialPeriod = { startDate: Date; endDate: Date };
export type FinancialPeriodTotals = {
  incomeTotal: string | number;
  expenseTotal: string | number;
  incomeCount: number;
  expenseCount: number;
};

/** Read any requested periods in one round trip, including overlapping or identical periods. */
export async function readPeriodTotals(userId: string, periods: FinancialPeriod[], accountIds?: string[] | null): Promise<FinancialPeriodTotals[]> {
  const selection = accountSelection(accountIds);
  return getPrismaClient().$queryRaw<FinancialPeriodTotals[]>(Prisma.sql`
    WITH periods(position, start_date, end_date) AS (
      VALUES ${Prisma.join(periods.map((period, index) => Prisma.sql`(${index}::int, ${period.startDate.toISOString()}::timestamptz, ${period.endDate.toISOString()}::timestamptz)`))}
    ), totals AS (
      SELECT p.position, 'INCOME' AS kind, SUM(m.amount) AS amount, COUNT(*) AS count
      FROM periods p JOIN incomes m ON m.user_id = ${userId}::uuid
        AND m.deleted_at IS NULL AND m.occurred_at >= p.start_date AND m.occurred_at <= p.end_date
        ${selection}
      GROUP BY p.position
      UNION ALL
      SELECT p.position, 'EXPENSE' AS kind, SUM(m.amount) AS amount, COUNT(*) AS count
      FROM periods p JOIN expenses m ON m.user_id = ${userId}::uuid
        AND m.deleted_at IS NULL AND m.occurred_at >= p.start_date AND m.occurred_at <= p.end_date
        ${selection}
      GROUP BY p.position
    )
    SELECT COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'INCOME'), 0)::text AS "incomeTotal",
      COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'EXPENSE'), 0)::text AS "expenseTotal",
      COALESCE(SUM(t.count) FILTER (WHERE t.kind = 'INCOME'), 0)::int AS "incomeCount",
      COALESCE(SUM(t.count) FILTER (WHERE t.kind = 'EXPENSE'), 0)::int AS "expenseCount"
    FROM periods p LEFT JOIN totals t ON t.position = p.position
    GROUP BY p.position ORDER BY p.position
  `);
}
