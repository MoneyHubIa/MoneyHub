# Ambiente e desenvolvimento local

Palavras-chave: @setup | ambiente | env | instalar | executar | rede

Para desenvolver sem Docker, use Node >=22.13.0 <23 e npm na raiz. O template .env.example usa valores demonstrativos;
as tabelas abaixo incluem configurações opcionais ausentes dele.

## Demonstração com Docker

Execute `docker compose up --build` na raiz. Basta Docker com Compose v2;
não é necessário copiar `.env` nem instalar dependências no host. Veja o
[tutorial, URLs e credenciais](../README.md).

Opcionalmente, copie `.env.example` para `.env`. O Compose lê somente
`MONEYHUB_RATE_LIMIT_MAX` e `MONEYHUB_RATE_LIMIT_WINDOW_MS` desse arquivo, com
padrões `100` e `900000`; as demais variáveis do exemplo servem ao desenvolvimento
sem Docker. O arquivo `.env` local não é copiado para as imagens.

O Compose cria exatamente três serviços: PostgreSQL, backend com Auth Emulator e
frontend Web exportado, servido por Nginx. O backend aguarda o healthcheck do banco,
inicia o emulador e executa migrations e seed antes de abrir a API. O frontend
aguarda o backend saudável e encaminha GraphQL e recuperação de senha para a API.

As imagens excluem arquivos `.env` e credenciais locais. Os valores sintéticos
estão no Compose e no Dockerfile frontend; `DATABASE_URL` e `DIRECT_URL` usam
`db:5432` e `sslmode=disable`. O banco não publica porta no host. O backend usa
`FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`; o navegador usa `http://localhost:9099`.
Sem emulador configurado, o cliente REST mantém os endpoints Firebase reais.

Volumes preservam PostgreSQL e a exportação do Auth Emulator no encerramento
normal. `docker compose down -v` apaga ambos. O seed usa IDs estáveis, datas
ancoradas na primeira criação e inserções que preservam registros existentes.
Para executá-lo novamente: `docker compose exec backend npm run db:seed:demo`.
O comando exige projeto demonstrativo e emulador local; não é um seed de produção.

O ambiente Docker destina-se à demonstração Web, sem hot reload ou build mobile.
A IA usa o provedor `mock` e os links de email ficam nos logs do backend.

## Preparação sem Docker

1. Execute npm ci na raiz.
2. Copie .env.example para .env e configure origem, Firebase e PostgreSQL locais.
3. Configure Firebase Admin por credencial local ou use Auth Emulator.
4. Disponibilize as URLs do banco ao Prisma CLI antes de comandos de migration.

~~~sh
npm run dev
~~~

O comando usa concurrently para iniciar backend e frontend.
Alternativas separadas: npm run dev:backend e npm run dev:frontend.
Backend escuta PORT ou 3000; Expo inicia Metro.

Para servir Web exportado e API na mesma origem local:

~~~sh
npm run build:web -w apps/frontend
npm run build -w apps/backend
npm run start -w apps/backend
~~~

O script start executa no workspace backend e procura ../frontend/dist.
O servidor só habilita arquivos estáticos quando encontra index.html.

## Carregamento e roteamento

- server.ts usa dotenv/config e loadRootEnvironment; o carregador da raiz aplica override.
- app.config.ts carrega o .env da raiz, exceto com EXPO_NO_DOTENV=1.
- prisma.config.ts usa dotenv/config no contexto do CLI; não usa o carregador da raiz.
- Para o CLI, DIRECT_URL prevalece sobre DATABASE_URL.
- Web de produção usa /graphql relativo; Web em desenvolvimento e nativo resolvem APP_URL.
- Recuperação usa a mesma estratégia para /auth/password-recovery.
- Na Vercel, APP_URL identifica o frontend; BACKEND_URL configura os rewrites Web.

## Backend e banco

| Variável | Uso |
| --- | --- |
| APP_URL | Origem pública do app; obrigatória no backend e no build Expo. |
| PORT | Porta do servidor local. |
| NODE_ENV | Em production, restringe a exceção CORS de loopback. |
| DATABASE_URL | Conexão PostgreSQL usada no runtime. |
| DIRECT_URL | Conexão preferencial do Prisma CLI. |
| FIREBASE_PROJECT_ID | Projeto Firebase backend. |
| FIREBASE_WEB_API_KEY | Chave para Auth REST; obrigatória na inicialização backend. |
| GOOGLE_APPLICATION_CREDENTIALS | Arquivo local de credencial Admin. |
| FIREBASE_SERVICE_ACCOUNT_JSON | Credencial Admin completa em segredo, usada na Vercel. |
| FIREBASE_AUTH_EMULATOR_HOST | Host:porta do emulador backend, sem http://. |
| VERCEL | Flag da plataforma; 1 exige a credencial JSON no caminho atual. |
| RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX | Configuram limite geral HTTP de GraphQL; veja [@limits](LIMITS.md). |

## Valores públicos do app

| Variável | Uso |
| --- | --- |
| EXPO_PUBLIC_FIREBASE_API_KEY | Firebase cliente. |
| EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN | Domínio Firebase cliente. |
| EXPO_PUBLIC_FIREBASE_PROJECT_ID | Projeto Firebase cliente. |
| EXPO_PUBLIC_FIREBASE_APP_ID | Aplicativo Firebase cliente. |
| EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET | Bucket, quando configurado. |
| EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | Identificador Firebase, quando configurado. |
| EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID | Analytics Web, quando habilitado. |
| EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL | URL do Auth Emulator acessível ao dispositivo. |
| EXPO_PUBLIC_APP_URL | Derivada de APP_URL por app.config.ts; não definir separadamente. |

APP_URL e EXPO_PUBLIC_* podem aparecer no bundle. Não coloque segredos nesses valores.

## Build, testes e IA

| Variável | Uso |
| --- | --- |
| BACKEND_URL | Origem API consumida por vercel.ts no build Web. |
| EXPO_NO_DOTENV | 1 evita carregamento dotenv do Expo no ambiente E2E. |
| E2E_NATIVE | 1 seleciona identificador com.moneyhub.e2e e configuração Android de teste. |
| FINANCIAL_GOALS_TEST_DATABASE_URL | Banco local descartável da integração real de metas. |
| LLM_PROVIDER, LLM_API_KEY, OPENAI_API_KEY | Seleção e credencial backend; regras em [@ai](AI.md). |
| LLM_MODEL, LLM_BASE_URL, LLM_TIMEOUT_MS | Modelo, endpoint e prazo por chamada em [@ai](AI.md). |

## Rede dos dispositivos

Android Emulator converte localhost/127.0.0.1 para 10.0.2.2 no resolvedor do app.
iOS Simulator usa loopback do host. Dispositivos físicos precisam do endereço
LAN ou público da máquina em APP_URL e na URL pública do emulador.
O dispositivo precisa alcançar backend, Auth Emulator e Metro.

Não versione .env ou credenciais Admin. Use somente recursos sintéticos nos
testes; a configuração E2E não descarta todo o ambiente herdado do host.

## Fontes

[Configuração runtime](../apps/backend/src/core/runtime-config/runtime-config.ts),
[Prisma CLI](../apps/backend/prisma.config.ts),
[Expo](../apps/frontend/app.config.ts),
[URL do app](../apps/frontend/src/services/runtimeUrl.ts),
[template mínimo](../.env.example).

Relacionados: [@tests](TESTING.md), [@deploy](DEPLOY.md), [@auth](AUTH.md).
