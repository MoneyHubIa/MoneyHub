import { financialGoalsTypeDefs, financialGoalsResolvers } from '../../modules/finance/financial-goals/financial-goals-graphql.js';
import { GraphQLError } from 'graphql';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuthContext } from '../../modules/auth/authentication/auth.js';
import { getPrismaClient } from '../database/database.js';
import type {
  AccountPayable as PrismaAccountPayable,
  AccountReceivable as PrismaAccountReceivable,
  CalendarEvent as PrismaCalendarEvent,
  Expense as PrismaExpense,
  Income as PrismaIncome,
  Notification as PrismaNotification,
  RecurringTransaction as PrismaRecurringTransaction
} from '../../generated/prisma/client.js';
import {
  getMyProfile,
  updateMyProfile,
  type Profile,
  type ProfileInput,
  type ProfileRepository
} from '../../modules/profile/profile-management/profile-management.js';
import {
  createCategory,
  deleteCategory,
  listMyCategories,
  updateCategory,
  type CategoryType,
  type CreateCategoryInput,
  type FinancialCategory,
  type FinancialCategoryRepository,
  type UpdateCategoryInput
} from '../../modules/finance/financial-categories/financial-categories.js';
import {
  createCostCenter,
  deleteCostCenter,
  listMyCostCenters,
  updateCostCenter,
  type CostCenterRepository,
  type CreateCostCenterInput,
  type UpdateCostCenterInput
} from '../../modules/finance/cost-centers/cost-centers.js';
import {
  createIncome,
  deleteIncome,
  listMyIncomes,
  updateIncome,
  type Income,
  type IncomeRepository,
  type CreateIncomeInput,
  type UpdateIncomeInput
} from '../../modules/finance/incomes/incomes.js';
import {
  createExpense,
  deleteExpense,
  listMyExpenses,
  updateExpense,
  type Expense,
  type ExpenseRepository,
  type CreateExpenseInput,
  type UpdateExpenseInput
} from '../../modules/finance/expenses/expenses.js';
import {
  getDashboardSummary,
  type DashboardSummaryRepository
} from '../../modules/finance/dashboard-summary/dashboard-summary.js';
import {
  createAccountPayable,
  deleteAccountPayable,
  listMyAccountsPayable,
  markAccountPayablePaid,
  updateAccountPayable,
  type AccountPayable,
  type AccountPayableRepository,
  type AccountPayableStatus,
  type CreateAccountPayableInput,
  type UpdateAccountPayableInput
} from '../../modules/finance/accounts-payable/accounts-payable.js';
import {
  createAccountReceivable,
  deleteAccountReceivable,
  listMyAccountsReceivable,
  markAccountReceivableReceived,
  updateAccountReceivable,
  type AccountReceivable,
  type AccountReceivableRepository,
  type AccountReceivableStatus,
  type CreateAccountReceivableInput,
  type UpdateAccountReceivableInput
} from '../../modules/finance/accounts-receivable/accounts-receivable.js';
import {
  createRecurringTransaction,
  deleteRecurringTransaction,
  listMyRecurringTransactions,
  processRecurringTransactions,
  updateRecurringTransaction,
  type CreateRecurringTransactionInput,
  type RecurrenceRule,
  type RecurringTransaction,
  type RecurringTransactionRepository,
  type RecurringType,
  type UpdateRecurringTransactionInput
} from '../../modules/finance/recurring-transactions/recurring-transactions.js';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  listMyAgenda,
  updateCalendarEvent,
  type AgendaItem,
  type AgendaRangeInput,
  type CalendarEvent,
  type CalendarEventRepository,
  type CreateCalendarEventInput,
  type UpdateCalendarEventInput
} from '../../modules/agenda/calendar-events/calendar-events.js';
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  syncAgendaNotifications,
  type AgendaNotificationsRepository,
  type Notification,
  type ReminderOffsetDays
} from '../../modules/agenda/notifications/agenda-notifications.js';
import {
  cashFlowRepository,
  getCashFlow,
  type CashFlowInput
} from '../../modules/finance/cash-flow/cash-flow.js';
import {
  categoryAnalysisRepository,
  getCategoryAnalysis,
  type CategoryAnalysisInput
} from '../../modules/finance/category-analysis/category-analysis.js';
import {
  periodComparisonRepository,
  getPeriodComparison,
  type PeriodComparisonInput
} from '../../modules/finance/period-comparison/period-comparison.js';
import {
  aiContextRepository,
  buildAiFinancialContext,
  type AiFinancialContextInput
} from '../../modules/ai/context-builder/ai-context-builder.js';
import {
  askAiAssistant,
  type AskAiAssistantInput
} from '../../modules/ai/service/ai-service.js';



export type GraphQLContext = {
  requestId: string;
  auth: AuthContext | null;
};

type BootstrapProfileInput = {
  fullName: string;
  preferredCurrency?: string;
  theme?: 'SYSTEM' | 'LIGHT' | 'DARK';
};

function profileRepository(): ProfileRepository {
  const prisma = getPrismaClient();
  const mapProfile = (profile: {
    id: string;
    fullName: string;
    preferredCurrency: string;
    theme: string;
  }): Profile => ({
    ...profile,
    theme: profile.theme as Profile['theme']
  });

  return {
    findUnique: async ({ where }) => {
      const profile = await prisma.profile.findUnique({ where });
      return profile ? mapProfile(profile) : null;
    },
    update: async ({ where, data }) => {
      const profile = await prisma.profile.update({ where, data });
      return mapProfile(profile);
    }
  };
}

function financialCategoryRepository(): FinancialCategoryRepository {
  const prisma = getPrismaClient();
  const mapCategory = (cat: {
    id: string;
    userId: string;
    name: string;
    type: string;
    color: string;
    icon: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): FinancialCategory => ({
    ...cat,
    type: cat.type as CategoryType
  });

  return {
    findMany: async ({ where }) => {
      const items = await prisma.financialCategory.findMany({ where });
      return items.map(mapCategory);
    },
    findUnique: async ({ where }) => {
      const cat = await prisma.financialCategory.findUnique({ where });
      return cat ? mapCategory(cat) : null;
    },
    create: async ({ data }) => {
      const cat = await prisma.financialCategory.create({ data });
      return mapCategory(cat);
    },
    update: async ({ where, data }) => {
      const cat = await prisma.financialCategory.update({ where, data });
      return mapCategory(cat);
    }
  };
}

function costCenterRepository(): CostCenterRepository {
  const prisma = getPrismaClient();
  return {
    findMany: async ({ where }) => {
      return prisma.costCenter.findMany({ where });
    },
    findUnique: async ({ where }) => {
      return prisma.costCenter.findUnique({ where });
    },
    create: async ({ data }) => {
      return prisma.costCenter.create({ data });
    },
    update: async ({ where, data }) => {
      return prisma.costCenter.update({ where, data });
    }
  };
}

function incomeRepository(): IncomeRepository {
  const prisma = getPrismaClient();
  const mapIncome = (item: PrismaIncome): Income => ({
    ...item,
    amount: item.amount.toString()
  });
  return {
    findMany: async ({ where }) => (await prisma.income.findMany({ where, orderBy: { occurredAt: 'desc' } })).map(mapIncome),
    findUnique: async ({ where }) => {
      const item = await prisma.income.findUnique({ where });
      return item ? mapIncome(item) : null;
    },
    create: async ({ data }) => mapIncome(await prisma.income.create({ data })),
    update: async ({ where, data }) => mapIncome(await prisma.income.update({ where, data }))
  };
}

function expenseRepository(): ExpenseRepository {
  const prisma = getPrismaClient();
  const mapExpense = (item: PrismaExpense): Expense => ({
    ...item,
    amount: item.amount.toString()
  });
  return {
    findMany: async ({ where }) => (await prisma.expense.findMany({ where, orderBy: { occurredAt: 'desc' } })).map(mapExpense),
    findUnique: async ({ where }) => {
      const item = await prisma.expense.findUnique({ where });
      return item ? mapExpense(item) : null;
    },
    create: async ({ data }) => mapExpense(await prisma.expense.create({ data })),
    update: async ({ where, data }) => mapExpense(await prisma.expense.update({ where, data }))
  };
}

function dashboardSummaryRepository(): DashboardSummaryRepository {
  const prisma = getPrismaClient();
  return {
    getIncomeSummary: async ({ userId, startDate, endDate }) => {
      const result = await prisma.income.aggregate({
        where: {
          userId,
          deletedAt: null,
          occurredAt: { gte: startDate, lte: endDate }
        },
        _sum: { amount: true },
        _count: { _all: true }
      });
      return {
        sum: Number(result._sum.amount ?? 0),
        count: result._count._all
      };
    },
    getExpenseSummary: async ({ userId, startDate, endDate }) => {
      const result = await prisma.expense.aggregate({
        where: {
          userId,
          deletedAt: null,
          occurredAt: { gte: startDate, lte: endDate }
        },
        _sum: { amount: true },
        _count: { _all: true }
      });
      return {
        sum: Number(result._sum.amount ?? 0),
        count: result._count._all
      };
    }
  };
}

function accountPayableRepository(): AccountPayableRepository {
  const prisma = getPrismaClient();
  const mapAccountPayable = (item: PrismaAccountPayable): AccountPayable => ({
    ...item,
    amount: item.amount.toString(),
    dueDate: item.dueDate.toISOString(),
    paidAt: item.paidAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    status: item.status as AccountPayableStatus,
    reminderOffsetDays: item.reminderOffsetDays as ReminderOffsetDays | null
  } as unknown as AccountPayable);
  return {
    findMany: async ({ where }) => (await prisma.accountPayable.findMany({ where, orderBy: { dueDate: 'asc' } })).map(mapAccountPayable),
    findUnique: async ({ where }) => {
      const item = await prisma.accountPayable.findUnique({ where });
      return item ? mapAccountPayable(item) : null;
    },
    create: async ({ data }) => mapAccountPayable(await prisma.accountPayable.create({ data })),
    update: async ({ where, data }) => mapAccountPayable(await prisma.accountPayable.update({ where, data })),
    createExpenseFromPayable: async ({ data }) => {
      await prisma.expense.create({
        data: {
          userId: data.userId,
          categoryId: data.categoryId,
          costCenterId: data.costCenterId ?? null,
          description: data.description,
          amount: data.amount,
          occurredAt: data.occurredAt,
          notes: data.notes ?? null
        }
      });
    }
  };
}

function accountReceivableRepository(): AccountReceivableRepository {
  const prisma = getPrismaClient();
  const mapAccountReceivable = (item: PrismaAccountReceivable): AccountReceivable => ({
    ...item,
    amount: item.amount.toString(),
    dueDate: item.dueDate.toISOString(),
    receivedAt: item.receivedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    status: item.status as AccountReceivableStatus,
    reminderOffsetDays: item.reminderOffsetDays as ReminderOffsetDays | null
  } as unknown as AccountReceivable);
  return {
    findMany: async ({ where }) => (await prisma.accountReceivable.findMany({ where, orderBy: { dueDate: 'asc' } })).map(mapAccountReceivable),
    findUnique: async ({ where }) => {
      const item = await prisma.accountReceivable.findUnique({ where });
      return item ? mapAccountReceivable(item) : null;
    },
    create: async ({ data }) => mapAccountReceivable(await prisma.accountReceivable.create({ data })),
    update: async ({ where, data }) => mapAccountReceivable(await prisma.accountReceivable.update({ where, data })),
    createIncomeFromReceivable: async ({ data }) => {
      await prisma.income.create({
        data: {
          userId: data.userId,
          categoryId: data.categoryId,
          costCenterId: data.costCenterId ?? null,
          description: data.description,
          amount: data.amount,
          occurredAt: data.occurredAt,
          notes: data.notes ?? null
        }
      });
    }
  };
}

function recurringTransactionRepository(): RecurringTransactionRepository {
  const prisma = getPrismaClient();
  const mapRecurring = (item: PrismaRecurringTransaction): RecurringTransaction => ({
    ...item,
    amount: item.amount.toString(),
    type: item.type as RecurringType,
    recurrenceRule: item.recurrenceRule as RecurrenceRule
  });

  return {
    findMany: async ({ where }) => {
      const items = await prisma.recurringTransaction.findMany({ where });
      return items.map(mapRecurring);
    },
    findUnique: async ({ where }) => {
      const item = await prisma.recurringTransaction.findUnique({ where });
      return item ? mapRecurring(item) : null;
    },
    create: async ({ data }) => {
      const item = await prisma.recurringTransaction.create({
        data: {
          userId: data.userId,
          type: data.type,
          categoryId: data.categoryId,
          costCenterId: data.costCenterId ?? null,
          description: data.description,
          amount: data.amount,
          recurrenceRule: data.recurrenceRule,
          startDate: data.startDate,
          endDate: data.endDate ?? null
        }
      });
      return mapRecurring(item);
    },
    update: async ({ where, data }) => {
      const updateData: Prisma.RecurringTransactionUncheckedUpdateInput = {};
      if (data.type !== undefined) updateData.type = data.type;
      if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
      if (data.costCenterId !== undefined) updateData.costCenterId = data.costCenterId;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.amount !== undefined) updateData.amount = data.amount;
      if (data.recurrenceRule !== undefined) updateData.recurrenceRule = data.recurrenceRule;
      if (data.startDate !== undefined) updateData.startDate = data.startDate;
      if (data.endDate !== undefined) updateData.endDate = data.endDate;

      const item = await prisma.recurringTransaction.update({
        where,
        data: updateData
      });
      return mapRecurring(item);
    },
    delete: async ({ where }) => {
      const item = await prisma.recurringTransaction.delete({ where });
      return mapRecurring(item);
    },
    createPayable: async ({ data }) => {
      await prisma.accountPayable.create({
        data: {
          userId: data.userId,
          categoryId: data.categoryId,
          costCenterId: data.costCenterId ?? null,
          description: data.description,
          amount: data.amount,
          dueDate: data.dueDate,
          status: data.status
        }
      });
    },
    createReceivable: async ({ data }) => {
      await prisma.accountReceivable.create({
        data: {
          userId: data.userId,
          categoryId: data.categoryId,
          costCenterId: data.costCenterId ?? null,
          description: data.description,
          amount: data.amount,
          dueDate: data.dueDate,
          status: data.status
        }
      });
    },
    findExistingPayables: async ({ where }) => {
      return prisma.accountPayable.findMany({
        where: {
          userId: where.userId,
          description: where.description,
          dueDate: where.dueDate,
          deletedAt: where.deletedAt
        },
        select: { id: true }
      });
    },
    findExistingReceivables: async ({ where }) => {
      return prisma.accountReceivable.findMany({
        where: {
          userId: where.userId,
          description: where.description,
          dueDate: where.dueDate,
          deletedAt: where.deletedAt
        },
        select: { id: true }
      });
    }
  };
}

function calendarEventRepository(): CalendarEventRepository {
  const prisma = getPrismaClient();
  const mapCalendarEvent = (item: PrismaCalendarEvent): CalendarEvent => ({
    ...item,
    recurrenceRule: item.recurrenceRule as CalendarEvent['recurrenceRule'],
    notes: item.notes ?? null,
    reminderOffsetDays: item.reminderOffsetDays as ReminderOffsetDays
  });

  return {
    findMany: async ({ where }) =>
      (await prisma.calendarEvent.findMany({ where, orderBy: { scheduledDate: 'asc' } })).map(mapCalendarEvent),
    findUnique: async ({ where }) => {
      const item = await prisma.calendarEvent.findFirst({ where });
      return item ? mapCalendarEvent(item) : null;
    },
    create: async ({ data }) => mapCalendarEvent(await prisma.calendarEvent.create({ data })),
    update: async ({ where, data }) => {
      const updateData: Prisma.CalendarEventUncheckedUpdateInput = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.scheduledDate !== undefined) updateData.scheduledDate = data.scheduledDate;
      if (data.recurrenceRule !== undefined) updateData.recurrenceRule = data.recurrenceRule;
      if (data.recurrenceEndDate !== undefined) updateData.recurrenceEndDate = data.recurrenceEndDate;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.reminderOffsetDays !== undefined) updateData.reminderOffsetDays = data.reminderOffsetDays;
      return mapCalendarEvent(await prisma.calendarEvent.update({ where, data: updateData }));
    },
    delete: async ({ where }) => mapCalendarEvent(await prisma.calendarEvent.delete({ where })),
    findPendingPayables: async ({ where }) =>
      (await prisma.accountPayable.findMany({
        where,
        select: { id: true, description: true, dueDate: true, status: true },
        orderBy: { dueDate: 'asc' }
      })).map((item) => ({ ...item, status: 'PENDING' as const })),
    findPendingReceivables: async ({ where }) =>
      (await prisma.accountReceivable.findMany({
        where,
        select: { id: true, description: true, dueDate: true, status: true },
        orderBy: { dueDate: 'asc' }
      })).map((item) => ({ ...item, status: 'PENDING' as const }))
  };
}

function agendaNotificationsRepository(): AgendaNotificationsRepository {
  const prisma = getPrismaClient();
  const mapNotification = (item: PrismaNotification): Notification => ({
    ...item,
    source: item.source as Notification['source']
  });

  return {
    findReminderItems: async ({ userId, rangeStart, throughDate }) => {
      const [events, payables, receivables] = await Promise.all([
        prisma.calendarEvent.findMany({
          where: {
            userId,
            reminderOffsetDays: { not: null },
            scheduledDate: { lte: throughDate },
            OR: [{ recurrenceRule: { not: null } }, { scheduledDate: { gte: rangeStart } }]
          },
          select: { id: true, userId: true, title: true, scheduledDate: true, reminderOffsetDays: true, recurrenceRule: true, recurrenceEndDate: true }
        }),
        prisma.accountPayable.findMany({
          where: {
            userId,
            status: 'PENDING',
            deletedAt: null,
            reminderOffsetDays: { not: null },
            dueDate: { gte: rangeStart, lte: throughDate }
          },
          select: { id: true, userId: true, description: true, dueDate: true, reminderOffsetDays: true }
        }),
        prisma.accountReceivable.findMany({
          where: {
            userId,
            status: 'PENDING',
            deletedAt: null,
            reminderOffsetDays: { not: null },
            dueDate: { gte: rangeStart, lte: throughDate }
          },
          select: { id: true, userId: true, description: true, dueDate: true, reminderOffsetDays: true }
        })
      ]);

      return [
        ...events.map((item) => ({
          source: 'EVENT' as const,
          id: item.id,
          userId: item.userId,
          title: item.title,
          scheduledDate: item.scheduledDate,
          reminderOffsetDays: item.reminderOffsetDays as ReminderOffsetDays,
          recurrenceRule: item.recurrenceRule as CalendarEvent['recurrenceRule'],
          recurrenceEndDate: item.recurrenceEndDate
        })),
        ...payables.map((item) => ({
          source: 'PAYABLE' as const,
          id: item.id,
          userId: item.userId,
          title: item.description,
          scheduledDate: item.dueDate,
          reminderOffsetDays: item.reminderOffsetDays as ReminderOffsetDays,
          status: 'PENDING'
        })),
        ...receivables.map((item) => ({
          source: 'RECEIVABLE' as const,
          id: item.id,
          userId: item.userId,
          title: item.description,
          scheduledDate: item.dueDate,
          reminderOffsetDays: item.reminderOffsetDays as ReminderOffsetDays,
          status: 'PENDING'
        }))
      ];
    },
    upsert: async ({ where, create, update }) => mapNotification(await prisma.notification.upsert({ where, create, update })),
    findMany: async ({ where }) => (await prisma.notification.findMany({
      where,
      orderBy: [{ readAt: 'asc' }, { reminderDate: 'desc' }, { createdAt: 'desc' }]
    })).map(mapNotification),
    findFirst: async ({ where }) => {
      const item = await prisma.notification.findFirst({ where });
      return item ? mapNotification(item) : null;
    },
    update: async ({ where, data }) => mapNotification(await prisma.notification.update({ where, data })),
    updateMany: ({ where, data }) => prisma.notification.updateMany({ where, data }),
    deleteMany: ({ where }) => prisma.notification.deleteMany({ where })
  };
}

export const typeDefs = `#graphql
  ${financialGoalsTypeDefs}
  type Health {
    status: String!
    service: String!
    version: String!
  }

  enum ProfileTheme {
    SYSTEM
    LIGHT
    DARK
  }

  enum CategoryType {
    INCOME
    EXPENSE
    BOTH
  }

  type Profile {
    id: ID!
    fullName: String!
    preferredCurrency: String!
    theme: ProfileTheme!
  }

  type FinancialCategory {
    id: ID!
    name: String!
    type: CategoryType!
    color: String!
    icon: String!
    createdAt: String!
    updatedAt: String!
  }

  input CreateCategoryInput {
    name: String!
    type: CategoryType = BOTH
    color: String = "#4A5568"
    icon: String = "tag"
  }

  input UpdateCategoryInput {
    id: ID!
    name: String
    type: CategoryType
    color: String
    icon: String
  }

  type CostCenter {
    id: ID!
    name: String!
    description: String
    createdAt: String!
    updatedAt: String!
  }

  input CreateCostCenterInput {
    name: String!
    description: String
  }

  input UpdateCostCenterInput {
    id: ID!
    name: String
    description: String
  }

  type Income {
    id: ID!
    categoryId: ID!
    costCenterId: ID
    description: String!
    amount: String!
    occurredAt: String!
    notes: String
    createdAt: String!
    updatedAt: String!
  }

  input CreateIncomeInput {
    categoryId: ID!
    costCenterId: ID
    description: String!
    amount: String!
    occurredAt: String!
    notes: String
  }

  input UpdateIncomeInput {
    id: ID!
    categoryId: ID
    costCenterId: ID
    description: String
    amount: String
    occurredAt: String
    notes: String
  }

  type Expense {
    id: ID!
    categoryId: ID!
    costCenterId: ID
    description: String!
    amount: String!
    occurredAt: String!
    notes: String
    createdAt: String!
    updatedAt: String!
  }

  input CreateExpenseInput {
    categoryId: ID!
    costCenterId: ID
    description: String!
    amount: String!
    occurredAt: String!
    notes: String
  }

  input UpdateExpenseInput {
    id: ID!
    categoryId: ID
    costCenterId: ID
    description: String
    amount: String
    occurredAt: String
    notes: String
  }

  type AuthUser {
    id: ID!
    email: String!
    emailVerified: Boolean!
    profile: Profile
    needsProfileBootstrap: Boolean!
  }

  input BootstrapProfileInput {
    fullName: String!
    preferredCurrency: String = "BRL"
    theme: ProfileTheme = SYSTEM
  }

  input UpdateMyProfileInput {
    fullName: String!
    preferredCurrency: String!
    theme: ProfileTheme!
  }

  type BootstrapProfilePayload {
    user: AuthUser!
    profile: Profile!
    created: Boolean!
  }

  type DashboardSummary {
    totalIncome: String!
    totalExpense: String!
    netBalance: String!
    incomeCount: Int!
    expenseCount: Int!
    month: Int!
    year: Int!
  }

  enum CashFlowGranularity {
    DAILY
    MONTHLY
  }

  input CashFlowInput {
    granularity: CashFlowGranularity
    year: Int
    month: Int
    monthsCount: Int
  }

  type CashFlowDataPoint {
    label: String!
    date: String!
    income: String!
    expense: String!
    net: String!
    accumulatedBalance: String!
  }

  type CashFlowTotals {
    totalIncome: String!
    totalExpense: String!
    netBalance: String!
  }

  type CashFlowResult {
    granularity: CashFlowGranularity!
    dataPoints: [CashFlowDataPoint!]!
    totals: CashFlowTotals!
  }

  enum CategoryAnalysisType {
    EXPENSE
    INCOME
  }

  input CategoryAnalysisInput {
    type: CategoryAnalysisType
    month: Int
    year: Int
  }

  type CategoryAnalysisItem {
    categoryId: ID!
    categoryName: String!
    categoryColor: String!
    categoryIcon: String!
    totalAmount: String!
    percentage: Float!
    transactionCount: Int!
  }

  type CategoryAnalysisResult {
    type: CategoryAnalysisType!
    month: Int!
    year: Int!
    totalAmount: String!
    items: [CategoryAnalysisItem!]!
  }

  input PeriodComparisonInput {
    baseMonth: Int
    baseYear: Int
    comparisonMonth: Int
    comparisonYear: Int
  }

  type PeriodMetrics {
    month: Int!
    year: Int!
    label: String!
    totalIncome: String!
    totalExpense: String!
    netBalance: String!
    savingsRate: Float!
    incomeCount: Int!
    expenseCount: Int!
  }

  type PeriodComparisonDelta {
    incomeDelta: String!
    incomePercentage: Float!
    expenseDelta: String!
    expensePercentage: Float!
    netBalanceDelta: String!
    netBalancePercentage: Float!
    savingsRateDelta: Float!
  }

  type PeriodComparisonResult {
    basePeriod: PeriodMetrics!
    comparisonPeriod: PeriodMetrics!
    delta: PeriodComparisonDelta!
  }

  type AiFinancialTotals {
    income: String!
    expenses: String!
    balance: String!
  }

  type AiTopCategory {
    categoryName: String!
    amount: String!
    percentage: Float!
    color: String
    icon: String
  }

  type AiUpcomingBill {
    id: ID!
    description: String!
    amount: String!
    dueDate: String!
    status: String
    categoryName: String
  }

  type AiFinancialContext {
    version: String!
    period: String!
    currency: String!
    generatedAt: String!
    totals: AiFinancialTotals!
    topExpenseCategories: [AiTopCategory!]!
    upcomingBills: [AiUpcomingBill!]!
    goals: [String!]!
  }

  input AiFinancialContextInput {
    month: Int
    year: Int
    billsDaysAhead: Int
  }

  type AiAssistantUsage {
    promptTokens: Int!
    completionTokens: Int!
    totalTokens: Int!
  }

  type AiAssistantResponse {
    answer: String!
    provider: String!
    model: String!
    latencyMs: Int!
    usage: AiAssistantUsage!
    contextPeriod: String!
    contextVersion: String!
  }

  input AskAiAssistantInput {
    message: String!
    month: Int
    year: Int
    templateId: String
  }

  enum AccountPayableStatus {
    PENDING
    PAID
    OVERDUE
    CANCELLED
  }

  type AccountPayable {
    id: ID!
    userId: ID!
    categoryId: ID!
    costCenterId: ID
    description: String!
    amount: String!
    dueDate: String!
    status: AccountPayableStatus!
    paidAt: String
    reminderOffsetDays: Int
    createdAt: String!
    updatedAt: String!
  }

  input CreateAccountPayableInput {
    categoryId: ID!
    costCenterId: ID
    description: String!
    amount: String!
    dueDate: String!
    status: AccountPayableStatus
    reminderOffsetDays: Int
  }

  input UpdateAccountPayableInput {
    id: ID!
    categoryId: ID
    costCenterId: ID
    description: String
    amount: String
    dueDate: String
    status: AccountPayableStatus
    paidAt: String
    reminderOffsetDays: Int
  }

  enum AccountReceivableStatus {
    PENDING
    RECEIVED
    OVERDUE
    CANCELLED
  }

  type AccountReceivable {
    id: ID!
    userId: ID!
    categoryId: ID!
    costCenterId: ID
    description: String!
    amount: String!
    dueDate: String!
    status: AccountReceivableStatus!
    receivedAt: String
    reminderOffsetDays: Int
    createdAt: String!
    updatedAt: String!
  }

  input CreateAccountReceivableInput {
    categoryId: ID!
    costCenterId: ID
    description: String!
    amount: String!
    dueDate: String!
    status: AccountReceivableStatus
    reminderOffsetDays: Int
  }

  input UpdateAccountReceivableInput {
    id: ID!
    categoryId: ID
    costCenterId: ID
    description: String
    amount: String
    dueDate: String
    status: AccountReceivableStatus
    receivedAt: String
    reminderOffsetDays: Int
  }

  enum RecurringType {
    EXPENSE
    INCOME
  }

  enum RecurrenceRule {
    MONTHLY
    WEEKLY
    YEARLY
  }

  type RecurringTransaction {
    id: ID!
    userId: ID!
    type: RecurringType!
    categoryId: ID!
    costCenterId: ID
    description: String!
    amount: String!
    recurrenceRule: RecurrenceRule!
    startDate: String!
    endDate: String
    createdAt: String!
    updatedAt: String!
  }

  input CreateRecurringTransactionInput {
    type: RecurringType!
    categoryId: ID!
    costCenterId: ID
    description: String!
    amount: String!
    recurrenceRule: RecurrenceRule!
    startDate: String!
    endDate: String
  }

  input UpdateRecurringTransactionInput {
    id: ID!
    type: RecurringType
    categoryId: ID
    costCenterId: ID
    description: String
    amount: String
    recurrenceRule: RecurrenceRule
    startDate: String
    endDate: String
  }

  type ProcessRecurringResult {
    generatedPayables: Int!
    generatedReceivables: Int!
  }

  type CalendarEvent {
    id: ID!
    title: String!
    scheduledDate: String!
    recurrenceRule: RecurrenceRule
    recurrenceEndDate: String
    notes: String
    reminderOffsetDays: Int
    createdAt: String!
    updatedAt: String!
  }

  enum AgendaItemSource {
    EVENT
    PAYABLE
    RECEIVABLE
  }

  type AgendaItem {
    id: ID!
    source: AgendaItemSource!
    title: String!
    scheduledDate: String!
    status: String!
    notes: String
    recurrenceRule: RecurrenceRule
    recurrenceEndDate: String
    reminderOffsetDays: Int
  }

  input AgendaRangeInput {
    startDate: String!
    endDate: String!
  }

  input CreateCalendarEventInput {
    title: String!
    scheduledDate: String!
    recurrenceRule: RecurrenceRule
    recurrenceEndDate: String
    notes: String
    reminderOffsetDays: Int
  }

  input UpdateCalendarEventInput {
    id: ID!
    title: String
    scheduledDate: String
    recurrenceRule: RecurrenceRule
    recurrenceEndDate: String
    notes: String
    reminderOffsetDays: Int
  }

  enum NotificationSource {
    EVENT
    PAYABLE
    RECEIVABLE
  }

  type Notification {
    id: ID!
    source: NotificationSource!
    sourceId: ID!
    title: String!
    occurrenceDate: String!
    reminderDate: String!
    readAt: String
    createdAt: String!
  }

  type Query {
    health: Health!
    me: AuthUser
    myProfile: Profile!
    myCategories(type: CategoryType): [FinancialCategory!]!
    myCostCenters: [CostCenter!]!
    myIncomes: [Income!]!
    myExpenses: [Expense!]!
    myAccountsPayable(status: AccountPayableStatus): [AccountPayable!]!
    myAccountsReceivable(status: AccountReceivableStatus): [AccountReceivable!]!
    myRecurringTransactions: [RecurringTransaction!]!
    myAgenda(input: AgendaRangeInput!): [AgendaItem!]!
    myNotifications: [Notification!]!
    dashboardSummary(month: Int, year: Int): DashboardSummary!
    cashFlow(input: CashFlowInput): CashFlowResult!
    categoryAnalysis(input: CategoryAnalysisInput): CategoryAnalysisResult!
    periodComparison(input: PeriodComparisonInput): PeriodComparisonResult!
    aiFinancialContext(input: AiFinancialContextInput): AiFinancialContext!
  }

  type Mutation {
    bootstrapProfile(input: BootstrapProfileInput!): BootstrapProfilePayload!
    updateMyProfile(input: UpdateMyProfileInput!): Profile!
    createCategory(input: CreateCategoryInput!): FinancialCategory!
    updateCategory(input: UpdateCategoryInput!): FinancialCategory!
    deleteCategory(id: ID!): Boolean!
    createCostCenter(input: CreateCostCenterInput!): CostCenter!
    updateCostCenter(input: UpdateCostCenterInput!): CostCenter!
    deleteCostCenter(id: ID!): Boolean!
    createIncome(input: CreateIncomeInput!): Income!
    updateIncome(input: UpdateIncomeInput!): Income!
    deleteIncome(id: ID!): Boolean!
    createExpense(input: CreateExpenseInput!): Expense!
    updateExpense(input: UpdateExpenseInput!): Expense!
    deleteExpense(id: ID!): Boolean!
    createAccountPayable(input: CreateAccountPayableInput!): AccountPayable!
    updateAccountPayable(input: UpdateAccountPayableInput!): AccountPayable!
    markAccountPayablePaid(id: ID!, paidAt: String): AccountPayable!
    deleteAccountPayable(id: ID!): Boolean!
    createAccountReceivable(input: CreateAccountReceivableInput!): AccountReceivable!
    updateAccountReceivable(input: UpdateAccountReceivableInput!): AccountReceivable!
    markAccountReceivableReceived(id: ID!, receivedAt: String): AccountReceivable!
    deleteAccountReceivable(id: ID!): Boolean!
    createRecurringTransaction(input: CreateRecurringTransactionInput!): RecurringTransaction!
    updateRecurringTransaction(input: UpdateRecurringTransactionInput!): RecurringTransaction!
    deleteRecurringTransaction(id: ID!): Boolean!
    processRecurringTransactions: ProcessRecurringResult!
    askAiAssistant(input: AskAiAssistantInput!): AiAssistantResponse!
    createCalendarEvent(input: CreateCalendarEventInput!): CalendarEvent!
    updateCalendarEvent(input: UpdateCalendarEventInput!): CalendarEvent!
    deleteCalendarEvent(id: ID!): Boolean!
    syncAgendaNotifications(today: String!): [Notification!]!
    markNotificationRead(id: ID!): Notification!
    markAllNotificationsRead: Int!
  }
`;

export const resolvers = {
  Query: {
    ...financialGoalsResolvers.Query,
    health: () => ({
      status: 'ok',
      service: 'moneyhub-backend',
      version: '0.1.0'
    }),
    me: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      if (!context.auth) {
        return null;
      }

      return {
        id: context.auth.uid,
        email: context.auth.email,
        emailVerified: context.auth.emailVerified
      };
    },
    myProfile: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      if (!context.auth) throw unauthenticatedError();
      return getMyProfile(context, profileRepository());
    },
    myCategories: (_parent: unknown, args: { type?: CategoryType }, context: GraphQLContext) => {
      return listMyCategories(context, args.type, financialCategoryRepository());
    },
    myCostCenters: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      return listMyCostCenters(context, costCenterRepository());
    },
    myIncomes: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      return listMyIncomes(context, incomeRepository());
    },
    myExpenses: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      return listMyExpenses(context, expenseRepository());
    },
    myAccountsPayable: (
      _parent: unknown,
      args: { status?: AccountPayableStatus },
      context: GraphQLContext
    ) => {
      return listMyAccountsPayable(context, args.status, accountPayableRepository());
    },
    myAccountsReceivable: (
      _parent: unknown,
      args: { status?: AccountReceivableStatus },
      context: GraphQLContext
    ) => {
      return listMyAccountsReceivable(context, args.status, accountReceivableRepository());
    },
    myRecurringTransactions: (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) => {
      return listMyRecurringTransactions(context, recurringTransactionRepository());
    },
    myAgenda: (
      _parent: unknown,
      args: { input: AgendaRangeInput },
      context: GraphQLContext
    ) => {
      return listMyAgenda(context, args.input, calendarEventRepository());
    },
    myNotifications: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      return listMyNotifications(context, agendaNotificationsRepository());
    },
    dashboardSummary: (
      _parent: unknown,
      args: { month?: number; year?: number },
      context: GraphQLContext
    ) => {
      return getDashboardSummary(context, args, dashboardSummaryRepository());
    },
    cashFlow: (
      _parent: unknown,
      args: { input?: CashFlowInput },
      context: GraphQLContext
    ) => {
      return getCashFlow(context, args.input, cashFlowRepository());
    },
    categoryAnalysis: (
      _parent: unknown,
      args: { input?: CategoryAnalysisInput },
      context: GraphQLContext
    ) => {
      return getCategoryAnalysis(context, args.input, categoryAnalysisRepository());
    },
    periodComparison: (
      _parent: unknown,
      args: { input?: PeriodComparisonInput },
      context: GraphQLContext
    ) => {
      return getPeriodComparison(context, args.input, periodComparisonRepository());
    },
    aiFinancialContext: (
      _parent: unknown,
      args: { input?: AiFinancialContextInput },
      context: GraphQLContext
    ) => {
      return buildAiFinancialContext(context, args.input, aiContextRepository());
    }
  },
  Mutation: {
    ...financialGoalsResolvers.Mutation,
    bootstrapProfile: async (
      _parent: unknown,
      args: { input: BootstrapProfileInput },
      context: GraphQLContext
    ) => {
      if (!context.auth) throw unauthenticatedError();
      const { input } = args;

      if (!input.fullName?.trim()) {
        throw new GraphQLError('Full name is required', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      const prisma = getPrismaClient();

      return prisma.$transaction(async (tx) => {
        const existingUser =
          (await tx.user.findUnique({ where: { firebaseUid: context.auth!.uid } })) ??
          (await tx.user.findUnique({ where: { email: context.auth!.email } }));
        let emailVerifiedAt = existingUser?.emailVerifiedAt ?? null;
        if (!context.auth!.emailVerified) {
          emailVerifiedAt = null;
        } else if (existingUser?.email !== context.auth!.email || !emailVerifiedAt) {
          emailVerifiedAt = new Date();
        }

        const upsertedUser = existingUser
          ? await tx.user.update({
              where: { id: existingUser.id },
              data: {
                firebaseUid: context.auth!.uid,
                email: context.auth!.email,
                emailVerifiedAt
              }
            })
          : await tx.user.create({
              data: {
                firebaseUid: context.auth!.uid,
                email: context.auth!.email,
                emailVerifiedAt,
                status: 'ACTIVE'
              }
            });

        const existingProfile = await tx.profile.findUnique({ where: { userId: upsertedUser.id } });
        const authUserObj = {
          id: context.auth!.uid,
          email: context.auth!.email,
          emailVerified: context.auth!.emailVerified
        };

        if (existingProfile) {
          return {
            user: authUserObj,
            profile: existingProfile,
            created: false
          };
        }

        const profile = await tx.profile.create({
          data: {
            userId: upsertedUser.id,
            fullName: input.fullName.trim(),
            preferredCurrency: input.preferredCurrency ?? 'BRL',
            theme: input.theme ?? 'SYSTEM'
          }
        });

        return {
          user: authUserObj,
          profile,
          created: true
        };
      });
    },
    updateMyProfile: (
      _parent: unknown,
      args: { input: ProfileInput },
      context: GraphQLContext
    ) => {
      return updateMyProfile(context, args.input, profileRepository());
    },
    createCategory: (
      _parent: unknown,
      args: { input: CreateCategoryInput },
      context: GraphQLContext
    ) => {
      return createCategory(context, args.input, financialCategoryRepository());
    },
    updateCategory: (
      _parent: unknown,
      args: { input: UpdateCategoryInput },
      context: GraphQLContext
    ) => {
      return updateCategory(context, args.input, financialCategoryRepository());
    },
    deleteCategory: (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      return deleteCategory(context, args.id, financialCategoryRepository());
    },
    createCostCenter: (
      _parent: unknown,
      args: { input: CreateCostCenterInput },
      context: GraphQLContext
    ) => {
      return createCostCenter(context, args.input, costCenterRepository());
    },
    updateCostCenter: (
      _parent: unknown,
      args: { input: UpdateCostCenterInput },
      context: GraphQLContext
    ) => {
      return updateCostCenter(context, args.input, costCenterRepository());
    },
    deleteCostCenter: (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      return deleteCostCenter(context, args.id, costCenterRepository());
    },
    createIncome: (
      _parent: unknown,
      args: { input: CreateIncomeInput },
      context: GraphQLContext
    ) => {
      return createIncome(context, args.input, incomeRepository());
    },
    updateIncome: (
      _parent: unknown,
      args: { input: UpdateIncomeInput },
      context: GraphQLContext
    ) => {
      return updateIncome(context, args.input, incomeRepository());
    },
    deleteIncome: (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      return deleteIncome(context, args.id, incomeRepository());
    },
    createExpense: (
      _parent: unknown,
      args: { input: CreateExpenseInput },
      context: GraphQLContext
    ) => {
      return createExpense(context, args.input, expenseRepository());
    },
    updateExpense: (
      _parent: unknown,
      args: { input: UpdateExpenseInput },
      context: GraphQLContext
    ) => {
      return updateExpense(context, args.input, expenseRepository());
    },
    deleteExpense: (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      return deleteExpense(context, args.id, expenseRepository());
    },
    createAccountPayable: (
      _parent: unknown,
      args: { input: CreateAccountPayableInput },
      context: GraphQLContext
    ) => {
      return createAccountPayable(context, args.input, accountPayableRepository());
    },
    updateAccountPayable: (
      _parent: unknown,
      args: { input: UpdateAccountPayableInput },
      context: GraphQLContext
    ) => {
      return updateAccountPayable(context, args.input, accountPayableRepository());
    },
    markAccountPayablePaid: (
      _parent: unknown,
      args: { id: string; paidAt?: string },
      context: GraphQLContext
    ) => {
      return markAccountPayablePaid(context, args, accountPayableRepository());
    },
    deleteAccountPayable: (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      return deleteAccountPayable(context, args, accountPayableRepository());
    },
    createAccountReceivable: (
      _parent: unknown,
      args: { input: CreateAccountReceivableInput },
      context: GraphQLContext
    ) => {
      return createAccountReceivable(context, args.input, accountReceivableRepository());
    },
    updateAccountReceivable: (
      _parent: unknown,
      args: { input: UpdateAccountReceivableInput },
      context: GraphQLContext
    ) => {
      return updateAccountReceivable(context, args.input, accountReceivableRepository());
    },
    markAccountReceivableReceived: (
      _parent: unknown,
      args: { id: string; receivedAt?: string },
      context: GraphQLContext
    ) => {
      return markAccountReceivableReceived(context, args, accountReceivableRepository());
    },
    deleteAccountReceivable: (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      return deleteAccountReceivable(context, args, accountReceivableRepository());
    },
    createRecurringTransaction: (
      _parent: unknown,
      args: { input: CreateRecurringTransactionInput },
      context: GraphQLContext
    ) => {
      return createRecurringTransaction(context, args.input, recurringTransactionRepository());
    },
    updateRecurringTransaction: (
      _parent: unknown,
      args: { input: UpdateRecurringTransactionInput },
      context: GraphQLContext
    ) => {
      return updateRecurringTransaction(context, args.input, recurringTransactionRepository());
    },
    deleteRecurringTransaction: (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      return deleteRecurringTransaction(context, args.id, recurringTransactionRepository());
    },
    processRecurringTransactions: (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) => {
      return processRecurringTransactions(context, recurringTransactionRepository());
    },
    askAiAssistant: (
      _parent: unknown,
      args: { input: AskAiAssistantInput },
      context: GraphQLContext
    ) => {
      return askAiAssistant(context, args.input);
    },
    createCalendarEvent: (
      _parent: unknown,
      args: { input: CreateCalendarEventInput },
      context: GraphQLContext
    ) => {
      return createCalendarEvent(context, args.input, calendarEventRepository());
    },
    updateCalendarEvent: (
      _parent: unknown,
      args: { input: UpdateCalendarEventInput },
      context: GraphQLContext
    ) => {
      return updateCalendarEvent(context, args.input, calendarEventRepository());
    },
    deleteCalendarEvent: (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      return deleteCalendarEvent(context, args.id, calendarEventRepository());
    },
    syncAgendaNotifications: (
      _parent: unknown,
      args: { today: string },
      context: GraphQLContext
    ) => {
      return syncAgendaNotifications(context, agendaNotificationsRepository(), args.today);
    },
    markNotificationRead: (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      return markNotificationRead(context, args.id, agendaNotificationsRepository());
    },
    markAllNotificationsRead: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      return markAllNotificationsRead(context, agendaNotificationsRepository());
    }
  },
  FinancialGoal: financialGoalsResolvers.FinancialGoal,
  FinancialGoalMovement: financialGoalsResolvers.FinancialGoalMovement,
  CalendarEvent: {
    scheduledDate: (parent: CalendarEvent) => parent.scheduledDate.toISOString().slice(0, 10),
    recurrenceEndDate: (parent: CalendarEvent) => parent.recurrenceEndDate?.toISOString().slice(0, 10) ?? null,
    notes: (parent: CalendarEvent) => parent.notes ?? null,
    createdAt: (parent: CalendarEvent) => parent.createdAt.toISOString(),
    updatedAt: (parent: CalendarEvent) => parent.updatedAt.toISOString()
  },
  AgendaItem: {
    scheduledDate: (parent: AgendaItem) => parent.scheduledDate.toISOString().slice(0, 10),
    notes: (parent: AgendaItem) => parent.notes ?? null,
    recurrenceEndDate: (parent: AgendaItem) => parent.recurrenceEndDate?.toISOString().slice(0, 10) ?? null,
    reminderOffsetDays: (parent: AgendaItem) => parent.reminderOffsetDays ?? null
  },
  Notification: {
    occurrenceDate: (parent: Notification) => parent.occurrenceDate.toISOString().slice(0, 10),
    reminderDate: (parent: Notification) => parent.reminderDate.toISOString().slice(0, 10),
    readAt: (parent: Notification) => parent.readAt?.toISOString() ?? null,
    createdAt: (parent: Notification) => parent.createdAt.toISOString()
  },
  RecurringTransaction: {
    startDate: (parent: RecurringTransaction) =>
      parent.startDate instanceof Date ? parent.startDate.toISOString() : parent.startDate,
    endDate: (parent: RecurringTransaction) =>
      parent.endDate instanceof Date ? parent.endDate.toISOString() : parent.endDate,
    createdAt: (parent: RecurringTransaction) =>
      parent.createdAt instanceof Date ? parent.createdAt.toISOString() : parent.createdAt,
    updatedAt: (parent: RecurringTransaction) =>
      parent.updatedAt instanceof Date ? parent.updatedAt.toISOString() : parent.updatedAt
  },
  AuthUser: {
    profile: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      if (!context.auth?.profileId) return null;
      return getPrismaClient().profile.findUnique({ where: { id: context.auth.profileId } });
    },
    needsProfileBootstrap: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      return !context.auth?.profileId;
    }
  }
};

export function unauthenticatedError(): GraphQLError {
  return new GraphQLError('Authentication credentials are invalid.', {
    extensions: {
      code: 'UNAUTHENTICATED',
      http: { status: 401 }
    }
  });
}
