import { createHash } from 'node:crypto';
import type { AiFinancialContext } from './ai-context-builder.js';
import { appLogger } from './http-logger.js';

export type AiConversationSuccessEvent = Readonly<{
  event: 'ai_conversation_completed';
  userId: string;
  requestId: string;
  templateId: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  contextVersion: string;
  contextPeriod: string;
  contextHash: string;
  status: 'success';
}>;

export type AiConversationErrorEvent = Readonly<{
  event: 'ai_conversation_failed';
  userId?: string | undefined;
  requestId: string;
  templateId?: string | undefined;
  provider?: string | undefined;
  latencyMs: number;
  status: 'error';
  errorCode: string;
}>;

export type AiConversationAuditEvent = AiConversationSuccessEvent | AiConversationErrorEvent;

export interface AiConversationLogger {
  log(event: AiConversationAuditEvent): void;
}

export type AiLogSink = {
  info(event: AiConversationSuccessEvent): void;
  error(event: AiConversationErrorEvent): void;
};

export function hashContext(context: AiFinancialContext): string {
  const normalized = JSON.stringify({
    period: context.period,
    currency: context.currency,
    totals: context.totals,
    topCategories: context.topExpenseCategories.map((c) => ({
      name: c.categoryName,
      amount: c.amount
    })),
    upcomingBills: context.upcomingBills.map((b) => ({
      desc: b.description,
      amount: b.amount,
      due: b.dueDate
    }))
  });

  return createHash('sha256').update(normalized).digest('hex');
}

export function createAiConversationLogger(sink: AiLogSink): AiConversationLogger {
  return {
    log(event: AiConversationAuditEvent): void {
      try {
        if (event.status === 'success') {
          sink.info(event);
        } else {
          sink.error(event);
        }
      } catch {
        // Logging must never throw or disrupt the caller
      }
    }
  };
}

export const defaultAiConversationLogger: AiConversationLogger = createAiConversationLogger({
  info(event: AiConversationSuccessEvent) {
    appLogger.info(event);
  },
  error(event: AiConversationErrorEvent) {
    appLogger.error(event);
  }
});
