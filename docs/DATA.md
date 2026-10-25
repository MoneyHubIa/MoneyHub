# Dados e persistência

Palavras-chave: @data | dados | postgres | prisma | schema | migrations

O schema Prisma e as migrations são a fonte dos campos, tipos e constraints.
A aplicação usa PostgreSQL por PrismaPg e pg.Pool; Supabase é o destino
documentado de hospedagem, sem SDK Supabase Auth/JS no app.

## Identidade e relações

users.id é UUID interno. users.firebase_uid é a identidade Firebase externa.
Propriedade financeira normalmente usa user_id referenciando users.id;
movimentos de metas herdam propriedade por goal_id.
profiles.user_id é único: um perfil por usuário.
firebase_uid e email são únicos em users; comportamento de vínculo em [@auth](AUTH.md).

## Grupos persistidos

| Tabelas | Responsabilidade e relações |
| --- | --- |
| users, profiles | Projeção da identidade e preferências de nome, moeda e tema. |
| financial_categories, cost_centers | Classificação e agrupamento; categorias aceitam INCOME/EXPENSE/BOTH. |
| incomes, expenses | Lançamentos realizados; categoria obrigatória e centro de custo opcional. |
| accounts_payable, accounts_receivable | Compromissos com vencimento, estado e lembrete; paid_at e received_at, respectivamente. |
| recurring_transactions | Regra, período, categoria e centro opcional para gerar contas. |
| financial_goals | Alvo, saldo e datas da meta; estado calculado, sem coluna status. |
| financial_goal_movements | Histórico de aporte/retirada e operation_id, ligado à meta. |
| calendar_events | Eventos próprios e regras de recorrência. |
| notifications | Ocorrência, origem, lembrete e leitura de notificação in-app. |

Não existem tabelas audit_logs, ai_conversations, ai_messages ou
ai_context_snapshots. Auditoria IA usa logs, conforme [@ai](AI.md).

## Tipos e histórico

- IDs usam UUID; valores monetários são Decimal, serializados como strings na API.
- Lançamentos, contas e recorrências usam Decimal(12,2).
- Alvos, saldos e movimentos de metas usam Decimal(14,2).
- Datas de metas/movimentos e agenda/notificações usam DATE.
- occurred_at, due_date e período das recorrências financeiras usam TIMESTAMPTZ(3).
- created_at/updated_at normalmente usam TIMESTAMPTZ(3).
- Notificações e movimentos imutáveis possuem created_at, sem updated_at.
- Categorias, centros, lançamentos, contas e metas possuem deleted_at.
- Eventos e regras de recorrência não seguem universalmente essa exclusão lógica.

A interpretação de datas financeiras e as regras de saldo ficam em [@finance](FINANCE.md).

## Concorrência e índices relevantes

Metas usam bloqueio de linha, transação curta e histórico atômico, com
UNIQUE(goal_id, operation_id). Histórico usa índice (goal_id, created_at, id);
listagem de metas usa (user_id, deleted_at, deadline).
O serviço de metas usa centavos inteiros BigInt para alteração de saldo.

Notificações têm chave única (user_id, source, source_id, occurrence_date).
Não generalize essas garantias de idempotência para todos os outros domínios.

## Cliente e migrations

O cliente Prisma é gerado em apps/backend/src/generated/prisma.
O runtime reutiliza cliente/pool configurado por DATABASE_URL.
Prisma CLI usa DIRECT_URL antes de DATABASE_URL; carregamento em [@setup](SETUP.md).

Use migrations versionadas e prisma migrate deploy no processo de publicação;
nunca aplique schema na inicialização da função. A migration de metas é
20261004000000_financial_goals e é aditiva.

## Fontes

[Schema](../apps/backend/prisma/schema.prisma),
[migrations](../apps/backend/prisma/migrations),
[cliente/pool](../apps/backend/src/core/database/database.ts),
[configuração CLI](../apps/backend/prisma.config.ts),
[repositório de metas](../apps/backend/src/modules/finance/financial-goals/financial-goals-repository.ts).

Relacionados: [@finance](FINANCE.md), [@deploy](DEPLOY.md), [@limits](LIMITS.md).
