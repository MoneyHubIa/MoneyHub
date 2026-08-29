import type { FormattedAiPrompt } from './ai-prompt-registry.js';

export type LlmExecutionOptions = {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
};

export type LlmUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type LlmFinishReason = 'stop' | 'length' | 'content_filter' | 'error';

export type LlmResponse = {
  content: string;
  provider: string;
  model: string;
  finishReason: LlmFinishReason;
  usage: LlmUsage;
  latencyMs: number;
};

export interface LlmAdapter {
  readonly provider: string;
  generateResponse(
    prompt: FormattedAiPrompt,
    options?: LlmExecutionOptions
  ): Promise<LlmResponse>;
}

export type LlmErrorCode = 'TIMEOUT' | 'RATE_LIMIT' | 'PROVIDER_ERROR' | 'UNAVAILABLE';

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

export type MockLlmOptions = {
  defaultResponse?: string;
  latencyMs?: number;
  simulatedError?: LlmAdapterError;
  customResponder?: (prompt: FormattedAiPrompt) => string;
};

export class MockLlmAdapter implements LlmAdapter {
  readonly provider = 'mock';
  private readonly options: MockLlmOptions;

  constructor(options: MockLlmOptions = {}) {
    this.options = options;
  }

  async generateResponse(
    prompt: FormattedAiPrompt,
    _options?: LlmExecutionOptions
  ): Promise<LlmResponse> {
    const startTime = Date.now();

    if (this.options.simulatedError) {
      throw this.options.simulatedError;
    }

    if (this.options.latencyMs && this.options.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.options.latencyMs));
    }

    let content: string;
    if (this.options.customResponder) {
      content = this.options.customResponder(prompt);
    } else if (this.options.defaultResponse) {
      content = this.options.defaultResponse;
    } else {
      // Generate intelligent contextual response based on the prompt
      content = this.buildContextualResponse(prompt);
    }

    const latencyMs = Date.now() - startTime;
    const promptTokens = Math.max(1, Math.ceil(prompt.userPrompt.length / 4));
    const completionTokens = Math.max(1, Math.ceil(content.length / 4));

    return {
      content,
      provider: this.provider,
      model: 'mock-financial-v1',
      finishReason: 'stop',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      },
      latencyMs
    };
  }

  private buildContextualResponse(prompt: FormattedAiPrompt): string {
    const userPrompt = prompt.userPrompt;

    // Extract balance if present in the prompt
    const balanceMatch = userPrompt.match(/Saldo:\s*([^\r\n]+)/i);
    const balance = balanceMatch ? balanceMatch[1]?.trim() : '0.00';

    return `Olá! Analisando seu contexto financeiro no MoneyHub, verifiquei que seu saldo líquido atual no período é de R$ ${balance}. ` +
      `Se precisar de detalhes sobre suas principais despesas ou contas a pagar agendadas, estou à disposição para ajudar no seu planejamento!`;
  }
}

export type OpenAiCompatibleOptions = {
  apiKey: string;
  baseUrl?: string | undefined;
  model?: string | undefined;
  fetchFn?: typeof fetch | undefined;
};

export class OpenAiCompatibleLlmAdapter implements LlmAdapter {
  readonly provider = 'openai';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: OpenAiCompatibleOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
    this.model = options.model ?? 'gpt-4o-mini';
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  async generateResponse(
    prompt: FormattedAiPrompt,
    options?: LlmExecutionOptions
  ): Promise<LlmResponse> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs ?? 10000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const payload = {
      model: this.model,
      messages: [
        { role: 'system', content: prompt.systemPrompt },
        { role: 'user', content: prompt.userPrompt }
      ],
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 600
    };

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

      type ChatCompletionJson = {
        choices?: Array<{
          message?: { content?: string };
          finish_reason?: string;
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      const data = (await response.json()) as ChatCompletionJson;
      const choice = data.choices?.[0];
      const content = choice?.message?.content ?? '';
      const finishReason = (choice?.finish_reason as LlmFinishReason) ?? 'stop';

      const usage: LlmUsage = {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0
      };

      const latencyMs = Date.now() - startTime;

      return {
        content,
        provider: this.provider,
        model: this.model,
        finishReason,
        usage,
        latencyMs
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
  const provider = config?.provider ?? process.env.LLM_PROVIDER ?? 'mock';
  const apiKey = config?.apiKey ?? process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? '';

  if (provider === 'openai' && apiKey.trim()) {
    return new OpenAiCompatibleLlmAdapter({
      apiKey: apiKey.trim(),
      model: config?.model ?? process.env.LLM_MODEL,
      baseUrl: config?.baseUrl ?? process.env.LLM_BASE_URL
    });
  }

  return new MockLlmAdapter();
}
