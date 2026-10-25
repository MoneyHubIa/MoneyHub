# Identidade e autorização

Palavras-chave: @auth | autenticacao | login | firebase | sessao | senha | autorizacao

Firebase Auth gerencia cadastro, login, credenciais e renovação de sessão.
O backend verifica ID tokens e mantém projeção local de identidade.

## Cliente e contexto backend

- O SDK firebase/auth é usado em Web e nativo; no nativo persiste com AsyncStorage.
- Cada requisição Apollo obtém token do SDK; um token válido pode vir do cache.
- Sem Authorization, o contexto é anônimo; Bearer inválido produz UNAUTHENTICATED.
- AuthProvider valida me no backend ao aceitar a sessão; falha encerra sessão local.
- uid é Firebase UID; userId é users.id UUID; profileId é profiles.id.
- O contexto retornado pelo verificador é congelado por solicitação.
- Proprietário financeiro vem de userId do contexto, nunca de argumento do cliente.

## Firebase Admin

A seleção de credencial prioriza FIREBASE_SERVICE_ACCOUNT_JSON, depois exige
essa configuração na Vercel; fora dela, considera arquivo existente,
emulador e credencial padrão.

checkRevoked é true nos caminhos JSON/arquivo e false em emulator/default.
Depois da verificação do token, o backend consulta getUser. Se a consulta
falhar, usa email e email_verified das claims verificadas.

Email é obrigatório, normalizado com trim/lowercase. Ausência provoca
AUTH_EMAIL_REQUIRED internamente, convertida em UNAUTHENTICATED pela fronteira HTTP.

## Sincronização e bootstrap

A sincronização busca users por firebaseUid e depois por email, atualizando
firebaseUid, email e email_verified_at da linha encontrada.
Sem users, userId e profileId ficam null. Com users sem perfil, só profileId é null.

bootstrapProfile exige autenticação e nome não vazio após trim, sem exigir
email verificado. Dentro de transação, atualiza/cria users e cria profiles
se ausente; retorna created indicando criação de perfil.
Repetição com perfil existente não sobrescreve suas preferências.

A busca por email pode reassociar firebaseUid. Não há rejeição implementada
IDENTITY_EMAIL_CONFLICT nem retry específico para concorrência de bootstrap.

No bootstrap, o resolver não aplica os mesmos limites de nome/moeda da edição;
restrições do banco podem rejeitar valores. Na edição, nome aceita 1–120
caracteres, moeda BRL/USD/EUR e tema SYSTEM/LIGHT/DARK.

email_verified_at registra observação do email atual verificado: preserva
valor existente, preenche quando necessário e limpa ao observar não verificado.
Não é autoridade independente para permitir operações.

## Verificação de email e acesso

O SDK envia/reenvia verificação de email; não há endpoint MoneyHub de envio.
Após concluir o link, o cliente executa reload e getIdToken(true).

requireVerifiedUserId exige auth, emailVerified e userId. Falhas produzem,
respectivamente, UNAUTHENTICATED, EMAIL_NOT_VERIFIED e PROFILE_NOT_FOUND.
Esse helper não exige profileId universalmente; metas e edição de perfil
possuem verificação adicional. Leitura do perfil exige profileId, sem exigir
email verificado. me e bootstrapProfile aceitam email ainda não verificado.

Logout executa signOut local. Não há endpoint de revogação individual remota
nem armazenamento de refresh tokens pelo MoneyHub.

## Recuperação de senha

O cliente chama exclusivamente o backend para solicitar, verificar código
e confirmar nova senha. Firebase Auth REST gera a ação e altera a credencial;
Firebase entrega o email. Rotas e respostas precisas estão em [@api](API.md).

No Firebase Console, configure domínio autorizado, proteção contra enumeração
e template com action URL APP_URL/reset-password.
A solicitação backend envia continueUrl APP_URL/login e handleCodeInApp false;
esse fluxo não implementa deep link nativo de recuperação.

Falhas temporárias permitem retry; código inválido/expirado exige novo link.
Após confirmar, o app encerra a sessão local antes de oferecer login.
A recuperação não cria users/profiles.

Nunca registre senha, oobCode, token, email bruto ou link completo de recuperação.
A auditoria registra requestId, status, hash SHA-256 do email na solicitação
e código de provedor permitido. O corpo da requisição não deve ser logado.

## Fontes

[Verificador](../apps/backend/src/modules/auth/authentication/auth.ts),
[projeção de identidade](../apps/backend/src/core/database/database.ts),
[bootstrap/schema](../apps/backend/src/core/graphql/graphql.ts),
[perfil](../apps/backend/src/modules/profile/profile-management/profile-management.ts),
[Auth cliente](../apps/frontend/src/services/authService.ts),
[recuperação](../apps/backend/src/modules/auth/password-recovery/password-recovery.ts).

Relacionados: [@api](API.md), [@setup](SETUP.md), [@limits](LIMITS.md).
