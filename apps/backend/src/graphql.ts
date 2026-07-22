import { GraphQLError } from 'graphql';
import type { AuthContext } from './auth.js';

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

  type AuthUser {
    id: ID!
    email: String!
    emailVerified: Boolean!
  }

  type Query {
    health: Health!
    me: AuthUser
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
