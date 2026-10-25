# Releases de produção

O workflow [Release](../.github/workflows/release.yml) publica uma versão quando
uma GitHub Release estável é publicada. A tag deve seguir `vMAJOR.MINOR.PATCH`,
por exemplo `v1.2.3`, e apontar para um commit que já pertence à `main`.

Commits e merges continuam executando o workflow Quality. Eles não publicam
produção pelo workflow Release. Criar uma tag sem publicar a Release, salvar
um rascunho ou marcar a Release como pré-release também não publica produção.
As configurações Vercel dos dois projetos desativam deploys automáticos por
Git em todas as branches, incluindo previews automáticos. Deploys pelo CLI
continuam disponíveis.

## Configuração inicial

Faça esta configuração antes de publicar a primeira Release. As alterações
nos arquivos precisam estar na `main` e no commit escolhido para a versão.

### GitHub

Em **Settings > Environments**, crie o environment `production` e cadastre
os seguintes environment secrets:

| Secret | Valor |
| --- | --- |
| `VERCEL_TOKEN` | Token Vercel com acesso aos dois projetos. |
| `VERCEL_ORG_ID` | ID da conta ou equipe que contém os dois projetos. |
| `VERCEL_BACKEND_PROJECT_ID` | ID do projeto `money-hub-backend`. |
| `VERCEL_FRONTEND_PROJECT_ID` | ID do projeto `money-hub-frontend`, diferente do backend. |
| `PRODUCTION_DATABASE_URL` | Conexão PostgreSQL de produção do Supabase para migrations Prisma, com senha e SSL conforme o provedor. |

Os IDs Vercel estão nos painéis dos projetos/equipe ou no arquivo local
`.vercel/project.json` gerado por `vercel link`. Não versione esse arquivo.
Use conexão direta do Supabase ou pooler em modo de sessão compatível com
Prisma Migrate; não use o pooler em modo de transação para migrations.

Se limitar as referências autorizadas no environment, permita **tags `v*`**.
Uma regra que permite somente a branch `main` bloqueia jobs disparados por tag.
Opcionalmente configure required reviewers para exigir aprovação antes do
job de produção, quando o plano do GitHub oferecer essa opção.

Proteja `main` com os checks Quality e proteja tags de release contra alterações
ou exclusões. Uma versão publicada deve continuar identificando o mesmo commit.

### Vercel

Mantenha os dois projetos conectados ao monorepo e configure:

| Configuração | Backend | Frontend |
| --- | --- | --- |
| Root Directory | `apps/backend` | `apps/frontend` |
| Node | `22.x` | `22.x` |
| Framework | Express | Other |
| Build | Padrão Express | `npm run build:web` |
| Output Directory | Não definir | `dist` |

Permita os arquivos necessários fora do Root Directory para os workspaces.
O workflow executa o CLI na raiz de cada cópia do monorepo; o Root Directory
salvo no projeto seleciona a aplicação correta.

Configure as variáveis **Production** descritas em [Deploy](DEPLOY.md).
`APP_URL` do backend deve apontar para o domínio estável do frontend.
`BACKEND_URL` do frontend deve apontar para o domínio estável do backend,
e não para uma URL temporária de outro build. O `DATABASE_URL` do backend
e o secret `PRODUCTION_DATABASE_URL` devem identificar o mesmo banco.

O CLI baixa a configuração de produção com `vercel pull`, cria o build com
`vercel build --prod` e envia o resultado com `--prebuilt --prod --skip-domain`.
Esse envio prepara o deployment sem promover os domínios de produção.
Após migrations, `vercel promote` publica primeiro o backend e depois o frontend.

O bloqueio de Git está em [backend/vercel.json](../apps/backend/vercel.json)
e [frontend/vercel.ts](../apps/frontend/vercel.ts). Não é necessário desconectar
o repositório da Vercel. Revise outros deploy hooks ou automações externas que
possam publicar independentemente desse workflow.

### Supabase

Em **Project Settings > Integrations > GitHub Integration**, desative
**Deploy to production**. Para manter somente o fluxo por Release descrito
aqui, desative também **Automatic branching**. Se essa integração não tiver
outra função, também é possível desconectar apenas a integração do projeto
com o repositório. Isso não exige remover o banco ou o projeto Supabase.

MoneyHub mantém o histórico em `apps/backend/prisma/migrations`. A integração
nativa do Supabase procura `supabase/migrations`; ela não substitui Prisma
Migrate. Não copie migrations para manter dois históricos concorrentes.
O banco continua hospedado no Supabase e o job Release aplica as migrations
Prisma usando a conexão de produção cadastrada no GitHub.

As opções dos painéis e os secrets são configurações externas. Alterar estes
arquivos não modifica essas opções nem cadastra credenciais automaticamente.

## Publicar pelo terminal

A automação local usa `release-it` e `@release-it/conventional-changelog`,
instalados nas devDependencies da raiz. Use Node.js `22.x`, a partir de
`22.13.0`, e execute os comandos na raiz do monorepo.

### Preparar autenticação

Instale as dependências com `npm ci`. Para autenticar a publicação da GitHub
Release, use o GitHub CLI:

```sh
gh auth login --hostname github.com
```

O launcher reutiliza essa autenticação em memória. Se `GITHUB_TOKEN` ou
`GH_TOKEN` já estiver definido no terminal, esse token tem preferência; ele
precisa permitir criar Releases no repositório. Para um fine-grained personal
access token, selecione o repositório e a permissão **Contents: Read and write**.
Não coloque tokens no código, no `.release-it.json` ou no changelog.

Os comandos Git usam as credenciais já usadas para `git push`. Se precisar
configurar Git HTTPS para usar a autenticação do GitHub CLI, execute
`gh auth setup-git`. Os cinco secrets do environment `production` continuam
no GitHub; não é necessário copiá-los para a máquina local.

### Simular e publicar

Primeiro integre esta configuração na `main`, confirme os checks Quality e
deixe o diretório de trabalho sem alterações pendentes. Atualize a branch:

```sh
git switch main
git pull --ff-only
```

Simule uma correção de versão antes de publicar:

```sh
npm run release:dry-run -- patch
```

A simulação não lê a autenticação do `gh`, não cria commits ou tags, não altera
os manifests/changelog e não publica a GitHub Release. Ela mostra as ações
locais planejadas; não valida permissões da API GitHub nem os secrets de deploy.

Para publicar, escolha uma das opções:

| Comando | Resultado |
| --- | --- |
| `npm run release` | Recomenda a próxima versão pelos Conventional Commits e pede confirmação das etapas. |
| `npm run release -- patch` | Incrementa correção, por exemplo `0.1.0` para `0.1.1`. |
| `npm run release -- minor` | Incrementa funcionalidade, por exemplo `0.1.0` para `0.2.0`. |
| `npm run release -- major` | Incrementa versão principal, por exemplo `0.1.0` para `1.0.0`. |
| `npm run release -- 1.2.3` | Usa explicitamente a versão estável `1.2.3`. |

Ao confirmar, a automação sincroniza os `package.json` da raiz, backend e
frontend, atualiza todas as versões correspondentes no `package-lock.json`,
gera `CHANGELOG.md`, cria o commit `chore(release): vX.Y.Z` e uma tag anotada
`vX.Y.Z`. O push de commit e tag usa `--atomic`. Depois, publica a GitHub
Release estável com as notas do changelog, disparando o workflow de produção.
Não publica pacotes no registro npm e não adiciona comentários em issues/PRs.

Use mensagens como `fix: corrigir filtro` e `feat: adicionar relatório` para
alimentar as notas e a recomendação de versão. Commits fora do padrão podem
não aparecer no changelog. Uma versão explícita permite publicar quando o
histórico não tem Conventional Commits suficientes para recomendar um bump.

Para execução sem perguntas, acrescente `--ci`, por exemplo
`npm run release -- patch --ci`. Esse comando confirma automaticamente a
criação do commit, tag, push e publicação da Release; o workflow pode alterar
o banco e os deployments de produção.

O comando exige `main`, upstream configurado, diretório limpo e commits novos
desde a tag anterior. Ele não contorna proteções do GitHub: se `main` exigir
PR, o push direto do commit de versão será recusado. Nesse caso, prepare as
alterações de versão/changelog em um PR conforme a política do repositório e
publique pela interface após o merge. Não use push forçado para publicar.

Se o push funcionar, mas a publicação da GitHub Release falhar, não incremente
a versão novamente. Confira commit/tag no GitHub e publique a Release para a
tag já enviada pela interface abaixo. A publicação dessa Release dispara o deploy.

## Publicar pela interface do GitHub

1. Integre as alterações na `main` e confirme os checks Quality.
2. No GitHub, abra **Releases > Draft a new release**.
3. Escolha uma tag nova, como `v1.2.3`, apontando para o commit desejado da
   `main`. Registre as mudanças nas notas da versão.
4. Deixe a opção de pré-release desmarcada e clique em **Publish release**.
5. Acompanhe **Actions > Release**. Se houver required reviewers no environment
   `production`, aprove o job após revisar a versão e o commit.
6. Confira o resumo do job e execute as verificações pós-publicação de
   [Deploy](DEPLOY.md#verificações-após-publicar).

Publicar uma Release autoriza esse workflow a aplicar as migrations pendentes
e promover os deployments de produção daquela versão.

## Validações e rastreabilidade

O workflow rejeita tags fora do formato estável, commits que não pertencem à
`main` e tags que mudaram após o disparo. O Quality é reutilizado para executar
lint, TypeScript, builds, cobertura backend/frontend e E2E Web sobre o commit
da Release. Uma falha impede o job de produção.

As duas aplicações usam o mesmo SHA, com cópias separadas do monorepo para
não misturar as configurações Vercel. Ambos os builds e deployments preparados
precisam concluir antes das migrations. Se as migrations falharem, nenhum dos
dois deployments será promovido por esse workflow.

O resumo do job registra tag, SHA, resultado das migrations, URLs e resultados
das promoções. Cada deployment recebe `releaseVersion` e `releaseCommit` como
metadata na Vercel. A versão da entrega é a tag. O comando local `npm run release`
sincroniza as versões dos pacotes; publicar somente pela interface do GitHub
não altera os `package.json` automaticamente.

O grupo de concurrency impede duas execuções ativas de Release ao mesmo tempo
e não cancela uma execução já em andamento. O GitHub mantém no máximo uma
execução pendente por grupo e pode substituir a pendente por outra mais nova;
publique uma versão por vez e confira o resultado antes de publicar a próxima.

## Falhas e rollback

Migrations e promoções dos dois projetos são operações separadas. As migrations
devem manter compatibilidade com a aplicação anterior, que ainda atende usuários
durante a atualização. Se a promoção do frontend falhar após a do backend,
produção ficará temporariamente com versões diferentes. Consulte o resumo
antes de decidir entre repetir a execução e restaurar o deployment anterior.

Uma execução pode ser repetida em **Actions > Release > Re-run jobs** mantendo
a tag e o commit originais. Migrations já aplicadas não são reaplicadas pelo
`prisma migrate deploy`. Reexecutar também pode substituir uma versão mais nova
que já esteja em produção; confira a versão atual antes dessa ação.

Para rollback da aplicação, use os deployments anteriores na Vercel e mantenha
backend/frontend compatíveis. Rollback da aplicação não desfaz migrations nem
restaura dados. Mudanças no banco exigem uma correção revisada e uma nova versão.

## Referências

- [GitHub: gatilhos de Release](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#release).
- [Vercel: desativar deploys Git](https://vercel.com/docs/project-configuration/git-configuration).
- [Vercel: deploy pelo CLI](https://vercel.com/docs/cli/deploy).
- [Vercel: promoção de deployments](https://vercel.com/docs/cli/promote).
- [Supabase: integração GitHub](https://supabase.com/docs/guides/deployment/branching/github-integration).
