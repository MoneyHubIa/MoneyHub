# Metas financeiras — migration e Vercel

Implementação local da TASK-052. Este procedimento prepara a publicação; não constitui aplicação em produção.

## Antes de publicar

1. Confirme backup, ambiente de destino e aprovação para aplicar a migration em produção.
2. Configure DATABASE_URL e, quando necessário, DIRECT_URL para conexão direta de migrations. Não use o banco de produção nos testes.
3. No backend, execute `npm run db:generate -w apps/backend` e valide `npm run db:validate -w apps/backend`.
4. Execute `npm run db:status -w apps/backend`. Confira a migration pendente `20261004000000_financial_goals`.
5. Aplique `npm run db:migrate -w apps/backend` no ambiente aprovado. A migration cria somente tabelas, constraints e índices de metas; não modifica os saldos de receitas/despesas.
6. Publique o backend na Vercel após a migration e publique o frontend com expo-crypto instalado pelo lockfile. Como novo módulo nativo, uma aplicação Android já instalada precisa de novo build nativo.
7. Verifique GraphQL, tela Metas, resumo e contexto IA com uma conta de teste. Cadastre alvo 1000, aporte 250, confirme 25% após reload, retire 50 e confirme 20%.

Não reverta a migration apagando tabelas: histórico contém dados dos usuários. Em caso de rollback do aplicativo, mantenha tabelas aditivas e retorne ao build anterior.

## Testes locais PostgreSQL

Suba o banco descartável de `e2e/compose.yaml`, aplique migrations usando exclusivamente a URL local e execute:

```powershell
$env:FINANCIAL_GOALS_TEST_DATABASE_URL = 'postgresql://moneyhub_e2e:moneyhub_e2e@127.0.0.1:55432/moneyhub_e2e?sslmode=disable'
node --import tsx --test apps/backend/tests/integration/financial-goals/financial-goals.integration.test.ts
```

O teste rejeita hosts remotos e nomes de banco diferentes de moneyhub_e2e; sem variável, fica explicitamente ignorado. Limpeza remove somente usuários criados pelo teste.

Execute `npm run test:e2e -- e2e/web/financial-goals.spec.ts` para PostgreSQL, Firebase Auth Emulator e Playwright locais. O runner limpa seus containers/volumes ao finalizar.

Backend Vercel: [configuração existente](VERCEL_BACKEND.md). Frontend Vercel: [configuração existente](VERCEL_FRONTEND.md).

O runner E2E define RATE_LIMIT_MAX=10000 e RATE_LIMIT_WINDOW_MS=900000 somente no ambiente local: vários cenários compartilham um IP. Não altera os limites do backend em produção.
