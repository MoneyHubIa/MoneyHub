# Limitações e segurança

Palavras-chave: @limits | limites | seguranca | riscos | evidencias | pendencias

Este arquivo registra limites do código atual. Não é histórico de auditoria
nem lista de tarefas concluídas. Configurações externas exigem evidência própria.

## HTTP, rate limit e proxies

GraphQL usa limite geral por IP/processo: RATE_LIMIT_MAX padrão 100 e
RATE_LIMIT_WINDOW_MS padrão 900000. Não há cota separada por usuário/operação IA.

Recuperação usa três stores locais independentes, em janela deslizante de
15 minutos: 5 solicitações, 10 verificações e 10 confirmações por IP.
Não há store distribuído nem configuração trust proxy explícita.
Múltiplas instâncias e cadeias X-Forwarded-For precisam de projeto/validação
antes de depender desses limites para proteção consistente.

E2E aumenta o limite geral local para 10000 por 900000 ms por compartilhar IP;
não testa o limite global padrão nesse fluxo. Verificações em [@tests](TESTING.md).

Helmet e CORS são aplicados. CORS permite APP_URL, requisições sem Origin e
loopback adicional fora de production. Envio de verificação pelo SDK cliente
não possui rate limiter MoneyHub próprio; console Firebase é configuração externa.

## Identidade e banco

A sincronização por email pode atualizar Firebase UID de uma linha existente.
Não há garantia de rejeição de vínculo conflitante. Logout é local e a checagem
de revogação varia por credencial; condições exatas em [@auth](AUTH.md).

O helper comum não exige profileId em todos os módulos; metas/perfil possuem
verificações específicas. O bootstrap tem validação diferente da edição de perfil.
Não generalize proteções de um domínio para outro.

A conexão pg desativa TLS com sslmode=disable; nos demais casos configura
rejectUnauthorized: false. Portanto, não garante validação do certificado.
Isolamento descrito pela aplicação não comprova política RLS no banco.

As garantias transacionais/idempotentes de metas não se estendem automaticamente
a baixas de contas ou processamento de recorrências; veja [@finance](FINANCE.md).
movements(after: "") interpreta cursor vazio como primeira página, em vez de
BAD_USER_INPUT. Cursor de outra meta continua rejeitado.

## IA, logs e frontend

Hash IA não cobre todo o conteúdo enviado ao provedor; conversas não são
persistidas. Redação de API key não é sanitização universal de erros.
Existem console.error de IA/autenticação e não há auditoria dedicada de
todas as mutações financeiras. Contrato preciso em [@ai](AI.md).

Defesas de prompt não garantem imunidade a injeção nem correção da resposta.
O nome fixo de modelo na UI não comprova provedor/modelo ativo.

Tema não sincroniza universalmente com perfil/sistema e Analytics best-effort
pode não coletar eventos; comportamento atual em [@frontend](FRONTEND.md).

## Evidências e operação

Não há evidência iOS/VoiceOver registrada no material analisado.
CI executa Web, não validação nativa; exportar bundle não demonstra execução
em dispositivo. Veja requisitos e comandos em [@tests](TESTING.md).

O repositório não comprova deploy ativo, migrations atuais, recebimento de emails,
modelo real, alertas ou backups. Não há procedimento dedicado de restauração
testada, resposta a incidentes ou política operacional de retenção/exclusão
de dados pessoais consolidado no código/documentação atual.

A autorização administrativa de entrega não remove esses limites.
Siga [@deploy](DEPLOY.md) para verificações operacionais e registre evidência real.

## Fontes

[HTTP e limites](../apps/backend/src/core/app/app.ts),
[janelas de recuperação](../apps/backend/src/core/rate-limit/sliding-window-rate-limit.ts),
[identidade](../apps/backend/src/modules/auth/authentication/auth.ts),
[banco](../apps/backend/src/core/database/database.ts),
[hash IA](../apps/backend/src/modules/ai/conversation-logging/ai-conversation-logging.ts),
[tema](../apps/frontend/src/theme/ThemeContext.tsx),
[CI](../.github/workflows/quality.yml).

Relacionados: [@auth](AUTH.md), [@ai](AI.md), [@tests](TESTING.md), [@deploy](DEPLOY.md).
