import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GraphQLError } from 'graphql';
import {
  askAiAssistant,
  type AskAiAssistantInput,
  type AiAssistantResponse
} from '../../../../src/modules/ai/service/ai-service.js';
import { typeDefs, resolvers, type GraphQLContext } from '../../../../src/core/graphql/graphql.js';
import {
  MockLlmAdapter,
  LlmAdapterError,
  type LlmAdapter
} from '../../../../src/modules/ai/llm-adapter/ai-llm-adapter.js';
import type { AiContextRepository } from '../../../../src/modules/ai/context-builder/ai-context-builder.js';
import type {
  AiConversationLogger,
  AiConversationAuditEvent
} from '../../../../src/modules/ai/conversation-logging/ai-conversation-logging.js';

function verifiedContext(overrides?: Partial<GraphQLContext>): GraphQLContext {
  return {
    requestId: 'req-srv-1',
    auth: {
      uid: 'firebase-user-1',
      email: 'user@example.com',
      emailVerified: true,
      userId: 'user-uuid-1',
      profileId: 'profile-uuid-1'
    },
    ...overrides
  };
}

function unverifiedContext(): GraphQLContext {
  return {
    requestId: 'req-srv-2',
    auth: {
      uid: 'firebase-user-1',
      email: 'user@example.com',
      emailVerified: false,
      userId: 'user-uuid-1',
      profileId: 'profile-uuid-1'
    }
  };
}

function unauthenticatedContext(): GraphQLContext {
  return {
    requestId: 'req-srv-3',
    auth: null
  };
}

function createMockContextRepository(): AiContextRepository {
  return {
    getUserCurrency: async () => 'BRL',
    getTotals: async () => ({ income: 8000, expenses: 3000 }),
    getTopExpenseCategories: async () => [
      { categoryName: 'Lazer', amount: 1200, color: '#123456', icon: 'smile' }
    ],
    getUpcomingBills: async () => [
      { id: 'b-1', description: 'Luz', amount: 250, dueDate: new Date('2026-08-29') }
    ]
  };
}

describe('AI Assistant Service & Mutation (TASK-033)', () => {
  test('exposes askAiAssistant mutation and types in GraphQL typeDefs', () => {
    assert.match(typeDefs, /type AiAssistantUsage/);
    assert.match(typeDefs, /type AiAssistantResponse/);
    assert.match(typeDefs, /input AskAiAssistantInput/);
    assert.match(typeDefs, /askAiAssistant\(input: AskAiAssistantInput!\): AiAssistantResponse!/);
  });

  test('successfully executes full AI assistant flow with logging', async () => {
    const auditEvents: AiConversationAuditEvent[] = [];
    const mockLogger: AiConversationLogger = {
      log: (evt) => auditEvents.push(evt)
    };

    const mockLlm: LlmAdapter = new MockLlmAdapter({
      defaultResponse: 'Seu saldo atual é de R$ 5000.00 com economia consistente.'
    });

    const input: AskAiAssistantInput = {
      message: 'Como estão meus gastos no mês?',
      month: 8,
      year: 2026,
      templateId: 'MONTHLY_SUMMARY'
    };

    const response: AiAssistantResponse = await askAiAssistant(
      verifiedContext(),
      input,
      {
        contextRepository: createMockContextRepository(),
        llmAdapter: mockLlm,
        logger: mockLogger
      }
    );

    assert.equal(response.answer, 'Seu saldo atual é de R$ 5000.00 com economia consistente.');
    assert.equal(response.provider, 'mock');
    assert.equal(response.model, 'mock-financial-v1');
    assert.equal(response.contextPeriod, '2026-08');
    assert.equal(response.contextVersion, '1.0');
    assert.ok(response.latencyMs >= 0);
    assert.ok(response.usage.totalTokens > 0);

    // Verify audit event was logged
    assert.equal(auditEvents.length, 1);
    const event = auditEvents[0];
    assert.ok(event);
    assert.equal(event.status, 'success');
    if (event.status === 'success') {
      assert.equal(event.userId, 'user-uuid-1');
      assert.equal(event.requestId, 'req-srv-1');
      assert.equal(event.templateId, 'MONTHLY_SUMMARY');
      assert.equal(event.contextPeriod, '2026-08');
      assert.equal(event.contextHash.length, 64);
    }
  });

  test('handles LLM failure gracefully, audits error and throws SERVICE_UNAVAILABLE', async () => {
    const auditEvents: AiConversationAuditEvent[] = [];
    const mockLogger: AiConversationLogger = {
      log: (evt) => auditEvents.push(evt)
    };

    const failingLlm: LlmAdapter = new MockLlmAdapter({
      simulatedError: new LlmAdapterError('Upstream timeout', 'TIMEOUT', true)
    });

    const input: AskAiAssistantInput = {
      message: 'Qual é meu saldo?'
    };

    await assert.rejects(
      () =>
        askAiAssistant(verifiedContext(), input, {
          contextRepository: createMockContextRepository(),
          llmAdapter: failingLlm,
          logger: mockLogger
        }),
      (err: unknown) => {
        assert.ok(err instanceof GraphQLError);
        assert.equal(err.extensions?.code, 'SERVICE_UNAVAILABLE');
        return true;
      }
    );

    assert.equal(auditEvents.length, 1);
    const event = auditEvents[0];
    assert.ok(event);
    assert.equal(event.status, 'error');
    if (event.status === 'error') {
      assert.equal(event.errorCode, 'TIMEOUT');
      assert.equal(event.userId, 'user-uuid-1');
    }
  });

  test('delivers response even if audit logger throws', async () => {
    const throwingLogger: AiConversationLogger = {
      log: () => {
        throw new Error('Logger crashed');
      }
    };

    const response = await askAiAssistant(
      verifiedContext(),
      { message: 'Pergunta válida' },
      {
        contextRepository: createMockContextRepository(),
        logger: throwingLogger
      }
    );

    assert.ok(response.answer.length > 0);
  });

  test('enforces authentication and verified email', async () => {
    await assert.rejects(
      () => askAiAssistant(unauthenticatedContext(), { message: 'Oi' }),
      (err: unknown) => {
        assert.ok(err instanceof GraphQLError);
        assert.equal(err.extensions?.code, 'UNAUTHENTICATED');
        return true;
      }
    );

    await assert.rejects(
      () => askAiAssistant(unverifiedContext(), { message: 'Oi' }),
      (err: unknown) => {
        assert.ok(err instanceof GraphQLError);
        assert.equal(err.extensions?.code, 'EMAIL_NOT_VERIFIED');
        return true;
      }
    );
  });

  test('executes through Apollo resolver', async () => {
    await assert.rejects(
      () => resolvers.Mutation.askAiAssistant({}, { input: { message: 'Oi' } }, unauthenticatedContext()),
      (err: unknown) => {
        assert.ok(err instanceof GraphQLError);
        assert.equal(err.extensions?.code, 'UNAUTHENTICATED');
        return true;
      }
    );
  });

  test('fails fast on invalid message without invoking database repository', async () => {
    const throwingRepo: AiContextRepository = {
      getUserCurrency: async () => {
        throw new Error('Database must not be queried for invalid message');
      },
      getTotals: async () => {
        throw new Error('Database must not be queried for invalid message');
      },
      getTopExpenseCategories: async () => {
        throw new Error('Database must not be queried for invalid message');
      },
      getUpcomingBills: async () => {
        throw new Error('Database must not be queried for invalid message');
      }
    };

    await assert.rejects(
      () => askAiAssistant(verifiedContext(), { message: '   ' }, { contextRepository: throwingRepo }),
      (err: unknown) => {
        assert.ok(err instanceof GraphQLError);
        assert.equal(err.extensions?.code, 'BAD_USER_INPUT');
        return true;
      }
    );
  });

  test('normalizes unknown templateId in audit event to GENERAL_FINANCIAL_ASSISTANT', async () => {
    const auditEvents: AiConversationAuditEvent[] = [];
    const mockLogger: AiConversationLogger = {
      log: (evt) => auditEvents.push(evt)
    };

    await askAiAssistant(
      verifiedContext(),
      { message: 'Qual o saldo?', templateId: 'INVALID_UNKNOWN_TEMPLATE' },
      {
        contextRepository: createMockContextRepository(),
        logger: mockLogger
      }
    );

    assert.equal(auditEvents.length, 1);
    const event = auditEvents[0];
    assert.ok(event);
    if (event.status === 'success') {
      assert.equal(event.templateId, 'GENERAL_FINANCIAL_ASSISTANT');
    }
  });

  test('executes tool calling loop when LLM requests tools', async () => {
    let callCount = 0;
    const toolCallingLlm: LlmAdapter = new MockLlmAdapter({
      customResponder: (_prompt, options) => {
        callCount++;
        if (callCount === 1) {
          return {
            content: '',
            toolCalls: [
              {
                id: 'call-1',
                type: 'function',
                function: {
                  name: 'get_financial_summary',
                  arguments: '{"startDate":"2025-01-01","endDate":"2025-12-31"}'
                }
              }
            ]
          };
        }

        const toolMessage = options?.messages?.find((m) => m.role === 'tool');
        assert.ok(toolMessage);
        assert.ok(toolMessage.content?.includes('5000.00'));

        return 'Em 2025 você teve um total de receitas de R$ 5.000,00.';
      }
    });

    const response = await askAiAssistant(
      verifiedContext(),
      { message: 'Como foi meu ano de 2025?' },
      {
        contextRepository: createMockContextRepository(),
        llmAdapter: toolCallingLlm
      }
    );

    assert.equal(callCount, 2);
    assert.equal(response.answer, 'Em 2025 você teve um total de receitas de R$ 5.000,00.');
  });
});

