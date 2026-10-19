# TASK-052 — Implementar metas financeiras

EPIC principal: EPIC-03. Integrações: EPIC-04 e EPIC-05.

Status: Done (implementação local verificada). Publicação em produção separada.

## Entrega local

Cadastro, edição, aporte, retirada, histórico paginado e exclusão lógica de metas. Saldo inicial zero; poupança existente deve ser registrada como primeiro aporte. Movimentos representam acompanhamento e não geram receitas, despesas ou alterações no fluxo de caixa.

Valores positivos em strings decimais, até duas casas, limite 999999999999.99 por valor/saldo. Dinheiro persistido como Decimal(14,2), cálculos de saldo em centavos inteiros. Datas financeiras YYYY-MM-DD, sem horário; prazo não antecede início. Descrição e observações até 500 caracteres; nome até 120.

Estado calculado: COMPLETED quando saldo >= alvo; OVERDUE quando prazo < dia UTC atual sem conclusão; ACTIVE nos demais casos. Aporte acima do alvo permitido; retirada reabre conclusão. Percentual real pode superar 100%, barra limitada a 100%. Retirada não pode deixar saldo negativo.

Todas as operações exigem autenticação, e-mail verificado, userId e profileId válidos no contexto. Proprietário não vem do cliente. Meta alheia/excluída retorna NOT_FOUND. Entrada inválida retorna BAD_USER_INPUT.

## Persistência e concorrência

Migration aditiva: `20261004000000_financial_goals`. Tabelas `financial_goals` e `financial_goal_movements`; UUIDs, datas DATE e timestamps TIMESTAMPTZ(3). Histórico imutável pela API, preservado na exclusão lógica.

Aporte/retirada bloqueia a meta por SELECT FOR UPDATE dentro de transação curta, grava histórico e atualiza saldo atomicamente. Edição/exclusão usam o mesmo bloqueio. Chave única (goal_id, operation_id) impede duplicação em retentativas. Mesmo operationId com payload diferente retorna BAD_USER_INPUT. Novo payload requer novo UUID. Retentativa idêntica retorna saldo atual, sem movimento adicional.

Histórico ordenado por created_at DESC, id DESC; cursor é UUID de movimento pertencente à meta. Página fixa de 20, consulta busca 21 para calcular hasNextPage. Data financeira pode ser retroativa; ordenação representa registro, não ocorrência.

## Integrações

Tela Metas no DashboardShell, filtros Todas/Ativas/Concluídas/Atrasadas, valores na moeda preferida do perfil, datas regionais, histórico e confirmação de exclusão. Moeda é preferência de apresentação, sem conversão cambial.

Resumo usa todas as metas não excluídas, independente do mês do dashboard. Mutations atualizam consultas de metas, histórico, dashboard e contexto IA observadas pelo Apollo. Contexto IA é reconstruído em cada chamada e conserva goals: [String!]!: até 10 metas, atrasadas primeiro, depois ativas próximas do prazo, depois concluídas.

## Verificação

- Serviço: CRUD, autorização, isolamento, decimais, datas, conclusão/reabertura, insuficiência, idempotência e paginação.
- PostgreSQL real: aportes/retiradas concorrentes, retentativas simultâneas, consistência histórico/saldo, cursor alheio, exclusão concorrente e contexto IA.
- Frontend: formulários, filtros, barra, operação reutilizada, histórico, exclusão, envio duplicado e erros.
- E2E: meta 1000, aporte 250, 25% após reload, retirada 50, 20%, histórico, resumo independente do fluxo e segunda conta sem acesso.
- Comandos e resultados finais: ver [ledger](../superpowers/plans/2026-10-04-financial-goals-progress.md).

## Publicação

Ver [instruções de migration e Vercel](../development/FINANCIAL_GOALS_DEPLOYMENT.md). Aplicação em produção e redeploy são etapas separadas desta entrega.

## Limitação menor registrada em revisão

movements(after: "") trata cursor vazio como ausência e retorna primeira página. UUIDs de outra meta são rejeitados; isolamento continua preservado. A interface envia somente null ou UUIDs válidos.
