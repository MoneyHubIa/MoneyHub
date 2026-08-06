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

  type Profile {
    id: ID!
    fullName: String!
    preferredCurrency: String!
    theme: ProfileTheme!
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
  }

  type Mutation {
    bootstrapProfile(input: BootstrapProfileInput!): BootstrapProfilePayload!
    updateMyProfile(input: UpdateMyProfileInput!): Profile!
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
          // If we are simulating "identity email conflict", it would be handled 
          // implicitly by the unique constraint on email in Prisma if another user has it.
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
