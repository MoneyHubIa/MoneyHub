import { GraphQLError } from 'graphql';
import type { AuthContext } from './auth.js';
import { getPrismaClient } from './database.js';
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
  type CostCenter,
  type CostCenterRepository,
  type CreateCostCenterInput,
  type UpdateCostCenterInput
} from './cost-centers.js';

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

  type Query {
    health: Health!
    me: AuthUser
    myProfile: Profile!
    myCategories(type: CategoryType): [FinancialCategory!]!
    myCostCenters: [CostCenter!]!
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
