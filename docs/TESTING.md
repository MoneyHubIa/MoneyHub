# Testes e verificação

Palavras-chave: @tests | testes | cobertura | e2e | maestro | ci | acessibilidade

Escolha verificações pelo risco e pelo domínio alterado. Existência de teste,
export de bundle e status de entrega não substituem execução registrada.

## Comandos na raiz

| Comando | Alcance |
| --- | --- |
| npm test | Automação de release e testes dos workspaces; backend node:test e frontend Jest/jest-expo. |
| npm run test:release | Testes da automação de release, incluindo versionamento em repositórios Git temporários sem publicação externa. |
| npm run lint | ESLint dos workspaces e e2e. |
| npm run typecheck | TypeScript dos workspaces. |
| npm run typecheck:e2e | TypeScript do Playwright. |
| npm run build | Build backend e export Expo Web/Android/iOS. |
| npm run test:coverage -w apps/backend | c8, mínimos 80% statements/branches/functions/lines. |
| npm run test:coverage -w apps/frontend | Jest, mínimos 80% globais nas quatro métricas. |
| node --test e2e/*.test.mjs | Testes do harness E2E. |
| npm run test:e2e | Stack local completa e Playwright Chromium. |
| npm run test:auth-emulator -w apps/frontend | Integração Firebase cliente com Auth Emulator. |

Backend usa Supertest para HTTP; mocks para dependências externas.
A cobertura backend inclui src e exclui generated, declarações e server.ts.
Frontend mede src/app, excluindo declarações; usa React Native Testing Library.
Mocks/adapters de Firebase e IA evitam usar serviços reais nos testes unitários.

## Smoke do Docker Compose

Com Docker ativo, execute `docker compose up --build -d --wait`. Em ambiente de
desenvolvimento com `npm ci` e Chromium do Playwright instalado, execute:

~~~sh
node e2e/compose-smoke.mjs
~~~

O smoke usa as portas e credenciais do README, valida login real no Auth Emulator,
dados via GraphQL/proxy, recuperação de senha local e navegação Web em Chromium.
Destina-se a uma demonstração recém-criada; não altera a senha do usuário.

A integração do seed usa `DEMO_SEED_TEST_DATABASE_URL` e exige banco descartável
`moneyhub_demo_test` com migrations aplicadas. Execute
`node --import tsx --test apps/backend/tests/integration/demo/demo-seed.integration.test.ts`.
O teste valida contagens, preservação de edições/exclusões lógicas, datas e saldos;
a identidade Firebase é simulada nesse teste de banco.

## E2E Web

Requisitos: Node da faixa suportada em [@setup](SETUP.md), Java 21,
Docker Compose e Chromium do Playwright.

~~~sh
npx playwright install chromium
npm run test:e2e -- --grep @smoke
npm run test:e2e -- e2e/web/financial-goals.spec.ts
~~~

O runner gerencia projeto Compose moneyhub-e2e, migrations, Auth Emulator,
backend, SPA de teste, Playwright e limpeza de containers/volume.
Usa PostgreSQL 17.6 em 127.0.0.1:55432, demo-moneyhub,
backend em 3000 e SPA em 3100.

Ambiente força LLM_PROVIDER mock, valores sintéticos e EXPO_NO_DOTENV=1.
Sobrescreve variáveis e remove uma lista de credenciais herdadas; não remove
todo o ambiente do host. Revise configurações externas antes de execução.

Cenários existentes incluem autenticação, persistência financeira, metas,
IA mock e acessibilidade axe. Nenhuma contagem histórica é garantia atual.

## Integração real de metas

Sem FINANCIAL_GOALS_TEST_DATABASE_URL, o teste de banco fica explicitamente
ignorado. Configure somente banco local descartável, aplique migrations e execute:

~~~powershell
$env:FINANCIAL_GOALS_TEST_DATABASE_URL = 'postgresql://moneyhub_e2e:moneyhub_e2e@127.0.0.1:55432/moneyhub_e2e?sslmode=disable'
node --import tsx --test apps/backend/tests/integration/financial-goals/financial-goals.integration.test.ts
~~~

O teste rejeita hosts remotos e banco diferente de moneyhub_e2e.
Cobre concorrência, idempotência, histórico/saldo, isolamento e exclusão.
O runner completo também executa essa integração.

## Android e iOS

Requisitos adicionais: Maestro, development build com Firebase de teste,
Android SDK/Java para Android e macOS/Xcode para iOS.
Configure PostgreSQL, backend, Auth Emulator e Metro acessíveis ao dispositivo;
crie usuário verificado e perfil sintéticos.

No diretório apps/frontend, defina E2E_NATIVE=1, APP_URL e
EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL conforme [@setup](SETUP.md).
Depois execute npx expo run:android ou npx expo run:ios.

Na raiz, execute os fluxos auth/financial/ai. Substitua METRO_URL pela URL do
launcher e informe credenciais sintéticas, categoria e dispositivo corretos:

~~~sh
maestro test --no-reinstall-driver --udid emulator-5554 -e APP_ID=com.moneyhub.e2e -e E2E_DEV_SERVER_URL=METRO_URL -e E2E_EMAIL=usuario@example.test -e E2E_PASSWORD=senha-sintetica -e E2E_CATEGORY=Geral .maestro/
~~~

Fluxos limpam estado local; E2E_DEV_SERVER_URL permite selecionar Metro novamente.
No Windows, --no-reinstall-driver evita reinstalar instrumentação entre fluxos.
TalkBack/VoiceOver exigem inspeção manual de foco, labels, estados e erros.
Expo export não gera APK/AAB/IPA nem prova execução nativa.

## CI e evidências

Workflow quality possui jobs quality, backend-coverage, frontend-coverage e
web-e2e em Node 22. Não executa Maestro Android/iOS.
O job quality também executa `npm run test:release`. O workflow Release reutiliza
os mesmos jobs antes do deploy; veja [Releases](RELEASE.md).
Branch protection e estado atual dos checks são externos ao conteúdo do workflow.

Registre comando, ambiente, revisão/build, resultado e artefato na entrega.
Não apresente teste ignorado, mock ou evidência Web como validação nativa/provedor real.
Lacunas conhecidas de evidência estão em [@limits](LIMITS.md).

## Fontes

[Scripts](../package.json), [c8](../apps/backend/.c8rc.json),
[Jest](../apps/frontend/package.json), [runner](../e2e/run.mjs),
[ambiente](../e2e/environment.mjs), [Playwright](../playwright.config.ts),
[Maestro](../.maestro), [CI](../.github/workflows/quality.yml).

Relacionados: [@setup](SETUP.md), [@finance](FINANCE.md), [@deploy](DEPLOY.md).
