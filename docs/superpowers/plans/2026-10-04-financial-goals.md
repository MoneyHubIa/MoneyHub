# Implementar Metas financeiras

Plano aprovado na conversa em 2026-10-04. Implementação local; produção e redeploy separados.

1. Persistência: FinancialGoal e FinancialGoalMovement; UUID, Decimal(14,2), Date, Timestamptz, exclusão lógica, índices, operação idempotente e bloqueio da meta.
2. Backend: CRUD autorizado, valores positivos, datas válidas, saldo não negativo, estado e progresso calculados, histórico de 20 itens por cursor. Resumo global e até 10 metas priorizadas no contexto da IA.
3. Frontend: tela Metas, resumo, filtros, cadastro/edição, aporte/retirada, histórico, confirmação de exclusão, acessibilidade, retentativas e atualização dos dados integrados.
4. Verificação: testes de serviço, PostgreSQL concorrente, frontend e E2E; lint, typecheck, build e cobertura existentes.
5. Documentação: TASK-052, EPIC-03/04/05, modelo, contratos e instruções Vercel. Preservar alterações documentais anteriores.

Regras: saldo inicial zero; aporte acima do alvo permitido; retirada reabre conclusão; movimentos não alteram fluxo de caixa. Dinheiro em strings decimais. Histórico imutável. Proprietário obtido do contexto, metas alheias/excluídas retornam NOT_FOUND.
