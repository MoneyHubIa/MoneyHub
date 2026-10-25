# Projeto e arquitetura

Palavras-chave: @project | arquitetura | stack | estrutura | convencoes

MoneyHub é uma aplicação de gestão financeira pessoal e de pequenos negócios,
com cliente universal para Web, Android e iOS. A configuração de uma plataforma
não comprova publicação em loja ou validação do seu comportamento.

## Componentes

| Área | Tecnologias e responsabilidade |
| --- | --- |
| Backend | TypeScript 5.9, Node 22, Express 4, Apollo Server 5 e GraphQL; regras e acesso aos dados. |
| App | TypeScript 6, Expo SDK 57, Expo Router, React 19, React Native 0.86 e React Native Web. |
| Persistência | Prisma 7, adapter-pg e pg; PostgreSQL, com destino documentado Supabase. |
| Identidade | Firebase JS SDK no cliente; Firebase Admin no backend. |
| UI e estado | StyleSheet, tokens próprios, Lucide, SVG, hooks, React Context e Apollo Client 4. |
| Analytics | Firebase Analytics Web e React Native Firebase Analytics/App no nativo. |
| IA | Adapters mock e HTTP compatível com Chat Completions; ferramentas backend de leitura. |
| Hospedagem | Entrada Express e SPA Web configuradas em projetos Vercel separados. |

Versões exatas e faixas ficam nos manifests e no package-lock.json.
O monorepo usa npm workspaces e ESM; scripts auxiliares também usam JavaScript.

## Organização

- apps/backend/src/core: aplicação HTTP, GraphQL, banco, configuração, logging e limites.
- apps/backend/src/modules: auth, profile, finance, agenda e ai.
- apps/frontend/app: rotas Expo Router.
- apps/frontend/src: componentes, services, providers, theme e navegação.
- e2e: runner Web com serviços locais; .maestro: fluxos nativos.

O fluxo comum backend é resolver, serviço, repositório e Prisma.
Vários serviços e repositórios compartilham módulo; bootstrapProfile ainda
valida e persiste diretamente no resolver. Não existe separação uniforme
em controllers ou repositórios independentes para todas as operações.

O app autenticado compõe funcionalidades principalmente por DashboardShell.
Dados remotos ficam no Apollo InMemoryCache; estado local usa hooks e Context.

## Convenções de manutenção

- TypeScript da aplicação usa strict, noUncheckedIndexedAccess e exactOptionalPropertyTypes.
- Prefira regras de domínio em serviços e consultas encapsuladas quando possível.
- Identidade financeira vem do contexto backend; consulte [@auth](AUTH.md).
- Erros GraphQL usam extensions.code; REST possui envelope próprio em [@api](API.md).
- Use tokens e componentes React Native reutilizáveis em [@frontend](FRONTEND.md).
- Não persista segredos; documente mudanças de contratos no assunto responsável.
- Defina escopo e critérios verificáveis antes de novas funcionalidades.
- Execute verificações proporcionais à mudança e registre resultados reais.
- Mantenha esta documentação sem índices de tarefas, retrospectivas ou cópias do código.

## Fontes

[Raiz](../package.json), [backend](../apps/backend/package.json),
[frontend](../apps/frontend/package.json),
[entrada local](../apps/backend/src/server.ts),
[entrada Vercel](../apps/backend/app.ts),
[layout do app](../apps/frontend/app/_layout.tsx).

Relacionados: [@setup](SETUP.md), [@data](DATA.md), [@limits](LIMITS.md).
