# Guia de Execucao das Proximas Tasks

## Objetivo

Este guia registra o estado executavel do backlog, as dependencias liberadas e
o gate restante para concluir o `EPIC-01`.

## Estado Atual

- `TASK-048` esta em andamento. O backend TypeScript, GraphQL, Firebase Admin e
  Prisma esta implementado e verificado; falta aplicar a migration inicial em
  um PostgreSQL externo descartavel.
- `TASK-049` esta concluida. O app Expo Router exporta Web, iOS e Android e
  possui Apollo Client e adapters de Analytics Web/nativo.
- `TASK-009` esta concluida. Registro, login, sessao e ID token foram validados
  no Firebase Auth Emulator.
- `EPIC-01` permanece em andamento somente pelo aceite externo da migration da
  `TASK-048`.
- Producao Firebase, Cloud SQL, GCP, Resend e deploy continuam fora do escopo da
  fundacao.

## Evidencias Disponiveis

| Area | Evidencia |
| --- | --- |
| Backend | testes, lint, typecheck, build, `prisma validate` e `prisma generate` passam |
| App | 22 testes, lint, typecheck e Expo Doctor 20/20 passam |
| Bundles | Expo export passa para Web, iOS e Android |
| Firebase Auth | Auth Emulator valida registro, login, ID token e restauracao da sessao |
| PostgreSQL | schema e migration existem; aplicacao aguarda `DATABASE_URL` descartavel |

## Execucao Imediata

| Ordem | Task | Acao | Condicao de conclusao |
| --- | --- | --- | --- |
| 1 | `TASK-048` | Configurar PostgreSQL externo descartavel e aplicar a migration | `prisma migrate deploy` e verificacao do schema passam |
| 2 | `EPIC-01` | Revisar evidencias e encerrar o epic | `TASK-048`, `TASK-049` e `TASK-009` aceitas |
| 3 | `TASK-017` | Implementar bootstrap de usuario e perfil | Iniciar depois do aceite da migration |

`TASK-012` e `TASK-043` podem avancar em paralelo por serem documentais e nao
alterarem o gate de fundacao.

## Dependencias Liberadas

| Task | Estado da dependencia |
| --- | --- |
| `TASK-018` | Liberada por `TASK-009`; definir escopo de logout antes de iniciar |
| `TASK-035`, `TASK-041`, `TASK-042` | Fundacao Expo e adapters existem; podem ser planejadas/executadas |
| `TASK-034`, `TASK-040` | Fundacao GraphQL e contexto Firebase Admin existem; podem avancar |
| `TASK-037` | Builds locais existem; ainda depende das decisoes de producao |

## Tasks Ainda Bloqueadas

| Tasks | Bloqueio |
| --- | --- |
| `TASK-017` | Aceite da migration PostgreSQL da `TASK-048` |
| `TASK-019` | `TASK-012` e `TASK-044` para entrega de links pelo Resend |
| `TASK-020` | `TASK-017` e modelo de perfil persistido |
| `TASK-021` a `TASK-033` | Bootstrap de identidade, autorizacao e modelos de dominio |
| `TASK-014`, `TASK-045` a `TASK-047` | Identidade persistida e fundacao de agenda |
| `TASK-016`, `TASK-038`, `TASK-039` | Decisoes e documentacao de infraestrutura de producao |

## Comandos de Aceite

```powershell
npm test
npm run lint
npm run typecheck
npm run build
npm run test:auth-emulator -w apps/frontend
npm exec -w apps/frontend expo-doctor
npm exec -w apps/backend prisma -- migrate deploy
```

O ultimo comando exige uma `DATABASE_URL` de PostgreSQL externa e descartavel.
Nenhum status deve ser promovido para Done apenas com `prisma validate`.

## Regra de Inicio

Antes de mover uma task para `In Progress`, confirme:

1. Todas as dependencias listadas neste guia estao concluidas.
2. A task possui objetivo, escopo, fora de escopo e criterios de aceite claros.
3. Os testes necessarios foram definidos antes da implementacao.
4. Nenhuma decisao contradiz a arquitetura ou as especificacoes aprovadas.
5. A task pode ser concluida sem assumir infraestrutura ainda inexistente.
