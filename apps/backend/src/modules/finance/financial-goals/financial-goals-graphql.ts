
import type { GraphQLContext } from '../../../core/graphql/graphql.js';
import {
  createFinancialGoal, updateFinancialGoal, deleteFinancialGoal, recordFinancialGoalMovement,
  listMyFinancialGoals, getFinancialGoal, getFinancialGoalMovements, getFinancialGoalsSummary,
  financialGoalStatus, financialGoalProgress, financialGoalRemaining,
  type FinancialGoal, type FinancialGoalMovement, type CreateFinancialGoalInput,
  type UpdateFinancialGoalInput, type RecordFinancialGoalMovementInput
} from './financial-goals.js';
import { financialGoalsRepository } from './financial-goals-repository.js';

export const financialGoalsTypeDefs = `#graphql
  enum FinancialGoalStatus { ACTIVE COMPLETED OVERDUE }
  enum FinancialGoalMovementType { CONTRIBUTION WITHDRAWAL }
  type FinancialGoal {
    id: ID!
    name: String!
    description: String
    targetAmount: String!
    accumulatedAmount: String!
    remainingAmount: String!
    progress: Float!
    status: FinancialGoalStatus!
    startDate: String!
    deadline: String!
    createdAt: String!
    updatedAt: String!
    movements(after: ID): FinancialGoalMovementPage!
  }
  type FinancialGoalMovement {
    id: ID!
    type: FinancialGoalMovementType!
    amount: String!
    occurredOn: String!
    notes: String
    operationId: ID!
    createdAt: String!
  }
  type FinancialGoalMovementPage {
    nodes: [FinancialGoalMovement!]!
    hasNextPage: Boolean!
    endCursor: ID
  }
  type FinancialGoalsSummary {
    count: Int!
    activeCount: Int!
    completedCount: Int!
    overdueCount: Int!
    totalAccumulated: String!
    totalTarget: String!
  }
  input CreateFinancialGoalInput {
    name: String!
    description: String
    targetAmount: String!
    startDate: String!
    deadline: String!
  }
  input UpdateFinancialGoalInput {
    id: ID!
    name: String
    description: String
    targetAmount: String
    startDate: String
    deadline: String
  }
  input RecordFinancialGoalMovementInput {
    goalId: ID!
    type: FinancialGoalMovementType!
    amount: String!
    occurredOn: String!
    notes: String
    operationId: ID!
  }
  extend type Query {
    myFinancialGoals: [FinancialGoal!]!
    financialGoal(id: ID!): FinancialGoal!
    financialGoalsSummary: FinancialGoalsSummary!
  }
  extend type Mutation {
    createFinancialGoal(input: CreateFinancialGoalInput!): FinancialGoal!
    updateFinancialGoal(input: UpdateFinancialGoalInput!): FinancialGoal!
    deleteFinancialGoal(id: ID!): Boolean!
    recordFinancialGoalMovement(input: RecordFinancialGoalMovementInput!): FinancialGoal!
  }
`;

export const financialGoalsResolvers = {
  Query: {
    myFinancialGoals: (_: unknown, _args: unknown, context: GraphQLContext) =>
      listMyFinancialGoals(context, financialGoalsRepository()),
    financialGoal: (_: unknown, args: { id: string }, context: GraphQLContext) =>
      getFinancialGoal(context, args.id, financialGoalsRepository()),
    financialGoalsSummary: (_: unknown, _args: unknown, context: GraphQLContext) =>
      getFinancialGoalsSummary(context, financialGoalsRepository())
  },
  Mutation: {
    createFinancialGoal: (_: unknown, args: { input: CreateFinancialGoalInput }, context: GraphQLContext) =>
      createFinancialGoal(context, args.input, financialGoalsRepository()),
    updateFinancialGoal: (_: unknown, args: { input: UpdateFinancialGoalInput }, context: GraphQLContext) =>
      updateFinancialGoal(context, args.input, financialGoalsRepository()),
    deleteFinancialGoal: (_: unknown, args: { id: string }, context: GraphQLContext) =>
      deleteFinancialGoal(context, args.id, financialGoalsRepository()),
    recordFinancialGoalMovement: (_: unknown, args: { input: RecordFinancialGoalMovementInput }, context: GraphQLContext) =>
      recordFinancialGoalMovement(context, args.input, financialGoalsRepository())
  },
  FinancialGoal: {
    status: (goal: FinancialGoal) => financialGoalStatus(goal),
    progress: (goal: FinancialGoal) => financialGoalProgress(goal),
    remainingAmount: (goal: FinancialGoal) => financialGoalRemaining(goal),
    startDate: (goal: FinancialGoal) => goal.startDate.toISOString().slice(0, 10),
    deadline: (goal: FinancialGoal) => goal.deadline.toISOString().slice(0, 10),
    createdAt: (goal: FinancialGoal) => goal.createdAt.toISOString(),
    updatedAt: (goal: FinancialGoal) => goal.updatedAt.toISOString(),
    movements: (goal: FinancialGoal, args: { after?: string }, context: GraphQLContext) =>
      getFinancialGoalMovements(context, goal.id, args.after, financialGoalsRepository())
  },
  FinancialGoalMovement: {
    occurredOn: (movement: FinancialGoalMovement) => movement.occurredOn.toISOString().slice(0, 10),
    createdAt: (movement: FinancialGoalMovement) => movement.createdAt.toISOString()
  }
};
