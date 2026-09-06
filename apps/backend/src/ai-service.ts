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
  sanitizeUserMessage,
  type PromptTemplateId
} from './ai-prompt-registry.js';
import {
  createLlmAdapter,
  LlmAdapterError,
  type LlmAdapter,
  type LlmMessage
} from './ai-llm-adapter.js';
import {
  hashContext,
  defaultAiConversationLogger,
  type AiConversationLogger
} from './ai-conversation-logging.js';
import { FINANCIAL_TOOLS, executeFinancialTool } from './ai-tools.js';

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

const VALID_TEMPLATES: ReadonlySet<string> = new Set([
  'GENERAL_FINANCIAL_ASSISTANT',
  'MONTHLY_SUMMARY',
  'EXPENSE_OPTIMIZATION'
]);

export async function askAiAssistant(
  context: GraphQLContext,
  input: AskAiAssistantInput,
  deps?: Partial<AiServiceDependencies>
): Promise<AiAssistantResponse> {
  const userId = requireVerifiedUserId(context);
  const requestId = context.requestId;

  // Fail-fast: validate message before running database queries
  const sanitizedMessage = sanitizeUserMessage(input.message);

  const templateId: PromptTemplateId =
    input.templateId && VALID_TEMPLATES.has(input.templateId)
      ? (input.templateId as PromptTemplateId)
      : 'GENERAL_FINANCIAL_ASSISTANT';

  const contextRepo = deps?.contextRepository ?? aiContextRepository();
  const llm = deps?.llmAdapter ?? createLlmAdapter();
  const logger = deps?.logger ?? defaultAiConversationLogger;

  const aiContext = await buildAiFinancialContext(
    context,
    { month: input.month, year: input.year },
    contextRepo
  );

  const contextHash = hashContext(aiContext);

  const prompt = buildAiPrompt({
    context: aiContext,
    userMessage: sanitizedMessage,
    templateId
  });

  const startTime = Date.now();

  try {
    const conversationMessages: LlmMessage[] = [
      { role: 'system', content: prompt.systemPrompt },
      { role: 'user', content: prompt.userPrompt }
    ];

    let currentLlmResponse = await llm.generateResponse(prompt, {
      tools: FINANCIAL_TOOLS,
      messages: conversationMessages
    });

    let totalPromptTokens = currentLlmResponse.usage.promptTokens;
    let totalCompletionTokens = currentLlmResponse.usage.completionTokens;

    let iterations = 0;
    const maxIterations = 3;

    while (
      currentLlmResponse.toolCalls &&
      currentLlmResponse.toolCalls.length > 0 &&
      iterations < maxIterations
    ) {
      iterations++;

      conversationMessages.push({
        role: 'assistant',
        content: currentLlmResponse.content || null,
        tool_calls: currentLlmResponse.toolCalls
      });

      for (const toolCall of currentLlmResponse.toolCalls) {
        const result = await executeFinancialTool(
          toolCall.function.name,
          toolCall.function.arguments,
          userId,
          contextRepo
        );

        conversationMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: JSON.stringify(result)
        });
      }

      currentLlmResponse = await llm.generateResponse(prompt, {
        tools: FINANCIAL_TOOLS,
        messages: conversationMessages
      });

      totalPromptTokens += currentLlmResponse.usage.promptTokens;
      totalCompletionTokens += currentLlmResponse.usage.completionTokens;
    }

    const latencyMs = Date.now() - startTime;
    const totalTokens = totalPromptTokens + totalCompletionTokens;

    try {
      logger.log({
        event: 'ai_conversation_completed',
        userId,
        requestId,
        templateId,
        provider: currentLlmResponse.provider,
        model: currentLlmResponse.model,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens,
        latencyMs,
        contextVersion: aiContext.version,
        contextPeriod: aiContext.period,
        contextHash,
        status: 'success'
      });
    } catch {
      // Logging failure must never disrupt response delivery
    }

    return {
      answer: currentLlmResponse.content,
      provider: currentLlmResponse.provider,
      model: currentLlmResponse.model,
      latencyMs,
      usage: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens
      },
      contextPeriod: aiContext.period,
      contextVersion: aiContext.version
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorCode = err instanceof LlmAdapterError ? err.code : 'UNKNOWN_ERROR';
    console.error('[AI SERVICE ERROR]', err);

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
