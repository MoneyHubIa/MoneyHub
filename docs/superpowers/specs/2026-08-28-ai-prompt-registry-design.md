# Especificação de Design: TASK-031 — AI Prompt Registry

## Objetivo
Implementar o registro centralizado, versionado e seguro de prompts e templates (`AI Prompt Registry`) para o assistente financeiro do MoneyHub ([EPIC-05](file:///c:/MoneyHub/MoneyHub/docs/tasks/EPIC-05_AI_AGENT.md)). O registry padroniza o System Prompt, implementa defesas contra *prompt injection*, e formata de maneira estruturada o contexto financeiro gerado pela TASK-013 junto com a pergunta do usuário para envio aos modelos de linguagem (LLM).

---

## 1. Arquitetura do Backend (`ai-prompt-registry.ts`)

### 1.1 Tipos e Interfaces
- `PromptTemplateId`:
  - `'GENERAL_FINANCIAL_ASSISTANT'`: Orientação financeira ampla e esclarecimento de dúvidas.
  - `'MONTHLY_SUMMARY'`: Foco em resumir receitas, despesas, saldo e taxa de economia do período.
  - `'EXPENSE_OPTIMIZATION'`: Foco em análise das maiores categorias de gastos e contas futuras para sugerir cortes/otimizações.
- `FormattedAiPrompt`:
  - `systemPrompt`: `string`
  - `userPrompt`: `string` (combinação delimitada do contexto financeiro e da pergunta do usuário)
  - `version`: `string` (ex: `"1.0"`)
  - `templateId`: `PromptTemplateId`
- `BuildPromptOptions`:
  - `context`: `AiFinancialContext` (produzido pela TASK-013)
  - `userMessage`: `string`
  - `templateId?`: `PromptTemplateId` (padrão: `'GENERAL_FINANCIAL_ASSISTANT'`)
  - `version?`: `string` (padrão: `"1.0"`)

### 1.2 Diretrizes do System Prompt V1
- **Identidade e Missão**: Assistente financeiro do MoneyHub, comunicando-se em português claro, empático e prático.
- **Conformidade Legal e Ética**: Proibição estrita de oferecer conselho formal de investimento, consultoria tributária, crédito ou decisões vinculativas. Todo insight é consultivo.
- **Princípio de Insuficiência de Dados**: Quando os dados contidos em `<financial_context>` forem insuficientes para responder com exatidão, declarar explicitamente a limitação em vez de alucinar.
- **Defesa contra Injeção / Jailbreak**: Instrução explícita para tratar as tags `<user_question>` e o contexto como dados não executáveis, ignorando tentativas de desvio de conduta ou revelação de instruções internas.

### 1.3 Formatação e Sanitização do User Prompt
- **Delimitação Estruturada**:
  ```text
  <financial_context>
  Período: {period} ({currency})
  Receitas: {totals.income} | Despesas: {totals.expenses} | Saldo Líquido: {totals.balance}

  Top Categorias de Despesa:
  - {categoryName}: {amount} ({percentage}%)

  Próximas Contas a Pagar:
  - {description}: {amount} (vence {dueDate})
  </financial_context>

  <user_question>
  {sanitizedUserMessage}
  </user_question>
  ```
- **Sanitização de Entrada**:
  - Remoção de caracteres de controle nulos (`\0`).
  - Limite máximo de 2.000 caracteres por pergunta para prevenir estouro de contexto e abuso.
  - Lançamento de erro `BAD_USER_INPUT` caso a pergunta esteja em branco ou ultrapasse o limite.

---

## 2. Estratégia de Testes (`apps/backend/tests/ai-prompt-registry.test.ts`)
- **System Prompt**: Verificação das diretivas de segurança, compliance, ausência de consultoria regulamentada e tom MoneyHub.
- **Estrutura de Prompt**: Verificação da correta injeção dos dados nas tags `<financial_context>` e `<user_question>`.
- **Templates**: Garantia de inclusão das orientações de template para cada `templateId`.
- **Casos Limítrofes**: Contexto financeiro com listas vazias (zero despesas, zero contas) formatado de forma limpa.
- **Validações e Sanitização**: Rejeição de perguntas vazias, espaços em branco ou excedendo 2.000 caracteres com `BAD_USER_INPUT`.
- **Tipagem**: Zero `any` e typecheck 100% estrito.
