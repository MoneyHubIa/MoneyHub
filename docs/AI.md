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
As três ferramentas acima são de leitura. O catálogo operacional acrescenta
consultas e preparação de operações, descritas a seguir. Nenhuma ferramenta do
modelo executa gravações de negócio diretamente.
O fluxo operacional admite até oito rodadas e 32 chamadas de ferramentas por
solicitação. Mensagens internas entre ferramentas existem apenas durante essa
solicitação.

## Operações pelo chat

O assistente pode preparar todas as operações de negócio existentes na API:
receitas e despesas; contas a pagar/receber e baixas; contas bancárias e
transferências; cartões, compras, faturas e estornos; metas e aportes/retiradas;
categorias, centros de custo, parcelas e recorrências; agenda, notificações e
preferências do perfil. O catálogo é explícito e sua cobertura é testada contra
as mutations de negócio. Bootstrap de identidade e endpoints de orquestração
não integram esse catálogo.

Ferramentas operacionais:

- `list_operations`: descobre operações e consultas disponíveis.
- `get_operation_schema`: apresenta parâmetros compatíveis com os tipos GraphQL.
- `read_records`: consulta dados do usuário, com busca textual e páginas de até 50 registros.
- `prepare_operations`: valida e persiste uma proposta de 1 a 20 ações, sem criar os lançamentos.

Pedidos incompletos exigem esclarecimento. Nomes e IDs são resolvidos a partir dos
dados autorizados; a conta padrão e os padrões existentes do aplicativo podem ser
usados quando aplicáveis e aparecem no resumo. Valores usam centavos exatos e
strings decimais. Datas relativas usam a data atual e o fuso informado pelo cliente,
com UTC para clientes antigos. Dependências usam `$ref:chave.id`, referindo-se a
uma ação anterior, como criar banco, depois cartão e finalmente uma compra.

`askAiAssistant` aceita `history` (até 20 mensagens user/assistant de até 2000
caracteres), `timeZone` e `planId` opcionais. A resposta mantém os campos existentes
e pode incluir `pendingPlan`. Histórico visual segue em memória no cliente;
propostas, argumentos normalizados e recibos são persistidos no backend.

O chat mostra resumo, valores individuais, totais por operação e moeda e efeitos
das alterações. Somente o botão Confirmar operações chama
`confirmAiOperationPlan(id)`. Enviar texto, concluir ditado ou responder “sim” ao
modelo não executa os lançamentos. `cancelAiOperationPlan(id)` cancela propostas
não confirmadas; correções geram uma nova proposta e invalidam a anterior.
Propostas pendentes expiram em 30 minutos. `aiOperationPlan(id)` recupera estado
após uma falha de conexão, sempre verificando o usuário autenticado.

A execução ocorre ação por ação, em ordem. Cada efeito e seu recibo compartilham
uma transação curta. Serviços de domínio reutilizam esse cliente transacional,
inclusive quando normalmente abrem suas próprias transações. Uma falha desfaz
somente aquela ação, preserva os sucessos e bloqueia ações dependentes. Repetir uma
confirmação recupera sucessos e continua apenas passos ainda pendentes. Ações que
falharam exigem uma nova proposta para revisão; sucessos não são repetidos.
Pré-condições verificam registros alterados após a revisão, e mudanças produzidas
por ações anteriores do próprio lote são incorporadas às pré-condições seguintes.

O cliente atualiza consultas e invalida resultados em cache após gravações. Uma
falha de atualização mantém o recibo de salvamento e oferece orientação para
recarregar. Auditoria de execução registra usuário, requestId, proposta, operação
e status sem imprimir argumentos financeiros completos no log.

### Implantação e verificação

Aplique `20261109000000_ai_operations` antes de publicar o backend e o frontend:
`npm run db:migrate -w apps/backend`. Gere o cliente Prisma no build com
`npm run db:generate -w apps/backend`. A implementação continua usando o provedor
LLM configurado; ele precisa suportar chamadas de ferramentas. O adapter mock
padrão é demonstrativo e não interpreta pedidos operacionais livremente.

Testes de integração usam Prisma, os serviços reais e PostgreSQL isolado via
PGlite, cobrindo confirmação, recibos, concorrência, falhas parciais, dependências,
permissões e os diferentes módulos. O fluxo GraphQL completo usa um modelo
simulado determinístico. Testes da interface cobrem revisão, correção, cancelamento,
confirmação e recuperação de resposta perdida.

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

## Entrada por voz

O botão de microfone do assistente permite ditar mensagens em português brasileiro
(`pt-BR`) na web, Android e iOS, quando o reconhecimento da plataforma estiver
disponível. Um toque inicia a captura; outro encerra. O serviço também pode
encerrar automaticamente após uma pausa. A transcrição preenche o campo existente:
o usuário revisa, pode editar e toca em Enviar. Não há envio automático à IA.
Texto já digitado é preservado, com limite total de 2000 caracteres.

A integração usa `expo-speech-recognition` compatível com Expo SDK 57, com o plugin
configurado no aplicativo. Android e iOS precisam de uma nova compilação nativa
(development build ou release); atualizar apenas o JavaScript não instala o módulo.
O plugin declara as permissões de microfone e reconhecimento necessárias. O app
solicita acesso somente ao tocar no microfone. Uma negativa permanente deve ser
alterada nas configurações do dispositivo ou navegador.

Na web, execute por HTTPS (ou localhost para desenvolvimento) e use um navegador
com reconhecimento de fala disponível. A presença da API não garante que o serviço
esteja operacional. Navegadores sem suporte mostram um aviso e mantêm a digitação.
Falhas de permissão, conexão ou reconhecimento também preservam a entrada por texto.

O reconhecimento é oferecido pelo sistema ou navegador, sem nova API ou credencial
no backend do MoneyHub. Isso não garante processamento local ou funcionamento offline:
a plataforma pode enviar áudio ao próprio serviço remoto de reconhecimento. O
MoneyHub não persiste gravações nem envia áudio ao seu backend; somente o texto
revisado segue pela mutation `askAiAssistant` ao tocar em Enviar.

Durante a captura e finalização, edição, envio e sugestões rápidas ficam bloqueados.
Fechar, minimizar, limpar a conversa, sair da tela ou colocar o app/página em segundo
plano cancela a captura e descarta resultados provisórios. Texto já confirmado é
preservado. Ao atingir 2000 caracteres, a captura termina com aviso para revisão.

Validação manual: testar captura e revisão em Android, iOS e navegador compatível;
permissões aceitas e negadas; navegador sem suporte; silêncio e falha de conexão;
limite de caracteres; modos flutuante e tela cheia; interrupção ao minimizar o chat
ou colocar o aplicativo em segundo plano. Confirmar que nenhuma pergunta é enviada
antes do toque em Enviar e que o indicador do microfone encerra ao sair do chat.

## Histórico e auditoria

AiAssistant mantém mensagens em estado React; não há histórico integral de chat no banco.
Propostas operacionais e recibos ficam em `ai_operation_plans` e `ai_operations`.
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
