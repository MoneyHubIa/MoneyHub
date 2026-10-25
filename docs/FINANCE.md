# Regras financeiras, agenda e metas

Palavras-chave: @finance | financeiro | metas | aportes | recorrencias | agenda | notificacoes | dashboard

As regras backend prevalecem sobre apresentação e validação do formulário.
Propriedade e email verificado são derivados conforme [@auth](AUTH.md).

## Lançamentos e contas

Receitas e despesas registram valores positivos por tipo; não represente
despesa como receita negativa. Categorias aceitam INCOME, EXPENSE ou BOTH.
Centro de custo é opcional. Consultas financeiras excluem registros
logicamente apagados quando o domínio possui deleted_at.

Contas a pagar/receber representam compromissos. No repositório padrão,
markAccountPayablePaid gera Expense com prefixo [Pago] e
markAccountReceivableReceived gera Income com prefixo [Recebido].
A data de baixa vira data do lançamento.
O serviço atualiza a conta e cria o lançamento em chamadas separadas;
não atribua a esse fluxo a atomicidade/idempotência implementada para metas.

Moeda do perfil é preferência de exibição, sem conversão cambial.

## Recorrências e indicadores

Criar regra financeira agenda a primeira conta PENDING, a pagar para
EXPENSE e a receber para INCOME. Regras são WEEKLY, MONTHLY ou YEARLY.
processRecurringTransactions busca ocorrências existentes e gera as faltantes
no processamento normal; execução é explícita, não um job agendado.

dashboardSummary usa consultas autorizadas do servidor.
cashFlow fornece séries DAILY/MONTHLY e saldo acumulado; categoryAnalysis
agrega por categoria; periodComparison compara dois períodos, com proteção
contra divisão por zero. Não confunda saldo realizado com contas pendentes.

## Agenda e notificações

Agenda projeta eventos manuais e contas pendentes, sem duplicar contas
como eventos persistidos. Eventos podem repetir semanal, mensal ou anualmente.
Datas da agenda representam dias de calendário, não instantes com horário.

Lembrete aceita null ou antecedência 0, 1, 3 ou 7 dias.
syncAgendaNotifications sincroniza ocorrências explicitamente e de forma
idempotente; leitura pode ser individual ou em lote.
Notificações são in-app. Não há push, email de lembrete, worker ou cron.

## Metas: valores e estado

Cadastro inicia acumulado em zero. Poupança existente entra como primeiro
aporte. Aportes/retiradas não geram receitas/despesas e não afetam fluxo de caixa.

Valores positivos são strings com até duas casas e máximo 999999999999.99
por valor/saldo. O serviço altera saldo em centavos inteiros BigInt.
Nome aceita 1–120 caracteres; descrição/observações, até 500.
startDate, deadline e occurredOn usam YYYY-MM-DD; deadline não antecede startDate.

Estado calculado:
- COMPLETED quando acumulado >= alvo.
- OVERDUE quando prazo é anterior ao dia UTC atual e a meta não está concluída.
- ACTIVE nos demais casos.

Aporte acima do alvo é permitido; percentual real pode superar 100%, com barra
visual limitada a 100%. Retirada pode reabrir meta, mas nunca deixar saldo negativo.

## Metas: operações, histórico e integração

Operações exigem userId e profileId válidos, além de email verificado.
Meta alheia/excluída retorna NOT_FOUND; entrada inválida, BAD_USER_INPUT.
Edição aceita campos parciais; description null limpa descrição.

recordFinancialGoalMovement exige goalId, type CONTRIBUTION/WITHDRAWAL,
amount, occurredOn e operationId UUID; notes é opcional.
Edição, exclusão e movimentos usam o mesmo bloqueio SELECT FOR UPDATE.
Movimento e saldo são persistidos atomicamente em transação.

A unicidade (goal_id, operation_id) evita duplicação. Retry idêntico conserva
operationId e retorna saldo atual; payload diferente com a mesma chave é
BAD_USER_INPUT. Para nova operação, gere novo UUID.

Histórico é imutável pela API; correção exige novo movimento.
Exclusão da meta é lógica e preserva histórico.
Ordenação é createdAt DESC, id DESC; representa registro, não data financeira.
Cada página contém 20 movimentos; o cursor deve pertencer à mesma meta.

Resumo de metas considera todas as metas não excluídas, independente do mês.
Mutations invalidam consultas observadas de metas/histórico/dashboard/IA.
A seleção de metas do contexto IA está em [@ai](AI.md).

## Fontes

[Domínios financeiros](../apps/backend/src/modules/finance),
[serviço de metas](../apps/backend/src/modules/finance/financial-goals/financial-goals.ts),
[transações de metas](../apps/backend/src/modules/finance/financial-goals/financial-goals-repository.ts),
[eventos](../apps/backend/src/modules/agenda/calendar-events/calendar-events.ts),
[lembretes](../apps/backend/src/modules/agenda/notifications/agenda-notifications.ts),
[repositórios das contas](../apps/backend/src/core/graphql/graphql.ts).

Relacionados: [@data](DATA.md), [@api](API.md), [@limits](LIMITS.md), [@deploy](DEPLOY.md).
