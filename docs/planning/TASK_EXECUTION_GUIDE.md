# Guia de Execucao das Proximas Tasks

## Objetivo

Este guia registra o estado executavel do backlog e as dependencias liberadas
depois da conclusao do `EPIC-01`.

## Estado Atual

- `TASK-048` esta concluida. O backend TypeScript, GraphQL, Firebase Admin e
  Prisma foram verificados; a schema de identidade existente foi comparada com
  a migration inicial e baselined no PostgreSQL descartavel.
- `TASK-049` esta concluida. O app Expo Router exporta Web, iOS e Android e
  possui Apollo Client e adapters de Analytics Web/nativo.
- `TASK-009` esta concluida. Registro, login, sessao e ID token foram validados
  no Firebase Auth Emulator.
- `TASK-020` esta concluida. O perfil autenticado pode consultar e alterar nome,
  moeda preferida e tema pela tela Ajustes e pelo contrato GraphQL.
- `TASK-019` esta implementada e coberta por testes automatizados. O fechamento
  depende apenas do smoke real com entrega Firebase, URL MoneyHub e troca de
  senha verificadas.
- `EPIC-01` esta concluido.
- Producao Firebase, Cloud SQL, GCP, deploy, proxy confiavel no Cloud Run e
  rate limit compartilhado continuam fora do escopo da fundacao.

## Evidencias Disponiveis

| Area | Evidencia |
| --- | --- |
| Backend | 62 testes, lint, typecheck e build passam |
| App | 96 testes, lint, typecheck e export Expo passam |
| Monorepo | 158 testes automatizados passam |
| Bundles | Expo export passa para Web, iOS e Android |
| Firebase Auth | Auth Emulator valida registro, login, ID token e restauracao da sessao |
| PostgreSQL | schema de identidade baselined; `prisma migrate status` reporta banco atualizado |

## Execucao Imediata

| Ordem | Task | Acao | Condicao de conclusao |
| --- | --- | --- | --- |
| 1 | `TASK-019` | Executar smoke real da recuperacao implementada | Entrega Firebase, URL MoneyHub, troca de senha e nao enumeracao comprovadas |
| 2 | `TASK-021` | Implementar categorias financeiras | Contrato, migration, resolvers, interface e testes concluidos |
| 3 | `TASK-014` | Implementar fundacao de agenda | Contrato, persistence, interface e testes concluidos |

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

O ultimo comando foi validado contra o PostgreSQL descartavel que contem o
schema de identidade baselined. Nenhum status deve ser promovido para Done
apenas com `prisma validate`.

## Regra de Inicio

Antes de mover uma task para `In Progress`, confirme:

1. Todas as dependencias listadas neste guia estao concluidas.
2. A task possui objetivo, escopo, fora de escopo e criterios de aceite claros.
3. Os testes necessarios foram definidos antes da implementacao.
4. Nenhuma decisao contradiz a arquitetura ou as especificacoes aprovadas.
5. A task pode ser concluida sem assumir infraestrutura ainda inexistente.
