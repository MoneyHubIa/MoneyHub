# Assistente financeiro IA

Palavras-chave: @ai | ia | llm | prompts | ferramentas | tools | modelo | auditoria

askAiAssistant valida pergunta/identidade, reconstrói contexto autorizado,
formata prompts, executa adapter/ferramentas e registra metadados.
Dependências injetáveis: contextRepository, llmAdapter e logger.

## Contexto inicial

- version 1.0, period YYYY-MM, generatedAt ISO UTC e currency do perfil ou BRL.
- Totais de receitas/despesas não excluídas do mês UTC, retornados como strings.
- Até 5 categorias de despesa por volume.
- Até 10 contas a pagar PENDING/OVERDUE, dos últimos 30 dias até a janela futura.
- Até 10 metas: atrasadas, depois ativas por prazo, depois concluídas.
- Metas não alteram os totais financeiros; regras em [@finance](FINANCE.md).

month aceita inteiros 1–12; year, 2000–2100; billsDaysAhead, 1–90, padrão 30.
A query aiFinancialContext expõe billsDaysAhead; a mutation askAiAssistant
recebe mês/ano, sem esse parâmetro.
Não há contas a receber ou lembretes da agenda no snapshot inicial.
A seleção é padronizada, sem classificador de minimização por intenção.
Agregações convertem Decimal para Number, diferentemente do saldo de metas.

## Prompts e pergunta

Templates: GENERAL_FINANCIAL_ASSISTANT, MONTHLY_SUMMARY e EXPENSE_OPTIMIZATION.
O registro versiona o prompt e delimita financial_context e user_question.
A pergunta tem caracteres nulos removidos e limite de 2000 caracteres;
conteúdo vazio/excessivo produz BAD_USER_INPUT.

O prompt orienta português, informação insuficiente e ausência de recomendação
profissional jurídica, tributária, de crédito ou investimento. Instruções contra
prompt injection não garantem imunidade nem correção de todas as respostas.

## Ferramentas autorizadas

| Nome | Consulta |
| --- | --- |
| get_financial_summary | Totais e principais categorias entre startDate/endDate. |
| get_category_expenses | Categorias de despesa por intervalo; limit padrão 10, máximo 20. |
| get_upcoming_bills | Contas a pagar; daysAhead padrão 30, máximo 180; até 15 contas, incluindo últimos 30 dias. |

O backend executa somente ferramentas reconhecidas com userId autenticado.
São leituras, sem SQL do modelo nem mutações financeiras.
Há até três rodadas de ferramentas após a chamada inicial; podem ampliar
períodos/dados enviados ao modelo na mesma solicitação.
Mensagens entre rodadas existem apenas durante essa solicitação.

## Seleção e configuração backend

| Variável | Regra atual |
| --- | --- |
| LLM_PROVIDER | Padrão mock; aliases reconhecidos: openai, openai-compatible, groq, ollama, deepseek, gemini. |
| LLM_API_KEY | Chave; quando ausente, usa OPENAI_API_KEY. |
| LLM_BASE_URL | Base HTTP compatível; padrão https://api.openai.com/v1 no adapter real. |
| LLM_MODEL | Modelo; padrão gpt-4o-mini no adapter real. |
| LLM_TIMEOUT_MS | Prazo por chamada, padrão 120000 ms. |

Um alias reconhecido com chave não vazia, ou baseUrl configurado, seleciona
OpenAiCompatibleLlmAdapter; sem essa configuração, retorna MockLlmAdapter.
NODE_ENV não força mock. Com baseUrl e sem chave, usa chave local substituta.
Aliases não inferem endpoint do fornecedor: configure URL/modelo compatíveis.

O adapter real usa fetch/AbortController e POST baseUrl/chat/completions,
com temperature padrão 0.3 e max_tokens 600. provider informado é sempre openai,
inclusive com endpoint alternativo. Falha remota não faz retry/fallback
automático; o serviço expõe SERVICE_UNAVAILABLE.
Um servidor Ollama somente no localhost do desenvolvedor não é acessível pela Vercel.

## Histórico e auditoria

AiAssistant mantém mensagens em estado React; não há histórico de chat no banco.
O subtítulo llama3.1:8b é texto fixo da UI, não detecção do modelo ativo.
A resposta carrega model informado pelo adapter.

Pino registra requestId, userId, template, provider/model, tokens, latência,
contextVersion, contextPeriod e contextHash em sucesso; falhas usam metadados.
Erro do logger não deve bloquear a resposta.

hashContext é SHA-256 de período, moeda, totais, nomes/valores de categorias
e descrição/valor/vencimento de contas. Não inclui metas, generatedAt, pergunta,
prompt completo ou resultados de ferramentas; não reconstitui toda a entrada LLM.

O adapter remove ocorrências da API key de mensagens de erro processadas,
mas preserva outros trechos do provedor; console.error também existe.
Não atribua sanitização universal ou auditoria completa a esses mecanismos.

## Fontes

[Serviço](../apps/backend/src/modules/ai/service/ai-service.ts),
[contexto](../apps/backend/src/modules/ai/context-builder/ai-context-builder.ts),
[prompts](../apps/backend/src/modules/ai/prompt-registry/ai-prompt-registry.ts),
[ferramentas](../apps/backend/src/modules/ai/tools/ai-tools.ts),
[adapter](../apps/backend/src/modules/ai/llm-adapter/ai-llm-adapter.ts),
[auditoria](../apps/backend/src/modules/ai/conversation-logging/ai-conversation-logging.ts).

Relacionados: [@setup](SETUP.md), [@api](API.md), [@limits](LIMITS.md).
