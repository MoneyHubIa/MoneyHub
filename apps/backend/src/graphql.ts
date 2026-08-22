import { GraphQLError } from 'graphql';
import type { AuthContext } from './auth.js';
import { getPrismaClient } from './database.js';
import type { Expense as PrismaExpense, Income as PrismaIncome } from './generated/prisma/client.js';
import {
  getMyProfile,
  updateMyProfile,
  type Profile,
  type ProfileInput,
  type ProfileRepository
} from './profile-management.js';
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
} from './financial-categories.js';
import {
  createCostCenter,
  deleteCostCenter,
  listMyCostCenters,
  updateCostCenter,
  type CostCenterRepository,
  type CreateCostCenterInput,
  type UpdateCostCenterInput
} from './cost-centers.js';
import {
  createIncome,
  deleteIncome,
  listMyIncomes,
  updateIncome,
  type Income,
  type IncomeRepository,
  type CreateIncomeInput,
  type UpdateIncomeInput
} from './incomes.js';
import {
  createExpense,
  deleteExpense,
  listMyExpenses,
  updateExpense,
  type Expense,
  type ExpenseRepository,
  type CreateExpenseInput,
  type UpdateExpenseInput
} from './expenses.js';
import {
  getDashboardSummary,
  type DashboardSummaryRepository
} from './dashboard-summary.js';
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
} from './accounts-payable.js';


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
  const mapAccountPayable = (item: any): AccountPayable => ({
    ...item,
    amount: item.amount.toString(),
    dueDate: item.dueDate instanceof Date ? item.dueDate.toISOString() : item.dueDate,
    paidAt: item.paidAt ? (item.paidAt instanceof Date ? item.paidAt.toISOString() : item.paidAt) : null,
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt
  });
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




export const typeDefs = `#graphql
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
    dashboardSummary(month: Int, year: Int): DashboardSummary!
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
  }
`;

export const resolvers = {
  Query: {
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
    dashboardSummary: (
      _parent: unknown,
      args: { month?: number; year?: number },
      context: GraphQLContext
    ) => {
      return getDashboardSummary(context, args, dashboardSummaryRepository());
    }
  },
  Mutation: {
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
        const existingUser = await tx.user.findUnique({ where: { firebaseUid: context.auth!.uid } });
        let emailVerifiedAt = existingUser?.emailVerifiedAt ?? null;
        if (!context.auth!.emailVerified) {
          emailVerifiedAt = null;
        } else if (existingUser?.email !== context.auth!.email || !emailVerifiedAt) {
          emailVerifiedAt = new Date();
        }

        const upsertedUser = await tx.user.upsert({
          where: { firebaseUid: context.auth!.uid },
          create: {
            firebaseUid: context.auth!.uid,
            email: context.auth!.email,
            emailVerifiedAt,
            status: 'ACTIVE'
          },
          update: {
            email: context.auth!.email,
            emailVerifiedAt
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
    }
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
