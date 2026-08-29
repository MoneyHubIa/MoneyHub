import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  hashContext,
  createAiConversationLogger,
  type AiConversationSuccessEvent,
  type AiConversationErrorEvent,
  type AiConversationAuditEvent
} from '../src/ai-conversation-logging.js';
import type { AiFinancialContext } from '../src/ai-context-builder.js';

function createSampleContext(): AiFinancialContext {
  return {
    version: '1.0',
    period: '2026-08',
    currency: 'BRL',
    generatedAt: '2026-08-28T21:00:00.000Z',
    totals: {
      income: '12500.00',
      expenses: '4500.00',
      balance: '8000.00'
    },
    topExpenseCategories: [
      {
        categoryName: 'Alimentação',
        amount: '2000.00',
        percentage: 44.44
      }
    ],
    upcomingBills: [
      {
        id: 'bill-1',
        description: 'Condomínio',
        amount: '800.00',
        dueDate: '2026-08-30'
      }
    ],
    goals: []
  };
}

describe('AI Conversation Logging (TASK-033)', () => {
  test('generates deterministic SHA-256 hash for context', () => {
    const context = createSampleContext();
    const hash1 = hashContext(context);
    const hash2 = hashContext(context);

    assert.equal(typeof hash1, 'string');
    assert.equal(hash1.length, 64); // SHA-256 hex length
    assert.equal(hash1, hash2);

    const changedContext = {
      ...context,
      totals: { ...context.totals, income: '99999.00' }
    };
    const hashChanged = hashContext(changedContext);
    assert.notEqual(hash1, hashChanged);
  });

  test('logs success event with structured audit payload', () => {
    const loggedEvents: AiConversationAuditEvent[] = [];
    const logger = createAiConversationLogger({
      info: (evt) => loggedEvents.push(evt),
      error: () => assert.fail('should not call error on success')
    });

    const successEvent: AiConversationSuccessEvent = {
      event: 'ai_conversation_completed',
      userId: 'user-123',
      requestId: 'req-abc',
      templateId: 'GENERAL_FINANCIAL_ASSISTANT',
      provider: 'mock',
      model: 'mock-financial-v1',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      latencyMs: 45,
      contextVersion: '1.0',
      contextPeriod: '2026-08',
      contextHash: 'a'.repeat(64),
      status: 'success'
    };

    logger.log(successEvent);

    assert.equal(loggedEvents.length, 1);
    assert.deepEqual(loggedEvents[0], successEvent);
  });

  test('logs error event with structured audit payload', () => {
    const loggedEvents: AiConversationAuditEvent[] = [];
    const logger = createAiConversationLogger({
      info: () => assert.fail('should not call info on error'),
      error: (evt) => loggedEvents.push(evt)
    });

    const errorEvent: AiConversationErrorEvent = {
      event: 'ai_conversation_failed',
      userId: 'user-123',
      requestId: 'req-abc',
      templateId: 'GENERAL_FINANCIAL_ASSISTANT',
      provider: 'mock',
      latencyMs: 120,
      status: 'error',
      errorCode: 'TIMEOUT'
    };

    logger.log(errorEvent);

    assert.equal(loggedEvents.length, 1);
    assert.deepEqual(loggedEvents[0], errorEvent);
  });

  test('swallows logger errors gracefully without throwing', () => {
    const throwingLogger = createAiConversationLogger({
      info: () => {
        throw new Error('Disk full or logger failed');
      },
      error: () => {
        throw new Error('Logger crashed');
      }
    });

    assert.doesNotThrow(() => {
      throwingLogger.log({
        event: 'ai_conversation_completed',
        userId: 'user-123',
        requestId: 'req-abc',
        templateId: 'GENERAL_FINANCIAL_ASSISTANT',
        provider: 'mock',
        model: 'mock-financial-v1',
        promptTokens: 10,
        completionTokens: 10,
        totalTokens: 20,
        latencyMs: 15,
        contextVersion: '1.0',
        contextPeriod: '2026-08',
        contextHash: 'abc',
        status: 'success'
      });
    });

    assert.doesNotThrow(() => {
      throwingLogger.log({
        event: 'ai_conversation_failed',
        requestId: 'req-abc',
        latencyMs: 10,
        status: 'error',
        errorCode: 'UNAVAILABLE'
      });
    });
  });
});
