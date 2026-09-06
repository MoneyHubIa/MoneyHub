# Especificação de Design: TASK-033 — AI Conversation Logging

## Objetivo
Implementar o serviço de auditoria, logging estruturado de conversas (`AI Conversation Logging`) e o serviço orquestrador do assistente financeiro do MoneyHub ([EPIC-05](file:///c:/MoneyHub/MoneyHub/docs/tasks/EPIC-05_AI_AGENT.md)). O serviço audita todas as interações de IA (tokens, latência, hash de contexto, modelo e status de sucesso/falha), sem vazar dados confidenciais nem quebrar requisições, e expõe a mutation GraphQL `askAiAssistant` para conclusão integral do EPIC-05.

---

## 1. Arquitetura do Backend

### 1.1 Modelo de Eventos de Auditoria (`ai-conversation-logging.ts`)
- `AiConversationSuccessEvent`:
  - `event: 'ai_conversation_completed'`
  - `userId: string`
  - `requestId: string`
  - `templateId: string`
  - `provider: string`
  - `model: string`
  - `promptTokens: number`
  - `completionTokens: number`
  - `totalTokens: number`
  - `latencyMs: number`
  - `contextVersion: string`
  - `contextPeriod: string`
  - `contextHash: string` (SHA-256 da representação do contexto)
  - `status: 'success'`
- `AiConversationErrorEvent`:
  - `event: 'ai_conversation_failed'`
  - `userId?: string`
  - `requestId: string`
  - `templateId?: string`
  - `provider?: string`
  - `latencyMs: number`
  - `status: 'error'`
  - `errorCode: string`
- `AiConversationAuditEvent`: união dos dois tipos.
- `AiConversationLogger`: interface com `log(event: AiConversationAuditEvent): void`.
- `hashContext(context: AiFinancialContext): string`: função para gerar o hash SHA-256.

### 1.2 Serviço Orquestrador (`ai-service.ts`)
- Interface `AiServiceDependencies`:
  - `contextBuilder`: função para montar `AiFinancialContext` (padrão: `buildAiFinancialContext`)
  - `contextRepository`: repositório de dados (padrão: `aiContextRepository()`)
  - `promptBuilder`: função para montar prompt (padrão: `buildAiPrompt`)
  - `llmAdapter`: adapter LLM (padrão: `createLlmAdapter()`)
  - `logger`: logger de auditoria (padrão: `defaultAiConversationLogger`)
- Função `askAiAssistant(context: GraphQLContext, input: AskAiAssistantInput, deps?: Partial<AiServiceDependencies>): Promise<AiAssistantResponse>`:
  - Valida usuário autenticado e e-mail via `requireVerifiedUserId(context)`.
  - Monta o contexto financeiro para o período solicitado (mês/ano).
  - Gera o hash SHA-256 do contexto.
  - Formata o prompt via `buildAiPrompt`.
  - Dispara a execução no `llmAdapter`.
  - Registra o evento de sucesso via `logger.log(...)` de forma segura (engolindo erros de logger para não bloquear a resposta).
  - Em caso de falha do LLM, registra o evento de erro via `logger.log(...)` e lança `GraphQLError('AI assistant is currently unavailable.', { extensions: { code: 'SERVICE_UNAVAILABLE' } })`.

### 1.3 Schema e Resolver GraphQL (`graphql.ts`)
- Tipos no `typeDefs`:
  - `type AiAssistantUsage`: `promptTokens: Int!`, `completionTokens: Int!`, `totalTokens: Int!`
  - `type AiAssistantResponse`: `answer: String!`, `provider: String!`, `model: String!`, `latencyMs: Int!`, `usage: AiAssistantUsage!`, `contextPeriod: String!`, `contextVersion: String!`
  - `input AskAiAssistantInput`: `message: String!`, `month: Int`, `year: Int`, `templateId: String`
  - `Mutation.askAiAssistant(input: AskAiAssistantInput!): AiAssistantResponse!`
- Resolver `resolvers.Mutation.askAiAssistant`:
  - Executa `askAiAssistant(context, args.input)`.

---

## 2. Estratégia de Testes
- **Testes Unitários de Logging (`ai-conversation-logging.test.ts`)**:
  - Geração de hash SHA-256 consistente.
  - Registro de eventos com `pino` (`appLogger.info` e `appLogger.error`).
  - Resiliência contra exceções internas no logger.
- **Testes Unitários e de Integração do Serviço (`ai-service.test.ts`)**:
  - Fluxo completo com Mock LLM Adapter, calculando tokens, latência e entregando resposta formatada.
  - Tratamento de falha no LLM Adapter (gravação do log de erro e lançamento de `SERVICE_UNAVAILABLE`).
  - Resiliência do serviço caso o logger lance erro.
  - Rejeição de usuários não autenticados ou sem e-mail verificado.
  - Validação da query/mutation no `typeDefs` do schema GraphQL.
- **Tipagem**: Zero `any` e 100% de conformidade com as regras globais de TypeScript.
