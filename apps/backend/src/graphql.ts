import { GraphQLError } from 'graphql';
import type { AuthContext } from './auth.js';
import { getPrismaClient } from './database.js';

export type GraphQLContext = {
  requestId: string;
  auth: AuthContext | null;
};

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

  type BootstrapProfilePayload {
    user: AuthUser!
    profile: Profile!
    created: Boolean!
  }

  type Query {
    health: Health!
    me: AuthUser
  }

  type Mutation {
    bootstrapProfile(input: BootstrapProfileInput!): BootstrapProfilePayload!
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
    }
  },
  Mutation: {
    bootstrapProfile: async (_parent: unknown, args: { input: any }, context: GraphQLContext) => {
      if (!context.auth) throw unauthenticatedError();
      const { input } = args;

      if (!input.fullName?.trim()) {
        throw new GraphQLError('Full name is required', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      const prisma = getPrismaClient();

      return prisma.$transaction(async (tx) => {
        let existingUser = await tx.user.findUnique({ where: { firebaseUid: context.auth!.uid } });
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
