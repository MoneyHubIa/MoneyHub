# Especificação de Design: TASK-032 — LLM Adapter Contract

## Objetivo
Implementar o contrato e adapters desacoplados de LLM (`LLM Adapter Contract`) para o assistente financeiro do MoneyHub ([EPIC-05](file:///c:/MoneyHub/MoneyHub/docs/tasks/EPIC-05_AI_AGENT.md)). O adapter isola as chamadas a modelos de inteligência artificial de forma segura, com tipagem estrita, tratamento resiliente de erros e suporte a um `MockLlmAdapter` para desenvolvimento e testes locais sem custos de API.

---

## 1. Arquitetura do Backend (`ai-llm-adapter.ts`)

### 1.1 Tipos e Interfaces
- `LlmExecutionOptions`:
  - `maxTokens?: number` (padrão: 600)
  - `temperature?: number` (padrão: 0.3)
  - `timeoutMs?: number` (padrão: 10.000 ms)
- `LlmUsage`:
  - `promptTokens: number`
  - `completionTokens: number`
  - `totalTokens: number`
- `LlmResponse`:
  - `content: string`
  - `provider: string` (ex: `"mock"`, `"openai"`, `"gemini"`)
  - `model: string` (ex: `"mock-financial-v1"`, `"gpt-4o-mini"`)
  - `finishReason: 'stop' | 'length' | 'content_filter' | 'error'`
  - `usage: LlmUsage`
  - `latencyMs: number`
- `LlmAdapter`:
  - `readonly provider: string`
  - `generateResponse(prompt: FormattedAiPrompt, options?: LlmExecutionOptions): Promise<LlmResponse>`

### 1.2 Tratamento de Erros e Resiliência (`LlmAdapterError`)
- Classe de erro `LlmAdapterError extends Error`:
  - `code: 'TIMEOUT' | 'RATE_LIMIT' | 'PROVIDER_ERROR' | 'UNAVAILABLE'`
  - `isRetryable: boolean`
  - Redação obrigatória de segredos: mensagens de erro sanitizadas para nunca expor API keys, bearer tokens ou dados internos em logs ou traces.

### 1.3 Adapters e Factory
- **`MockLlmAdapter`**:
  - Respostas determinísticas e contextuais simulando análise financeira realista baseada no prompt.
  - Opções para testes: `latencyMs`, `simulatedError`, `customResponder`.
- **`OpenAiCompatibleLlmAdapter`**:
  - Integração HTTP nativa via `fetch` para endpoints compatíveis com a especificação Chat Completions.
  - Timeout via `AbortController` nativo.
  - Mapeamento seguro de status HTTP (429 -> `RATE_LIMIT`, 5xx -> `PROVIDER_ERROR`).
- **Factory `createLlmAdapter(config?: LlmConfig)`**:
  - Instancia o adapter configurado via variáveis de ambiente (`LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`).
  - Fallback automático e seguro para `MockLlmAdapter` caso nenhuma chave esteja configurada ou em ambiente de testes.

---

## 2. Estratégia de Testes (`apps/backend/tests/ai-llm-adapter.test.ts`)
- **`MockLlmAdapter`**:
  - Geração de resposta contextual realista.
  - Resposta personalizada com `customResponder`.
  - Tratamento e lançamento de `simulatedError`.
  - Cálculo de estimativa de tokens e medição de latência.
- **`OpenAiCompatibleLlmAdapter`**:
  - Construção do payload com mensagens `system` e `user`.
  - Cancelamento por timeout via `AbortSignal`.
  - Tratamento de rate limit (429) com flag `isRetryable: true`.
  - Tratamento de erro 500 do provedor com redação de credenciais.
- **Factory**:
  - Resolução para `MockLlmAdapter` por padrão e fallback resiliente.
- **Tipagem**: Zero `any` e TypeScript estrito.
