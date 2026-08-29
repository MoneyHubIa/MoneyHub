import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  MockLlmAdapter,
  OpenAiCompatibleLlmAdapter,
  LlmAdapterError,
  createLlmAdapter,
  type LlmAdapter,
  type LlmResponse
} from '../src/ai-llm-adapter.js';
import type { FormattedAiPrompt } from '../src/ai-prompt-registry.js';

function createSamplePrompt(): FormattedAiPrompt {
  return {
    systemPrompt: 'Você é o assistente financeiro do MoneyHub.',
    userPrompt: `<financial_context>
Período: 2026-08
Moeda: BRL
Receitas: 10000.00
Despesas: 6000.00
Saldo: 4000.00
</financial_context>

<user_question>
Qual é o meu saldo?
</user_question>`,
    version: '1.0',
    templateId: 'GENERAL_FINANCIAL_ASSISTANT'
  };
}

describe('LLM Adapter Contract (TASK-032)', () => {
  describe('MockLlmAdapter', () => {
    test('generates realistic contextual response with usage and latency', async () => {
      const adapter: LlmAdapter = new MockLlmAdapter();
      const prompt = createSamplePrompt();

      const response: LlmResponse = await adapter.generateResponse(prompt);

      assert.equal(adapter.provider, 'mock');
      assert.equal(response.provider, 'mock');
      assert.equal(response.model, 'mock-financial-v1');
      assert.equal(response.finishReason, 'stop');
      assert.ok(response.content.length > 0);
      // Mentions contextual data
      assert.ok(response.content.includes('4000.00') || response.content.includes('saldo'));
      assert.ok(response.usage.promptTokens > 0);
      assert.ok(response.usage.completionTokens > 0);
      assert.equal(response.usage.totalTokens, response.usage.promptTokens + response.usage.completionTokens);
      assert.ok(response.latencyMs >= 0);
    });

    test('supports customResponder override', async () => {
      const adapter = new MockLlmAdapter({
        customResponder: (p) => `Resposta personalizada para: ${p.templateId}`
      });

      const response = await adapter.generateResponse(createSamplePrompt());
      assert.equal(response.content, 'Resposta personalizada para: GENERAL_FINANCIAL_ASSISTANT');
    });

    test('throws configured simulatedError for resiliency testing', async () => {
      const error = new LlmAdapterError('Simulated rate limit', 'RATE_LIMIT', true);
      const adapter = new MockLlmAdapter({ simulatedError: error });

      await assert.rejects(
        () => adapter.generateResponse(createSamplePrompt()),
        (err: unknown) => {
          assert.ok(err instanceof LlmAdapterError);
          assert.equal(err.code, 'RATE_LIMIT');
          assert.equal(err.isRetryable, true);
          return true;
        }
      );
    });
  });

  describe('OpenAiCompatibleLlmAdapter', () => {
    test('sends formatted request and parses chat completion response', async () => {
      const mockFetch: typeof fetch = async (url, init) => {
        assert.equal(url.toString(), 'https://api.openai.com/v1/chat/completions');
        assert.ok(init?.headers);
        const headers = new Headers(init.headers);
        assert.equal(headers.get('Authorization'), 'Bearer test-secret-key');
        assert.equal(headers.get('Content-Type'), 'application/json');

        const body = JSON.parse(init.body as string) as {
          model: string;
          messages: Array<{ role: string; content: string }>;
          temperature: number;
          max_tokens: number;
        };
        assert.equal(body.model, 'gpt-4o-mini');
        assert.equal(body.messages[0]?.role, 'system');
        assert.equal(body.messages[1]?.role, 'user');
        assert.equal(body.temperature, 0.3);
        assert.equal(body.max_tokens, 600);

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: { content: 'Seu saldo atual é de R$ 4.000,00.' },
                finish_reason: 'stop'
              }
            ],
            usage: {
              prompt_tokens: 50,
              completion_tokens: 15,
              total_tokens: 65
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const adapter = new OpenAiCompatibleLlmAdapter({
        apiKey: 'test-secret-key',
        model: 'gpt-4o-mini',
        fetchFn: mockFetch
      });

      const response = await adapter.generateResponse(createSamplePrompt());
      assert.equal(response.provider, 'openai');
      assert.equal(response.model, 'gpt-4o-mini');
      assert.equal(response.content, 'Seu saldo atual é de R$ 4.000,00.');
      assert.equal(response.finishReason, 'stop');
      assert.equal(response.usage.promptTokens, 50);
      assert.equal(response.usage.completionTokens, 15);
      assert.equal(response.usage.totalTokens, 65);
    });

    test('handles HTTP 429 as RATE_LIMIT retryable error', async () => {
      const mockFetch: typeof fetch = async () => {
        return new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const adapter = new OpenAiCompatibleLlmAdapter({
        apiKey: 'test-key',
        fetchFn: mockFetch
      });

      await assert.rejects(
        () => adapter.generateResponse(createSamplePrompt()),
        (err: unknown) => {
          assert.ok(err instanceof LlmAdapterError);
          assert.equal(err.code, 'RATE_LIMIT');
          assert.equal(err.isRetryable, true);
          return true;
        }
      );
    });

    test('handles provider 500 error and redacts API key', async () => {
      const mockFetch: typeof fetch = async () => {
        return new Response('Internal Server Error test-secret-api-key-12345', {
          status: 500
        });
      };

      const adapter = new OpenAiCompatibleLlmAdapter({
        apiKey: 'test-secret-api-key-12345',
        fetchFn: mockFetch
      });

      await assert.rejects(
        () => adapter.generateResponse(createSamplePrompt()),
        (err: unknown) => {
          assert.ok(err instanceof LlmAdapterError);
          assert.equal(err.code, 'PROVIDER_ERROR');
          assert.equal(err.isRetryable, true);
          // Key must never be present in error message
          assert.ok(!err.message.includes('test-secret-api-key-12345'));
          return true;
        }
      );
    });

    test('handles timeout abort signal', async () => {
      const mockFetch: typeof fetch = async (_url, init) => {
        const signal = init?.signal;
        return new Promise((_resolve, reject) => {
          if (signal) {
            signal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }
        });
      };

      const adapter = new OpenAiCompatibleLlmAdapter({
        apiKey: 'test-key',
        fetchFn: mockFetch
      });

      await assert.rejects(
        () => adapter.generateResponse(createSamplePrompt(), { timeoutMs: 20 }),
        (err: unknown) => {
          assert.ok(err instanceof LlmAdapterError);
          assert.equal(err.code, 'TIMEOUT');
          assert.equal(err.isRetryable, true);
          return true;
        }
      );
    });
  });

  describe('createLlmAdapter factory', () => {
    test('returns MockLlmAdapter when provider is mock or unset', () => {
      const adapter1 = createLlmAdapter({ provider: 'mock' });
      assert.equal(adapter1.provider, 'mock');

      const adapter2 = createLlmAdapter({});
      assert.equal(adapter2.provider, 'mock');
    });

    test('returns OpenAiCompatibleLlmAdapter when configured with apiKey', () => {
      const adapter = createLlmAdapter({
        provider: 'openai',
        apiKey: 'sk-test-12345'
      });
      assert.equal(adapter.provider, 'openai');
    });

    test('falls back to MockLlmAdapter if openai provider is specified without apiKey', () => {
      const adapter = createLlmAdapter({
        provider: 'openai',
        apiKey: ''
      });
      assert.equal(adapter.provider, 'mock');
    });
  });
});
