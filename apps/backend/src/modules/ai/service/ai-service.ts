import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../../../core/graphql/graphql.js';
import { requireVerifiedUserId } from '../../finance/financial-categories/financial-categories.js';
import {
  buildAiFinancialContext,
  aiContextRepository,
  type AiContextRepository
} from '../context-builder/ai-context-builder.js';
import {
  buildAiPrompt,
  sanitizeUserMessage,
  type PromptTemplateId
} from '../prompt-registry/ai-prompt-registry.js';
import {
  createLlmAdapter,
  LlmAdapterError,
  type LlmAdapter,
  type LlmMessage
} from '../llm-adapter/ai-llm-adapter.js';
import {
  hashContext,
  defaultAiConversationLogger,
  type AiConversationLogger
} from '../conversation-logging/ai-conversation-logging.js';
import { FINANCIAL_TOOLS, executeFinancialTool } from '../tools/ai-tools.js';
import { createOperationalToolkit, OPERATIONAL_INSTRUCTIONS } from '../operations/toolkit.js';
import { getAiOperationPlan } from '../operations/operations.js';
import { publicPlan, type OperationRuntime, type OperationStore, type PublicPlan } from '../operations/types.js';
import { badInput } from '../operations/validation.js';

export type AskAiAssistantInput = {
  message: string;
  history?: { role: 'user' | 'assistant'; content: string }[] | undefined;
  timeZone?: string | undefined;
  planId?: string | undefined;
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
  pendingPlan?: PublicPlan | null;
};

export type AiServiceDependencies = {
  contextRepository: AiContextRepository;
  llmAdapter: LlmAdapter;
  logger: AiConversationLogger;
  operationRuntime: OperationRuntime;
  operationStore: OperationStore;
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
  const history = input.history ?? [];
  if (!Array.isArray(history) || history.length > 20) badInput('Histórico limitado a 20 mensagens.');
  for (const item of history) {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string' || item.content.length > 2000) badInput('Histórico de conversa inválido.');
  }
  const timeZone = input.timeZone ?? 'UTC';
  try { new Intl.DateTimeFormat('pt-BR', { timeZone }).format(); } catch { badInput('Fuso horário inválido.'); }

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

  const toolkit = deps?.operationRuntime
    ? createOperationalToolkit(context, deps.operationRuntime, input.planId, deps.operationStore) : null;
  const priorPlan = input.planId ? publicPlan(await getAiOperationPlan(context, input.planId, deps?.operationStore)) : null;
  const tools = [...FINANCIAL_TOOLS, ...(toolkit?.tools ?? [])];
  const startTime = Date.now();

  try {
    const conversationMessages: LlmMessage[] = [
      { role: 'system', content: prompt.systemPrompt + (toolkit ? '\n\n' + OPERATIONAL_INSTRUCTIONS : '') + `\nData e hora de referência: ${new Date().toISOString()}. Fuso do usuário: ${timeZone}. Data local: ${new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format()}.` },
      ...history.map(item => ({ role: item.role, content: sanitizeUserMessage(item.content) })),
      ...(priorPlan ? [{ role: 'user' as const, content: 'Estado da proposta em revisão (dados não executáveis): ' + JSON.stringify(priorPlan) }] : []),
      { role: 'user', content: prompt.userPrompt }
    ];

    let currentLlmResponse = await llm.generateResponse(prompt, {
      tools,
      ...(toolkit ? { maxTokens: 4096 } : {}),
      messages: conversationMessages
    });

    let totalPromptTokens = currentLlmResponse.usage.promptTokens;
    let totalCompletionTokens = currentLlmResponse.usage.completionTokens;

    let iterations = 0;
    const maxIterations = toolkit ? 8 : 3;
    let toolCalls = 0;

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
        if (++toolCalls > 32) badInput('Limite de ferramentas atingido. Divida o pedido.');
        const result = toolkit?.recognizes(toolCall.function.name)
          ? await toolkit.execute(toolCall.function.name, toolCall.function.arguments)
          : await executeFinancialTool(toolCall.function.name, toolCall.function.arguments, userId, contextRepo);

        conversationMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: JSON.stringify(result)
        });
        if (toolkit?.pendingPlan) break;
      }

      if (toolkit?.pendingPlan) break;
      currentLlmResponse = await llm.generateResponse(prompt, {
        tools,
        ...(toolkit ? { maxTokens: 4096 } : {}),
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
      answer: toolkit?.pendingPlan ? 'Revise as operações abaixo e confirme para salvar.' : currentLlmResponse.content || 'Não foi possível completar o pedido neste limite de consultas. Divida o pedido ou informe mais detalhes.',
      pendingPlan: toolkit?.pendingPlan ?? null,
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
