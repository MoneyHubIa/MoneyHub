# Regras financeiras, agenda e metas

Contas financeiras, cartões, faturas, parcelas e transferências seguem também
as regras descritas em [BANKING.md](BANKING.md).

Palavras-chave: @finance | financeiro | metas | aportes | recorrencias | agenda | notificacoes | dashboard

As regras backend prevalecem sobre apresentação e validação do formulário.
Propriedade e email verificado são derivados conforme [@auth](AUTH.md).

## Lançamentos e contas

Receitas e despesas registram valores positivos por tipo; não represente
despesa como receita negativa. Categorias aceitam INCOME, EXPENSE ou BOTH.
Centro de custo é opcional. Consultas financeiras excluem registros
logicamente apagados quando o domínio possui deleted_at.

Contas a pagar/receber representam compromissos. No banco atual, triggers
sincronizam a baixa com Expense/Income na mesma transação, identificados por
settlementId. A data de baixa vira data do lançamento. Faturas usam o serviço
de pagamento de cartão, que distribui o pagamento entre suas compras.

Moeda do perfil é preferência de exibição, sem conversão cambial.

## Importação de extrato bancário

O botão Importar extrato está em Extrato e Contas a Pagar/Receber, em web e
mobile. Aceita OFX bancário SGML/XML e CSV com cabeçalho, até 2 MiB e 500
movimentações. PDF, imagens, extratos de compras de cartão e investimentos não
são aceitos. UTF-8/BOM e Windows-1252 são reconhecidos no servidor.

CSV exige mapear data, descrição e valor assinado, ou débito/crédito separados.
O usuário escolhe separadores e formato de data. Linhas inválidas aparecem com
erro e devem ser ignoradas ou corrigidas no arquivo de origem. Não há descarte
silencioso. OFX com moeda diferente do perfil é rejeitado, sem conversão.

A prévia não cria lançamentos. Na revisão, categorias padrão de entrada/saída
podem ser aplicadas em lote e ajustadas por linha. Débitos criam contas PAID;
créditos criam contas RECEIVED. Vencimento e baixa usam o dia da movimentação,
sem recorrência ou lembrete. A descrição de nova conta já vem limitada a 120
caracteres na revisão, que preserva o texto original do extrato para consulta.

Vínculos são sempre explícitos: contas pendentes/vencidas exigem mesma conta,
direção e valor integral, com vencimento até sete dias da movimentação. Contas
já baixadas exigem mesmo valor e data. A classificação existente é preservada.
Transferências usam duas contas próprias e não geram receita/despesa; a outra
ponta pode ser conciliada posteriormente sem repetir a transferência. Faturas
permitem pagamento parcial/total ou vínculo com pagamento existente, na conta
financeira do cartão, reutilizando o rateio atual.

Identificador OFX e mesma linha do mesmo arquivo CSV bloqueiam reimportação por
usuário/conta. Correspondências por data, descrição normalizada e valor entre
arquivos ou formatos são possíveis duplicados: ficam desmarcadas e exigem
reconhecimento explícito para importar. Duas movimentações legítimas iguais
podem ser mantidas. Um destino não pode ser conciliado duas vezes na mesma conta.

Lotes pendentes expiram em 24 horas e são removidos na próxima prévia do mesmo
usuário. Arquivos originais não são persistidos; dados normalizados e vínculos
confirmados permanecem para rastreabilidade. A confirmação inteira é atômica,
serializa operações bancárias do usuário e é idempotente para decisões iguais.
Falhas não salvam linhas parcialmente. Se a resposta de rede for perdida, o
cliente consulta o resultado antes de permitir nova tentativa.

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
