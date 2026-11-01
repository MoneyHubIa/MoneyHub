# Publicação e operação

Palavras-chave: @deploy | vercel | publicar | producao | operacao | rollback

A configuração usa projetos Vercel separados para backend Express e frontend
Expo Web. PostgreSQL tem Supabase como destino documentado; configuração no
repositório não comprova estado atual dos provedores.

Produção é publicada pelo workflow [Release](../.github/workflows/release.yml)
ao publicar uma GitHub Release estável com tag `vMAJOR.MINOR.PATCH`.
Deploys automáticos por push estão desativados nas configurações Vercel dos
dois projetos. Consulte [Releases](RELEASE.md) para configurar os painéis,
cadastrar os secrets e publicar uma versão.

## Projetos Vercel

| Configuração | Backend | Frontend |
| --- | --- | --- |
| Root Directory | apps/backend | apps/frontend |
| Framework | Express | Other |
| Node | 22.x | 22.x |
| Build | Padrão Express; validar compilação localmente | npm run build:web |
| Output Directory | Não definir | dist |
| Entrada | app.ts, API sem bundle Web | vercel.ts, SPA exportada |

Importe o repositório completo para reconhecimento dos workspaces.
O postinstall backend gera Prisma; não execute migrations no startup da função.

## Configuração por projeto

- Backend: APP_URL aponta para frontend; configure DATABASE_URL,
  FIREBASE_PROJECT_ID, FIREBASE_WEB_API_KEY e FIREBASE_SERVICE_ACCOUNT_JSON.
- Frontend: configure APP_URL, BACKEND_URL e valores EXPO_PUBLIC_FIREBASE_*.
- Migrations: disponibilize DIRECT_URL ou DATABASE_URL ao processo controlado.
- IA: configure somente no backend; seleção e smoke em [@ai](AI.md).
- Credenciais de Admin devem ser segredos, nunca valores públicos do app.
- Mudanças de ambiente exigem nova publicação.

### Firebase público no build Vercel

No projeto frontend, cadastre `APP_URL` e as variáveis `EXPO_PUBLIC_FIREBASE_*`
de produção como **Config**, sem a opção **Secret** (antes chamada **Sensitive**).
Esses valores são públicos e ficam incorporados no JavaScript pelo Expo.
Use os valores do aplicativo Web em **Firebase Console > Project settings >
Your apps > SDK setup and configuration**, do mesmo projeto usado pelo backend:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`, quando configurado.
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, quando configurado.
- `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID`, quando configurado.

Não configure `EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` em produção.
Mantenha credenciais Admin, tokens e senhas do backend como segredos.

O workflow Release executa `vercel pull` e depois `vercel build --prod` no
runner. Valores Secret/Sensitive podem ser baixados como `[SENSITIVE]`;
o Expo incorpora esse texto no bundle, causando HTTP 400 no login, inclusive
`accounts:signInWithPassword?key=%5BSENSITIVE%5D`. O build rejeita esse placeholder
em `APP_URL` e nas variáveis Firebase, identificando somente o nome da variável.

Para corrigir um deployment existente:

1. Abra **Vercel > money-hub-frontend > Settings > Environment Variables**.
2. Reconfigure as variáveis públicas acima no ambiente **Production** como
   **Config**, preenchendo os valores reais do aplicativo Web Firebase.
3. Gere um novo build e publique pelo fluxo de [Release](RELEASE.md). Promover
   novamente o bundle antigo não atualiza os valores incorporados.
4. Recarregue o site e confirme que a chamada de login não contém `[SENSITIVE]`.
   Teste o login com uma conta de produção controlada.

Os nomes, exposição e carregamento das variáveis ficam em [@setup](SETUP.md).
Os rewrites encaminham /graphql e /auth/password-recovery, incluindo subrotas,
ao BACKEND_URL. O catch-all serve a SPA, inclusive /reset-password.
O frontend não encaminha /health: teste esse endpoint na origem backend.

## Ordem de publicação e migrations

1. Identifique revisão, ambiente de destino e banco; confirme backup e autorização
   operacional antes de alterar produção.
2. Instale dependências pelo lockfile e valide build/typecheck necessários.
3. Configure o ambiente do Prisma CLI para o banco pretendido.
4. Gere/valide cliente e consulte estado de migrations:

~~~sh
npm run db:generate -w apps/backend
npm run db:validate -w apps/backend
npm run db:status -w apps/backend
~~~

5. Aplique migrations pendentes no ambiente aprovado:

~~~sh
npm run db:migrate -w apps/backend
~~~

6. Publique backend após migrations e depois frontend compatível.
7. Gere novo build nativo se módulos/configuração nativos mudaram.
8. Registre identificadores das publicações e execute os smokes abaixo.

Para metas, confirme a migration aditiva 20261004000000_financial_goals
antes do backend que a utiliza. Não reaplique manualmente migrations concluídas.
Detalhes do schema e de conexão estão em [@data](DATA.md).

## Verificações após publicar

- GET /health na origem backend; depois GraphQL autenticado com acesso ao banco.
- Cadastro/login, bootstrap e acesso isolado usando conta controlada.
- Navegação direta da SPA e /reset-password pela origem frontend.
- Recuperação real: entrega/template, action URL, troca de senha, código sem
  reutilização, rejeição da senha antiga e login com nova senha.
- Metas: alvo 1000, aporte 250, 25% após reload; retirada 50, saldo 200 e 20%.
  Confirme histórico, resumo e ausência de alteração no fluxo de caixa.
- IA: confira endpoint/modelo configurado e resposta real, quando essa for a configuração.
- Logs de erros e requestId sem divulgar credenciais ou dados da recuperação.

No Firebase Console, confirme domínio autorizado, template e proteção de
enumeração conforme [@auth](AUTH.md).
/health sozinho não valida banco, Firebase ou funcionamento do produto.

## Rollback e evidência

Em rollback da aplicação, preserve tabelas aditivas e histórico de metas;
retorne ao build anterior compatível. Não apague dados para reverter uma entrega.

Logs, alertas, backups/restauração e proteção de branches dependem de
configuração externa. Registre data, revisão/build, ambiente e resultado de
cada verificação; não trate este procedimento como execução concluída.
Limites de escala e lacunas operacionais permanecem em [@limits](LIMITS.md).

## Fontes

[Entrada API](../apps/backend/app.ts),
[composição runtime](../apps/backend/src/core/app/runtime-app.ts),
[rewrites Web](../apps/frontend/vercel.ts),
[Prisma CLI](../apps/backend/prisma.config.ts),
[migration metas](../apps/backend/prisma/migrations/20261004000000_financial_goals).

Relacionados: [@setup](SETUP.md), [@tests](TESTING.md), [@limits](LIMITS.md).
