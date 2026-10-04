import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSchema, graphql } from 'graphql';
import { typeDefs, resolvers } from '../../../../src/core/graphql/graphql.js';

test('GraphQL goals contract uses string money, history pagination and authorization', async () => {
  const schema = buildSchema(typeDefs);
  assert.ok(schema.getType('FinancialGoal'));
  assert.ok(schema.getQueryType()?.getFields().financialGoalsSummary);
  assert.ok(schema.getMutationType()?.getFields().recordFinancialGoalMovement);
  const result = await graphql({ schema, source: '{ myFinancialGoals { id targetAmount movements { nodes { amount } hasNextPage endCursor } } }',
    rootValue: { myFinancialGoals: () => resolvers.Query.myFinancialGoals({}, {}, { requestId: 'test', auth: null }) } });
  assert.equal(result.errors?.[0]?.extensions.code, 'UNAUTHENTICATED');
});
