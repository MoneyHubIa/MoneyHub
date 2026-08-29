import { GraphQLError } from 'graphql';
import type { GraphQLContext } from './graphql.js';
import { requireVerifiedUserId } from './financial-categories.js';
import {
  buildAiFinancialContext,
  aiContextRepository,
  type AiContextRepository
} from './ai-context-builder.js';
import {
  buildAiPrompt,
  type PromptTemplateId
} from './ai-prompt-registry.js';
import {
  createLlmAdapter,
  LlmAdapterError,
  type LlmAdapter
} from './ai-llm-adapter.js';
import {
  hashContext,
  defaultAiConversationLogger,
  type AiConversationLogger
} from './ai-conversation-logging.js';

export type AskAiAssistantInput = {
  message: string;
  month?: number | undefined;
  year?: number | undefined;
  templateId?: PromptTemplateId | string | undefined;
};

export type AiAssistantUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type AiAssistantResponse = {
  answer: string;
  provider: string;
  model: string;
  latencyMs: number;
  usage: AiAssistantUsage;
  contextPeriod: string;
  contextVersion: string;
};

export type AiServiceDependencies = {
  contextRepository: AiContextRepository;
  llmAdapter: LlmAdapter;
  logger: AiConversationLogger;
};

export async function askAiAssistant(
  context: GraphQLContext,
  input: AskAiAssistantInput,
  deps?: Partial<AiServiceDependencies>
): Promise<AiAssistantResponse> {
  const userId = requireVerifiedUserId(context);
  const requestId = context.requestId;

  const contextRepo = deps?.contextRepository ?? aiContextRepository();
  const llm = deps?.llmAdapter ?? createLlmAdapter();
  const logger = deps?.logger ?? defaultAiConversationLogger;

  const aiContext = await buildAiFinancialContext(
    context,
    { month: input.month, year: input.year },
    contextRepo
  );

  const contextHash = hashContext(aiContext);

  const templateId = (input.templateId as PromptTemplateId) ?? 'GENERAL_FINANCIAL_ASSISTANT';

  const prompt = buildAiPrompt({
    context: aiContext,
    userMessage: input.message,
    templateId
  });

  const startTime = Date.now();

  try {
    const llmResponse = await llm.generateResponse(prompt);

    try {
      logger.log({
        event: 'ai_conversation_completed',
        userId,
        requestId,
        templateId,
        provider: llmResponse.provider,
        model: llmResponse.model,
        promptTokens: llmResponse.usage.promptTokens,
        completionTokens: llmResponse.usage.completionTokens,
        totalTokens: llmResponse.usage.totalTokens,
        latencyMs: llmResponse.latencyMs,
        contextVersion: aiContext.version,
        contextPeriod: aiContext.period,
        contextHash,
        status: 'success'
      });
    } catch {
      // Logging failure must never disrupt response delivery
    }

    return {
      answer: llmResponse.content,
      provider: llmResponse.provider,
      model: llmResponse.model,
      latencyMs: llmResponse.latencyMs,
      usage: llmResponse.usage,
      contextPeriod: aiContext.period,
      contextVersion: aiContext.version
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorCode = err instanceof LlmAdapterError ? err.code : 'UNKNOWN_ERROR';

    try {
      logger.log({
        event: 'ai_conversation_failed',
        userId,
        requestId,
        templateId,
        provider: llm.provider,
        latencyMs,
        status: 'error',
        errorCode
      });
    } catch {
      // Swallowed safely
    }

    throw new GraphQLError('AI assistant is currently unavailable.', {
      extensions: { code: 'SERVICE_UNAVAILABLE' }
    });
  }
}
