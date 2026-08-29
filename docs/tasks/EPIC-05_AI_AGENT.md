# EPIC-05 — AI Financial Agent

## Status
In Progress

## Feature
AI assistant.

## Objective
Implement a safe AI assistant that answers financial questions using only authorized user context.

## Initial Tasks

- [x] TASK-013 — Implement AI context builder.
- [x] TASK-031 — Implement AI prompt registry.
- [x] TASK-032 — Implement LLM adapter contract.
- [ ] TASK-033 — Implement AI conversation logging.

## Tasks Detail

### TASK-013 — Implement AI context builder

## Status
Done

## Completion Review
O serviço backend `buildAiFinancialContext` foi implementado em `apps/backend/src/ai-context-builder.ts` com isolamento multi-tenant estrito por `userId` (`requireVerifiedUserId`), sem `any`, e exposto via query GraphQL `aiFinancialContext(input: AiFinancialContextInput): AiFinancialContext!`. O serviço agrega com segurança os totais financeiros (receitas, despesas, saldo líquido), as top categorias de despesa com cálculo percentual, as próximas contas a pagar pendentes e a moeda preferida do perfil do usuário com fallback para `BRL`. A suíte completa de testes unitários e de integração valida o cálculo de métricas, limites de entrada, ausência de divisão por zero e rejeição imediata de usuários não autenticados ou sem e-mail verificado.

### TASK-031 — Implement AI prompt registry

## Status
Done

## Completion Review
O módulo `ai-prompt-registry.ts` foi implementado em `apps/backend/src/ai-prompt-registry.ts` com tipagem 100% estrita sem `any`. Ele gerencia os System Prompts versionados (com declarações explícitas de não aconselhamento financeiro/tributário/crédito, princípio de insuficiência de dados e defesas contra *prompt injection* e *jailbreak*), templates de mensagens especializadas (`GENERAL_FINANCIAL_ASSISTANT`, `MONTHLY_SUMMARY`, `EXPENSE_OPTIMIZATION`), formatação estruturada de contexto financeiro via tags XML (`<financial_context>` e `<user_question>`) e sanitização de entradas do usuário com limites de tamanho e remoção de caracteres de controle nulos. A suíte de testes unitários valida todas as regras e casos limítrofes.

### TASK-032 — Implement LLM adapter contract

## Status
Done

## Completion Review
O módulo `ai-llm-adapter.ts` foi implementado em `apps/backend/src/ai-llm-adapter.ts` com tipagem 100% estrita sem `any`. Ele define o contrato `LlmAdapter`, opções de execução `LlmExecutionOptions`, a resposta tipada `LlmResponse` com métricas de tokens (`LlmUsage`) e latência, e a classe de erro resiliente `LlmAdapterError` com sanitização e redação de credenciais. Inclui o `MockLlmAdapter` para desenvolvimento e testes locais com respostas contextuais determinísticas, simulação de erros e latência, o `OpenAiCompatibleLlmAdapter` via `fetch` e `AbortController` nativos com mapeamento seguro de status HTTP (429 para rate limit retryable, 5xx para provider error), e a factory `createLlmAdapter` com fallback automático seguro. Testes unitários completos cobrem todos os cenários.



