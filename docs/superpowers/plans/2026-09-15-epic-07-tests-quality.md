# EPIC-07 — Plano de implementação de testes e qualidade

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar reproduzível a validação de autenticação, Analytics, cobertura, jornadas financeiras e builds do MoneyHub em Web, Android e iOS.

**Architecture:** Preservar `node:test`/Supertest no backend e Jest/React Native Testing Library no app. Adicionar c8 para cobertura do backend, Playwright para E2E Web sobre o aplicativo exportado e Maestro para smoke nativo. Firebase Auth Emulator, PostgreSQL descartável e o adapter mock de LLM fornecem dependências locais; a aplicação e GraphQL permanecem reais nas jornadas E2E.

**Tech Stack:** Node.js `>=22.13.0 <23`, TypeScript, npm workspaces, Expo, Firebase Auth Emulator, Java 21, PostgreSQL, c8, Jest, Playwright, Maestro e GitHub Actions como proposta de CI.

**Spec:** `docs/tasks/EPIC-07_TESTS.md`, `docs/development/TESTING_STRATEGY.md`, `docs/planning/DEFINITION_OF_DONE.md`, `docs/specs/AUTHENTICATION_SPEC.md`, `docs/specs/FIREBASE_ANALYTICS_ADAPTER_SPEC.md`.

## Global Constraints

- `Minimum coverage target is 80% for critical application code.` Este plano operacionaliza o alvo em statements, branches, functions e lines, separadamente por workspace.
- Os testes unitários devem mockar Firebase Auth, Firebase Analytics e clientes externos. Falhas de Analytics não podem interromper o produto.
- E2E usa o projeto `demo-moneyhub`, usuários sintéticos e banco exclusivo. Não usa credenciais Firebase reais nem Supabase remoto.
- Preservar as alterações documentais existentes no worktree. Não promover status por planejar tarefas.
- A implementação segue o contrato atual `GraphQLContext.auth` / `AuthContext.uid` / `AuthContext.userId`. A spec antiga de Auth Context usa `context.user`; reconciliar essa descrição na TASK-040, sem renomear APIs apenas para seguir o documento antigo.
- Não baixar thresholds, excluir arquivos difíceis ou substituir GraphQL por mocks para obter aprovação dos gates.
- Falhas de produto encontradas pelos testes exigem regressão reproduzível e correção delimitada. Mudanças de política de autenticação precisam de decisão explícita documentada.
- Builds nativos de teste pertencem a este épico; publicação em lojas e infraestrutura de produção pertencem ao EPIC-08.

## Diagnóstico da base e limites desta análise

Inspeção estática em 2026-09-15. Nenhuma suíte ou medição de cobertura foi executada durante este planejamento.

| Item | Evidência existente | Trabalho necessário |
| --- | --- | --- |
| TASK-040 | `apps/backend/tests/modules/auth/authentication/auth.test.ts`; integração em `tests/integration/foundation/foundation.test.ts` | Ampliar casos de falha e fronteiras HTTP/GraphQL; não recriar suíte |
| TASK-041 | `apps/frontend/tests/analytics.test.ts` contém cinco cenários | Completar matriz Web/nativo, concorrência, falhas e runtimes |
| TASK-034 | Backend usa `node --import tsx --test tests/**/*.test.ts` | Coletar arquivos não importados, emitir relatórios e exigir 80% |
| TASK-035 | Jest configurado em `apps/frontend/package.json` | Incluir arquivos não importados, medir variantes por plataforma e exigir 80% |
| TASK-015/036 | `apps/frontend/integration/auth-emulator.test.mjs` valida SDK e persistência simulada | Jornadas reais pela interface, browser storage, GraphQL e banco |
| TASK-042 | `expo export --platform all`; foundation test serve fixture HTML | Testar artefato exportado real e backend compilado |
| CI | Não foi encontrada pasta `.github` | Criar workflow executável e comandos locais equivalentes |
| Acessibilidade | Prevista na estratégia, sem task própria | Incorporar à TASK-015 e validar sem afirmar conformidade completa |

As contagens de 72/104/176 testes nos documentos são históricas. Não representam baseline medido neste plano.

### Dependências e decisões

1. TASK-040 e TASK-041 ampliam as bases existentes.
2. TASK-034 e TASK-035 medem cobertura e completam os testes faltantes.
3. TASK-015 cria infraestrutura E2E e um smoke Web mínimo.
4. TASK-042 valida build real e integra CI.
5. TASK-036 cobre autenticação pela interface.
6. TASK-015 termina com jornadas financeiras, acessibilidade e smoke nativo.

Metas financeiras são citadas na estratégia, mas não possuem implementação/task no índice. Registrar o E2E de metas como dependência de produto, fora do aceite executável deste épico; não criar teste pulado e contá-lo como entrega. Android/iOS permanecem no aceite: exportar bundles ou emular viewport mobile no Playwright não comprova execução nativa.

## Task 1 — TASK-040: ampliar testes Firebase Admin Auth Context

**Files:**
- Modify: `apps/backend/tests/modules/auth/authentication/auth.test.ts`.
- Modify: `apps/backend/tests/integration/foundation/foundation.test.ts`.
- Modify: `docs/specs/BACKEND_AUTH_CONTEXT_SPEC.md`.
- Conditional fix: `apps/backend/src/modules/auth/authentication/auth.ts`, `apps/backend/src/core/app/app.ts`, apenas para regressões comprovadas.

**Interfaces:** Consome `createFirebaseVerifier(dependencies): VerifyIdToken` e `createApp({ verifyIdToken })`. Produz testes do contrato `AuthContext`, erros GraphQL e encaminhamento de identidade.

- [ ] Executar baseline: `npm test -w apps/backend`. Registrar número de testes, falhas, Node e comando.
- [ ] Adicionar teste garantindo que token rejeitado não chama `getUser` nem persistência:

```ts
test('rejects token before reading identity or persistence', async () => {
  const verifier = createFirebaseVerifier({
    verifyToken: async () => { throw new Error('invalid-token'); },
    getUser: async () => { assert.fail('getUser must not run'); },
    identityRepository: {
      synchronizeExistingIdentity: async () => { assert.fail('repository must not run'); }
    }
  });
  await assert.rejects(verifier('invalid'), /invalid-token/);
});
```

- [ ] Ampliar a matriz: token expirado/rejeitado, e-mail ausente, normalização, perfil inexistente, falha do repositório, objeto congelado, duas identidades consecutivas sem compartilhar contexto. Usar dependências injetadas; nenhuma chamada real ao Admin SDK em unitários.
- [ ] Caracterizar separadamente o fallback atual de `getUser` para claims do token. Registrar que revogação/usuário desabilitado depende da verificação real do SDK; não simular uma garantia que `createFirebaseVerifier` não implementa.
- [ ] Adicionar integração HTTP para cabeçalho ausente, esquema inválido, Bearer vazio, token rejeitado, `me` público, query protegida anônima e usuário não verificado. Validar `errors[].extensions.code`; não presumir que todo erro de resolver retorna HTTP 401/403, pois GraphQL pode retornar HTTP 200 com errors.
- [ ] Reutilizar testes financeiros de isolamento existentes e acrescentar o caso de troca de identidade na mesma instância do app. A identidade interna deve vir do contexto, nunca de argumento enviado pelo cliente.
- [ ] Executar testes novos. Casos de comportamento já implementado podem passar imediatamente; não introduzir defeito artificial para obter vermelho. Se um caso falhar, analisar e corrigir com regressão antes de marcar a task.
- [ ] Atualizar a spec para `context.auth`, UID Firebase versus ID local, transporte de erros e garantias efetivamente verificadas.
- [ ] Aceite: `npm test -w apps/backend`, `npm run lint -w apps/backend`, `npm run typecheck -w apps/backend` passam. Registrar evidência e commit delimitado `test: expand Firebase auth context coverage`.

## Task 2 — TASK-041: completar Analytics Web/nativo

**Files:**
- Modify: `apps/frontend/tests/analytics.test.ts`.
- Create: `apps/frontend/tests/analyticsRuntime.test.ts`.
- Test targets: `apps/frontend/src/services/analytics.ts`, `analyticsRuntime.web.ts`, `analyticsRuntime.native.ts`, `analyticsRuntime.ts`.

**Interfaces:** Consome `createWebAnalyticsAdapter`, `createNativeAnalyticsAdapter`, `createNoopAnalyticsAdapter` e os quatro métodos `logEvent`, `setCurrentScreen`, `setUserId`, `setUserProperties`.

- [ ] Executar `npm test -w apps/frontend -- analytics.test.ts` como baseline.
- [ ] Adicionar casos para rejeição de `isSupported`, erro de inicialização, falha síncrona e assíncrona de cada operação, sucesso de cada operação nativa e reset `setUserId(null)`.
- [ ] Validar cache de inicialização com chamadas concorrentes:

```ts
test('initializes web analytics once for concurrent operations', async () => {
  const initialize = jest.fn(() => ({ platform: 'web' }));
  const adapter = createWebAnalyticsAdapter({
    isSupported: jest.fn(async () => true), initialize,
    logEvent: jest.fn(), setCurrentScreen: jest.fn(),
    setUserId: jest.fn(), setUserProperties: jest.fn()
  });
  await Promise.all([adapter.logEvent('login'), adapter.setUserId(null)]);
  expect(initialize).toHaveBeenCalledTimes(1);
});
```

- [ ] Repetir o teste de concorrência para o loader nativo. Cobrir valores permitidos, campos desconhecidos e valores inválidos nas duas plataformas, preservando a allowlist atual.
- [ ] Nos runtimes, importar arquivos com extensão de plataforma explícita e mockar `firebase/analytics`, `@react-native-firebase/analytics` e inicialização Firebase. Restaurar mocks/módulos entre testes para não mascarar cache.
- [ ] Aceite: `npm test -w apps/frontend -- analytics.test.ts analyticsRuntime.test.ts`; nenhuma conexão de rede, todas as promessas de Analytics resolvem mesmo quando o SDK falha. Rodar lint/typecheck e commit `test: complete analytics adapter scenarios`.

## Task 3 — TASK-034: cobertura backend com coleta completa

**Files:**
- Modify: `apps/backend/package.json`, `package-lock.json`.
- Create: `apps/backend/.c8rc.json`.
- Modify: testes existentes em `apps/backend/tests/core`, `tests/modules` e `tests/integration` conforme relatório.

**Interfaces:** Produz `npm run test:coverage -w apps/backend` e `apps/backend/coverage/{lcov.info,coverage-summary.json}`.

- [ ] Instalar c8 como dependência de desenvolvimento do backend e registrar versão resolvida no lockfile: `npm install -D c8 -w apps/backend`.
- [ ] Adicionar script `"test:coverage": "c8 npm test"` e configuração:

```json
{
  "all": true,
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.d.ts", "src/generated/**", "src/server.ts"],
  "reporter": ["text", "lcov", "json-summary"],
  "report-dir": "coverage",
  "check-coverage": true,
  "lines": 80,
  "branches": 80,
  "functions": 80,
  "statements": 80
}
```

`server.ts` é o entrypoint de processo exercitado pela TASK-042; classes de negócio, GraphQL, banco e wrappers Firebase permanecem no denominador. Código gerado e declarações não são código de aplicação.

- [ ] Rodar o comando e registrar baseline por métrica e arquivo. Verificar sourcemaps: os arquivos do relatório devem ser `.ts` da aplicação, não o loader `tsx` nem arquivos duplicados.
- [ ] Completar testes a partir de branches descobertos: validação, autorização, caminho vazio, erro de dependência e idempotência. A task não termina só por adicionar configuração.
- [ ] Demonstrar o gate com fixture temporária isolada contendo função não executada dentro de um diretório incluído; comprovar que aparece no relatório. Executar um gate controlado com alvo 100 e cobertura menor que 100 para comprovar exit code diferente de zero. Remover somente a fixture criada para essa prova.
- [ ] Aceite: quatro métricas >=80%, nenhum conjunto vazio aprovado, relatório inclui módulos nunca importados, `npm run test:coverage -w apps/backend` passa. Commit `test: enforce backend coverage thresholds`.

## Task 4 — TASK-035: cobertura Expo/Jest

**Files:**
- Modify: `apps/frontend/package.json`.
- Modify: suítes existentes em `apps/frontend/tests`.

**Interfaces:** Produz `npm run test:coverage -w apps/frontend` e `apps/frontend/coverage/{lcov.info,coverage-summary.json}`.

- [ ] Adicionar script `"test:coverage": "jest --runInBand --coverage"`; preservar preset, mapper e setup atuais. Acrescentar:

```json
{
  "collectCoverageFrom": [
    "src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}", "!**/*.d.ts"
  ],
  "coverageDirectory": "coverage",
  "coverageReporters": ["text", "lcov", "json-summary"],
  "coverageThreshold": {
    "global": { "statements": 80, "branches": 80, "functions": 80, "lines": 80 }
  },
  "testPathIgnorePatterns": ["/node_modules/", "/dist/", "/e2e/"]
}
```

- [ ] Rodar `npm run test:coverage -w apps/frontend`; registrar métricas e conferir arquivos `.web.ts` e `.native.ts`. Importar variantes explicitamente em testes para verificar ambas, sem excluir uma plataforma.
- [ ] Completar testes em AuthProvider, Apollo, rotas, formulários e módulos financeiros/IA apontados pelo relatório. Testar comportamento observável: loading, erro, sucesso e novas tentativas; evitar snapshots extensos como substituto.
- [ ] Fazer prova controlada de reprovação do threshold e inclusão de arquivo não importado, conforme procedimento da TASK-034, no workspace frontend.
- [ ] Aceite: quatro métricas >=80%, suítes de plataforma incluídas, nenhum E2E descoberto pelo Jest. Rodar lint/typecheck e commit `test: enforce Expo coverage thresholds`.

## Task 5 — TASK-015, parte A: infraestrutura E2E isolada e smoke inicial

**Files:**
- Modify: `package.json`, `package-lock.json`, `.gitignore`, `eslint.config.js`.
- Create: `playwright.config.ts`, `e2e/tsconfig.json`.
- Create: `e2e/compose.yaml`, `e2e/run.mjs`, `e2e/environment.mjs`, `e2e/environment.test.mjs`.
- Create: `e2e/web/smoke.spec.ts`.
- Reuse: `firebase.json` na raiz.

**Interfaces:** Produz `npm run test:e2e`, `npm run typecheck:e2e`, app em `http://127.0.0.1:3100`, Auth Emulator em `127.0.0.1:9099` e PostgreSQL exclusivo em `127.0.0.1:55432/moneyhub_e2e`. O runner aceita argumentos Playwright, como `--grep @smoke`.

- [ ] Instalar `@playwright/test` na raiz e browsers com `npm exec playwright install --with-deps chromium`. Fixar versões resolvidas no lockfile; não migrar os runners unitários.
- [ ] Criar Compose com imagem PostgreSQL compatível com o schema atual, fixando tag testada, banco `moneyhub_e2e`, porta 55432 e healthcheck `pg_isready`. Não montar diretório de dados do usuário. O runner encerra somente processos/containers que criou; limpeza de dados se limita ao projeto Compose E2E.
- [ ] Implementar `createE2eEnvironment(parent)` e seu teste antes de iniciar serviços:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createE2eEnvironment } from './environment.mjs';

test('replaces external services with local test dependencies', () => {
  const env = createE2eEnvironment({
    PATH: 'test-path', DATABASE_URL: 'postgresql://remote/production',
    LLM_BASE_URL: 'https://provider.example', LLM_API_KEY: 'sensitive'
  });
  assert.equal(env.FIREBASE_PROJECT_ID, 'demo-moneyhub');
  assert.equal(new URL(env.DATABASE_URL).hostname, '127.0.0.1');
  assert.equal(env.LLM_PROVIDER, 'mock');
  assert.equal(env.LLM_BASE_URL, undefined);
  assert.equal(env.LLM_API_KEY, undefined);
});
```

- [ ] A função deve preservar variáveis necessárias ao SO e substituir explicitamente `APP_URL`, `PORT`, `DATABASE_URL`, `DIRECT_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_AUTH_EMULATOR_HOST`, `FIREBASE_WEB_API_KEY` e os quatro campos Firebase públicos obrigatórios. Usar `demo-api-key`, `demo-app-id`, `demo-moneyhub.firebaseapp.com` e `EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099`. Remover credenciais Admin e todas as variáveis de endpoint/chave LLM, inclusive `OPENAI_API_KEY`. Definir `EXPO_NO_DOTENV=1`; conferir os loaders próprios para que `.env` não reintroduza valores removidos. Se necessário, adicionar modo de configuração de teste documentado e testado no loader, nunca sobrescrever `.env` do usuário.
- [ ] Implementar `run.mjs` com `spawn` e arrays de argumentos, cuidando de Windows (`npm.cmd`) e Linux. Sequência: validar ambiente/portas; subir PostgreSQL; esperar health; executar migrations existentes; exportar app e compilar backend; executar Firebase `emulators:exec --config firebase.json --project demo-moneyhub --only auth`; iniciar backend; esperar `/health`; executar Playwright; finalizar filhos em `finally` preservando exit code. Não executar `migrate reset` ou migrations em URL herdada. Ao implementar fixtures SQL/Prisma, ler a skill PostgreSQL do projeto antes de escrever operações de banco.
- [ ] Configurar Playwright:

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e/web', fullyParallel: false, workers: 1,
  forbidOnly: Boolean(process.env.CI), retries: 0,
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
```

- [ ] Criar smoke concreto:

```ts
import { test, expect } from '@playwright/test';
test('@smoke renders exported login', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Senha', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
});
```

- [ ] Adicionar `test:e2e` = `node e2e/run.mjs`, `typecheck:e2e` = `tsc -p e2e/tsconfig.json --noEmit`. O tsconfig deve incluir config/testes e tipos Node/Playwright sem entrar no build do backend. Ignorar `playwright-report/`, `test-results/` e artefatos locais de emulador; adicionar scripts/testes E2E ao lint.
- [ ] Aceite: `node --test e2e/environment.test.mjs`, `npm run typecheck:e2e` e `npm run test:e2e -- --grep @smoke` passam em ambiente limpo e encerram recursos também quando um teste falha. Commit `test: add isolated web E2E harness`.

## Task 6 — TASK-042: build Web real e CI

**Files:**
- Modify: `e2e/web/smoke.spec.ts`, `e2e/run.mjs`, `apps/backend/package.json` se o caminho compilado estiver incorreto.
- Create: `.github/workflows/quality.yml`.
- Modify: `docs/development/DEVELOPMENT_GUIDE.md`.

**Interfaces:** Consome runner da Task 5; produz gates de PR para cobertura, qualidade e smoke de build.

- [ ] Conferir output de `npm run build -w apps/backend`. `tsconfig.json` tem `rootDir: "."`, enquanto `start` aponta `dist/server.js`: verificar se o arquivo emitido é `dist/src/server.js`. Corrigir `start`/`main` se a divergência se confirmar e provar com execução do comando público, sem esconder o problema no runner.
- [ ] Acrescentar smoke para `/`, `/login`, `/register`, `/forgot-password` e `/reset-password` sem código. Cada rota deve renderizar estado válido, inclusive erro controlado de código ausente, sem tela branca. Fazer refresh de uma rota profunda.
- [ ] Validar `/health`, POST `/graphql` com `{ health { status } }`, carregamento dos assets JS/CSS e ausência de `pageerror`. Usar resposta de assets, não apenas HTTP 200 da página: fallback SPA pode mascarar asset inexistente.
- [ ] Criar workflow com jobs independentes `quality`, `backend-coverage`, `frontend-coverage`, `web-e2e`. Configurar Node 22, Java 21 onde necessário, `npm ci`, cache por lockfile e ambiente demo. Rodar testes, lint, typecheck, build e ambos os comandos de cobertura. No E2E, instalar Chromium e usar o runner da Task 5; não iniciar um segundo PostgreSQL na mesma porta.
- [ ] Publicar relatórios e traces com `if: always()` e retenção de 7 dias. Dados e tokens devem ser somente do emulador; não salvar `.env` nem dump do processo. Falha de gate não pode usar `continue-on-error`.
- [ ] Usar `pull_request` e `push`; configurar nomes estáveis de jobs. Documentar que exigir esses checks em branch protection é configuração do repositório, não efeito automático do YAML.
- [ ] Aceite: build limpo seguido de `npm run test:e2e -- --grep @smoke` passa; remoção controlada de um asset no artefato temporário reprova o smoke; workflow tem resultados reais antes da conclusão. Commit `ci: verify exported Expo web application`.

## Task 7 — TASK-036: Firebase Auth E2E pela interface

**Files:**
- Create: `e2e/web/auth.spec.ts`, `e2e/fixtures/auth.ts`.
- Reuse: `apps/frontend/integration/auth-emulator.test.mjs`.
- Conditional fix: componentes de autenticação apenas quando teste demonstrar regressão.

**Interfaces:** `auth.ts` fornece `createEmulatorUser(input: { email: string; password: string; emailVerified: boolean }): Promise<{ uid: string }>` via API exclusiva do emulador e `deleteEmulatorUser(uid: string): Promise<void>`. Cada teste recebe usuário exclusivo, sem estado compartilhado entre casos.

- [ ] Fixture deve validar projeto demo e host local antes de criar/remover usuário. Criar contas auxiliares pelo emulador, mas o teste de cadastro deve cadastrar pela UI. Apagar somente usuários criados pelo teste; nunca limpar todos os usuários de um servidor arbitrário.
- [ ] Cobrir cadastro pela UI, confirmação de senha divergente e e-mail duplicado. Conferir bootstrap local via GraphQL e destino real de navegação conforme layouts existentes.
- [ ] Cobrir login, senha inválida com mensagem neutra e restauração após reload usando persistência real do navegador.
- [ ] Cobrir logout seguido de reload e URL protegida; não basta verificar clique em Sair. Conferir que GraphQL deixa de usar token antigo e dados de outro usuário não permanecem visíveis.
- [ ] Cobrir usuário não verificado bloqueado nas operações financeiras com `EMAIL_NOT_VERIFIED`; atualizar `emailVerified` pelo emulador para simular verificação, renovar identidade e comprovar acesso após fluxo normal. Esse caso não comprova entrega real de e-mail.
- [ ] Verificar token real enviado ao backend e duas contas isoladas. Não usar `page.route` para substituir Auth/GraphQL nas jornadas de sucesso. A integração SDK antiga permanece como teste rápido independente.
- [ ] Usar locators acessíveis existentes: `getByLabel('Email', { exact: true })`, `getByLabel('Senha', { exact: true })`, `getByRole('button', { name: 'Entrar', exact: true })`. Esperar resultado de UI/requisição; não usar sleeps fixos.
- [ ] Aceite: `npm run test:e2e -- auth.spec.ts` e `npm run test:auth-emulator -w apps/frontend` passam; contas são independentes em duas execuções consecutivas. Commit `test: cover Firebase authentication browser flows`.

## Task 8 — TASK-015, parte B: jornadas financeiras e acessibilidade

**Files:**
- Create: `e2e/web/financial-flow.spec.ts`, `e2e/web/ai.spec.ts`, `e2e/web/accessibility.spec.ts`.
- Create: `e2e/fixtures/financial.ts`.
- Modify: `apps/frontend/tests/AuthForm.test.tsx`, `apps/frontend/tests/Transactions.test.tsx`, `apps/frontend/tests/AccountsPayable.test.tsx`, `apps/frontend/tests/AiAssistant.test.tsx`.
- Modify: `package.json`, `package-lock.json` para `@axe-core/playwright`.

**Interfaces:** Consome usuários do emulador e GraphQL real. Fixtures preparam perfil/categoria pelo contrato público; a operação sob teste é feita pela interface.

- [ ] Cobrir receita de R$ 1.000,00 e despesa de R$ 250,00, ambas no mês corrente. Confirmar persistência após reload e saldo líquido de R$ 750,00 no dashboard, com usuário inicialmente sem transações.
- [ ] Criar conta a pagar de R$ 100,00 pela UI, comprovar estado pendente e preservação após reload. Manter pagamento/recorrência em seus testes existentes, salvo regressão direta desta jornada.
- [ ] Fazer pergunta pela tela IA com `LLM_PROVIDER=mock` e endpoint LLM externo removido. Validar resposta não vazia, período e isolamento do contexto; não exigir texto idêntico de um provedor real.
- [ ] Adicionar verificações de acessibilidade automatizadas em login, dashboard, formulário financeiro e IA, além de navegação por teclado. Exemplo de teste completo para login:

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('login has no serious or critical accessibility violations', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
});
```

- [ ] Nos testes React Native, validar nomes acessíveis, roles, estados disabled/loading e mensagens de erro. Correções de labels/foco devem ser mínimas e acompanhadas de regressão; não desabilitar regras globalmente.
- [ ] Aceite: jornadas independentes passando no CI, nenhuma violação serious/critical nos fluxos escolhidos e navegação por teclado funcional. Registrar limitações de avaliação automática e commit `test: cover financial journeys and accessibility`.

## Task 9 — TASK-015/036: smoke Android e iOS

**Files:**
- Create: `.maestro/auth.yaml`, `.maestro/financial.yaml`, `.maestro/ai.yaml`.
- Create: `docs/development/NATIVE_TESTING.md`, `.github/workflows/native-quality.yml`.
- Modify: `apps/frontend/app.config.ts` para identificadores de teste e seleção explícita da configuração Firebase nativa, caso necessário.

**Interfaces:** Consome os mesmos serviços demo das jornadas Web, app nativo instalado e variáveis `APP_ID`, `E2E_EMAIL`, `E2E_PASSWORD` passadas ao Maestro.

- [ ] Preparar development builds locais Android/iOS sem publicação. Verificar requisitos dos plugins `@react-native-firebase/app`/Analytics e arquivos Firebase específicos de teste antes de compilar. Usar identificador de teste `com.moneyhub.e2e` somente no perfil de teste; não definir identificador de produção por conveniência.
- [ ] Documentar Android SDK, dispositivo/emulador, macOS/Xcode para iOS, Java 21 e versão Maestro fixada. Compilar a partir de checkout de teste; `expo run:android` e `expo run:ios` geram diretórios nativos quando necessário. Não confundir Expo export com build instalável.
- [ ] Mapear serviços: Android Emulator usa `10.0.2.2` para backend/Auth Emulator, iOS Simulator usa loopback do host. Verificar limites de HTTP cleartext/ATS apenas no build de teste. Metro e backend precisam estar acessíveis pelo dispositivo.
- [ ] Usar fluxo inicial:

```yaml
appId: ${APP_ID}
---
- launchApp:
    clearState: true
- tapOn: Email
- inputText: ${E2E_EMAIL}
- tapOn: Senha
- inputText: ${E2E_PASSWORD}
- tapOn: Entrar
```

Completar com assert do dashboard realmente renderizado, logout e reabertura sem sessão. Acrescentar cadastro/login, criação de receita/despesa/conta a pagar e pergunta IA, usando os mesmos valores e asserts de negócio da Task 8. Validar seletores na árvore acessível de cada plataforma; adicionar `testID` estável apenas onde labels não bastarem.

- [ ] Executar `maestro test -e APP_ID=com.moneyhub.e2e -e E2E_EMAIL=usuario-do-emulador@example.test -e E2E_PASSWORD=senha-sintetica .maestro/` em Android e iOS, com contas criadas exclusivamente para cada execução.
- [ ] Criar workflow nativo com runner Android compatível com virtualização e runner macOS para iOS, mantendo serviços locais no mesmo host de cada job. Armazenar relatórios/logs sintéticos; executar por despacho e em alterações de app relevantes conforme disponibilidade dos runners.
- [ ] Fazer inspeção TalkBack/VoiceOver dos fluxos de autenticação e criação de transação; registrar foco, labels e resultado no documento de evidência.
- [ ] Aceite: evidência de execução Android e iOS. Sem macOS, build instalável ou configuração Firebase nativa de teste, registrar a dependência e manter esta parte aberta; não concluir EPIC-07 somente com Web. Commit `test: add native application smoke coverage`.

## Task 10 — fechar evidências e sincronizar documentação

**Files:**
- Modify: `docs/tasks/EPIC-07_TESTS.md`, `docs/tasks/TASK_INDEX.md`, `docs/development/TESTING_STRATEGY.md`, `docs/planning/TASK_EXECUTION_GUIDE.md`, `docs/development/DEVELOPMENT_GUIDE.md`.
- Create: `docs/development/EPIC_07_VERIFICATION.md`.

**Interfaces:** Consome relatórios das Tasks 1–9. Produz status verificável de cada task, com data, commit, comando, ambiente, contagem e resultado.

- [ ] Registrar quais cenários cada task cobre e suas evidências. Substituir a seção de números históricos por execução atual identificada, sem apresentar estimativas como testes executados.
- [ ] Executar `npm test`, `npm run lint`, `npm run typecheck`, `npm run typecheck:e2e`, `npm run build`, os dois comandos de cobertura e `npm run test:e2e` no ambiente documentado.
- [ ] Conferir execução nativa Android/iOS e acessibilidade; não aceitar teste skipped como evidência de funcionalidade. Registrar E2E de metas como dependência externa de produto, explicitamente fora do conjunto executável aprovado neste plano.
- [ ] Atualizar TASK-040/041/034/035/042/036 individualmente quando seus critérios passarem. TASK-015 depende das partes A/B e nativa; EPIC-07 só passa a Done quando todas estiverem concluídas.
- [ ] Revisar diffs para preservar os documentos modificados antes desta execução; realizar `git diff --check`. Commit apenas dos arquivos desta entrega: `docs: record epic 07 verification evidence`.

## Referências técnicas consultadas

- [Playwright: CI](https://playwright.dev/docs/ci) — instalação de browsers/dependências e execução com worker único.
- [c8](https://github.com/bcoe/c8) — inclusão de arquivos não importados com `all` e thresholds.
- [Jest: configuração](https://jestjs.io/docs/configuration) — `collectCoverageFrom` e `coverageThreshold`.
- [Firebase Auth Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth) — projeto demo e conexão Admin pelo host do emulador.
- [Maestro para React Native](https://docs.maestro.dev/platform-support/react-native) — testes pela camada de acessibilidade em apps nativos.
- [Expo: builds locais](https://docs.expo.dev/guides/local-app-development/) — pré-requisitos para development builds.

## Revisão do plano

- As sete tasks originais possuem entregáveis e aceite; a TASK-015 foi decomposta por infraestrutura, jornadas e plataformas.
- Acessibilidade está incluída e metas financeiras têm dependência explícita, sem task ficticiamente concluída.
- Foram utilizados caminhos atuais após reorganização do backend.
- Nenhuma aprovação de smoke Firebase real, cobertura atual ou sucesso de CI foi inferida da documentação histórica.
- Escopo desta entrega: planejamento. Implementação, instalação de dependências, execução de suítes e publicação de workflows ainda não ocorreram.
