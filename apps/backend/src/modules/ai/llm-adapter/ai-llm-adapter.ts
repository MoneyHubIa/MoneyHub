import type { FormattedAiPrompt } from '../prompt-registry/ai-prompt-registry.js';

export type LlmToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

export type LlmMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: LlmToolCall[];
  tool_call_id?: string;
  name?: string;
};

export type LlmToolProperty = {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
};

export type LlmToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, LlmToolProperty>;
      required?: string[];
    };
  };
};

export type LlmExecutionOptions = {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  tools?: LlmToolDefinition[];
  messages?: LlmMessage[];
};

export type LlmUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type LlmFinishReason =
  | 'stop'
  | 'length'
  | 'tool_calls'
  | 'content_filter'
  | 'error';

export type LlmResponse = {
  content: string;
  provider: string;
  model: string;
  finishReason: LlmFinishReason;
  usage: LlmUsage;
  latencyMs: number;
  toolCalls?: LlmToolCall[];
};

export interface LlmAdapter {
  readonly provider: string;
  generateResponse(
    prompt: FormattedAiPrompt,
    options?: LlmExecutionOptions
  ): Promise<LlmResponse>;
}

export type LlmErrorCode =
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'PROVIDER_ERROR'
  | 'UNAVAILABLE';

export class LlmAdapterError extends Error {
  readonly code: LlmErrorCode;
  readonly isRetryable: boolean;

  constructor(message: string, code: LlmErrorCode, isRetryable = false) {
    super(message);
    this.name = 'LlmAdapterError';
    this.code = code;
    this.isRetryable = isRetryable;
  }
}

export type MockCustomResponse =
  | string
  | { content: string; toolCalls?: LlmToolCall[] };

export type MockLlmOptions = {
  defaultResponse?: string;
  latencyMs?: number;
  simulatedError?: LlmAdapterError;
  customResponder?: (
    prompt: FormattedAiPrompt,
    options?: LlmExecutionOptions
  ) => MockCustomResponse;
};

export class MockLlmAdapter implements LlmAdapter {
  readonly provider = 'mock';
  private readonly options: MockLlmOptions;

  constructor(options: MockLlmOptions = {}) {
    this.options = options;
  }

  async generateResponse(
    prompt: FormattedAiPrompt,
    options?: LlmExecutionOptions
  ): Promise<LlmResponse> {
    const startTime = Date.now();

    if (this.options.simulatedError) {
      throw this.options.simulatedError;
    }

    if (this.options.latencyMs && this.options.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.options.latencyMs));
    }

    let content = '';
    let toolCalls: LlmToolCall[] | undefined;
    let finishReason: LlmFinishReason = 'stop';

    if (this.options.customResponder) {
      const res = this.options.customResponder(prompt, options);
      if (typeof res === 'string') {
        content = res;
      } else {
        content = res.content;
        toolCalls = res.toolCalls;
        if (toolCalls && toolCalls.length > 0) {
          finishReason = 'tool_calls';
        }
      }
    } else if (this.options.defaultResponse) {
      content = this.options.defaultResponse;
    } else {
      content = this.buildContextualResponse(prompt);
    }

    const latencyMs = Date.now() - startTime;
    const promptTokens = Math.max(1, Math.ceil(prompt.userPrompt.length / 4));
    const completionTokens = Math.max(1, Math.ceil(content.length / 4));

    return {
      content,
      provider: this.provider,
      model: 'mock-financial-v1',
      finishReason,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      },
      latencyMs,
      ...(toolCalls ? { toolCalls } : {})
    };
  }

  private buildContextualResponse(prompt: FormattedAiPrompt): string {
    const userPrompt = prompt.userPrompt;

    // Extract balance if present in the prompt
    const balanceMatch = userPrompt.match(/Saldo:\s*([^\r\n]+)/i);
    const balance = balanceMatch ? balanceMatch[1]?.trim() : '0.00';

    const currencyMatch = userPrompt.match(/Moeda:\s*([A-Z]{3})/i);
    const currency = currencyMatch ? currencyMatch[1]?.trim() : 'BRL';
    const symbol = currency === 'BRL' ? 'R$' : currency;

    return (
      `Olá! Analisando seu contexto financeiro no MoneyHub, verifiquei que seu saldo líquido atual no período é de ${symbol} ${balance}. ` +
      `Se precisar de detalhes sobre suas principais despesas ou contas a pagar agendadas, estou à disposição para ajudar no seu planejamento!`
    );
  }
}

export type OpenAiCompatibleOptions = {
  apiKey: string;
  baseUrl?: string | undefined;
  model?: string | undefined;
  timeoutMs?: number | undefined;
  fetchFn?: typeof fetch | undefined;
};

export class OpenAiCompatibleLlmAdapter implements LlmAdapter {
  readonly provider = 'openai';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly defaultTimeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: OpenAiCompatibleOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
    this.model = options.model ?? 'gpt-4o-mini';
    this.defaultTimeoutMs =
      options.timeoutMs ??
      (process.env.LLM_TIMEOUT_MS ? Number(process.env.LLM_TIMEOUT_MS) : 120000);
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  async generateResponse(
    prompt: FormattedAiPrompt,
    options?: LlmExecutionOptions
  ): Promise<LlmResponse> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const messages = options?.messages ?? [
      { role: 'system', content: prompt.systemPrompt },
      { role: 'user', content: prompt.userPrompt }
    ];

    const payload: {
      model: string;
      messages: LlmMessage[];
      temperature: number;
      max_tokens: number;
      tools?: LlmToolDefinition[];
    } = {
      model: this.model,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 600
    };

    if (options?.tools && options.tools.length > 0) {
      payload.tools = options.tools;
    }

    try {
      const response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch {
          errorBody = 'Unable to read error body';
        }

        // Redact API key from error body
        const safeBody = errorBody.split(this.apiKey).join('[REDACTED_API_KEY]');

        if (response.status === 429) {
          throw new LlmAdapterError(
            `Rate limit exceeded: ${safeBody}`,
            'RATE_LIMIT',
            true
          );
        }

        if (response.status >= 500) {
          throw new LlmAdapterError(
            `Provider error (${response.status}): ${safeBody}`,
            'PROVIDER_ERROR',
            true
          );
        }

        throw new LlmAdapterError(
          `LLM provider rejected request with status ${response.status}: ${safeBody}`,
          'PROVIDER_ERROR',
          false
        );
      }

      type ChatCompletionChoice = {
        message?: {
          content?: string | null;
          tool_calls?: LlmToolCall[];
        };
        finish_reason?: string;
      };

      type ChatCompletionJson = {
        choices?: ChatCompletionChoice[];
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      const data = (await response.json()) as ChatCompletionJson;
      const choice = data.choices?.[0];
      const content = choice?.message?.content ?? '';
      const toolCalls = choice?.message?.tool_calls;
      const finishReason =
        (choice?.finish_reason as LlmFinishReason) ??
        (toolCalls && toolCalls.length > 0 ? 'tool_calls' : 'stop');

      const promptTokens =
        data.usage?.prompt_tokens ?? Math.max(1, Math.ceil(prompt.userPrompt.length / 4));
      const completionTokens =
        data.usage?.completion_tokens ?? Math.max(1, Math.ceil(content.length / 4));
      const totalTokens =
        data.usage?.total_tokens ?? promptTokens + completionTokens;

      const usage: LlmUsage = {
        promptTokens,
        completionTokens,
        totalTokens
      };

      const latencyMs = Date.now() - startTime;

      return {
        content,
        provider: this.provider,
        model: this.model,
        finishReason,
        usage,
        latencyMs,
        ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {})
      };
    } catch (err: unknown) {
      if (err instanceof LlmAdapterError) {
        throw err;
      }

      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new LlmAdapterError(
          `Request to LLM provider timed out after ${timeoutMs}ms`,
          'TIMEOUT',
          true
        );
      }

      const rawMessage = err instanceof Error ? err.message : String(err);
      const safeMessage = rawMessage.split(this.apiKey).join('[REDACTED_API_KEY]');

      throw new LlmAdapterError(
        `LLM provider network error: ${safeMessage}`,
        'UNAVAILABLE',
        true
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export type LlmConfig = {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

export function createLlmAdapter(config?: LlmConfig): LlmAdapter {
  const provider = (config?.provider ?? process.env.LLM_PROVIDER ?? 'mock').toLowerCase();
  const apiKey = config?.apiKey ?? process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
  const baseUrl = config?.baseUrl ?? process.env.LLM_BASE_URL;

  const isOpenAiCompatible =
    provider === 'openai' ||
    provider === 'openai-compatible' ||
    provider === 'groq' ||
    provider === 'ollama' ||
    provider === 'deepseek' ||
    provider === 'gemini' ||
    Boolean(baseUrl);

  if (isOpenAiCompatible && (apiKey.trim() || baseUrl)) {
    return new OpenAiCompatibleLlmAdapter({
      apiKey: apiKey.trim() || 'local-development-key',
      model: config?.model ?? process.env.LLM_MODEL,
      baseUrl
    });
  }

  return new MockLlmAdapter();
}
