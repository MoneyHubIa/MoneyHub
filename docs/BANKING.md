# Contas financeiras e cartões

Contas financeiras são independentes de centros de custo. A migração cria Conta
Corrente e Investimentos para cada usuário, atribui o histórico à Conta Corrente
e instala o mesmo provisionamento para novos usuários. O vínculo financeiro é
obrigatório no banco; clientes antigos podem omiti-lo e recebem a conta padrão.

O saldo deriva do saldo inicial, receitas, despesas e transferências efetivadas.
Compromissos pendentes não alteram saldo. Triggers sincronizam a baixa e seu
lançamento na mesma transação; a chave de origem impede duplicações. Alterações
em contas, lançamentos e transferências têm auditoria no banco. A migração
preserva os valores históricos e vincula baixas antigas somente quando existe
uma associação inequívoca pelas notas de origem.

As mutations bancárias serializam operações do mesmo usuário. `operationId`
identifica transferências, séries, compras e pagamentos; repetir a operação com
dados diferentes é rejeitado. Valores são calculados em centavos inteiros.

## Cartões

Compras e parcelas comprometem o limite e compõem faturas. As despesas e o débito
na conta são reconhecidos no pagamento da fatura. Pagamentos parciais distribuem
centavos proporcionalmente entre os itens em aberto e conservam suas categorias.
O estorno de pagamento restaura a dívida e remove seu efeito no saldo.

Faturas aparecem em Contas a Pagar e na agenda, mas sua baixa deve ocorrer em
Cartões de crédito. Compras não geram despesas bancárias duplicadas. Registre
saldo anterior, juros ou encargos como itens identificados e categorizados.

O fechamento dinâmico usa dias corridos antes do vencimento nominal. Ajustar o
vencimento ao próximo dia útil não desloca o fechamento. Compras no dia de
fechamento entram no próximo ciclo. O calendário considera fins de semana e
feriados nacionais, incluindo Sexta-feira Santa; não considera feriados locais.

## Séries e filtros

Parcelar divide o valor total; Repetir mantém o valor por ocorrência. O início
4/10 cria apenas 4 a 10, conservando a divisão original por dez parcelas. Datas
mensais preservam a âncora original, limitadas ao último dia de cada mês.

A prévia permite alterar valores, vencimentos e efetivação de cada ocorrência.
A soma de um parcelamento deve conservar o valor distribuído. Fixa mensal mantém
um horizonte de doze meses, renovado pela mutation `syncFinancialSeries` ao abrir
Contas a Pagar/Receber. Somente a primeira ocorrência pode herdar a efetivação
inicial da série fixa; ocorrências futuras permanecem pendentes. Não há débito
automático ou integração bancária.

Edição de série oferece somente esta ou esta e próximas pendentes; baixas já
efetivadas não são alteradas por edições em lote. Cancelar a série impede sua
geração futura e cancela ocorrências pendentes a partir da parcela selecionada.

Dashboards aceitam uma, várias ou todas as contas. Saldo das contas e resultado
do período são exibidos separadamente. Transferências afetam saldo, mas não
receitas/despesas do consolidado. Metas continuam com suas próprias regras.

## Implantação e validação

Execute `npm run db:generate -w apps/backend` e os checks antes da publicação.
Aplique a migração com `npm run db:migrate -w apps/backend` no ambiente escolhido,
antes de disponibilizar os clientes novos. Não publique o frontend novo sobre
um backend ou banco sem a migração. Nenhuma migração é aplicada automaticamente
por iniciar a aplicação.

A migração `20261031010000_banking_corrections` corrige a atualização de baixas
históricas cuja categoria foi excluída. Ela deve ser aplicada também em bancos
que já receberam banking, sem modificar a migração original. Novos registros
continuam exigindo uma categoria ativa pertencente ao usuário. Séries preservam
os lembretes selecionados, inclusive nas ocorrências futuras.

Os testes de banking executam todas as migrations em PostgreSQL embarcado,
validam isolamento, unicidade, baixa, rollback, datas e arredondamento. Os testes
de interface cobrem contas, transferências, fechamento e seleção múltipla.
