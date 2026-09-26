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
- `TASK-019` esta concluida. A recuperacao usa backend Firebase Auth REST,
  retry no app para falhas temporarias, enforcement local por janela deslizante,
  auditoria segura e sanitizacao de `x-request-id` antes de logs ou eventos.
- `EPIC-02` esta concluido.
- `EPIC-01` esta concluido.
- `EPIC-07` esta concluido. `TASK-015`, `TASK-034`, `TASK-035`, `TASK-036`,
  `TASK-040`, `TASK-041` e `TASK-042` estao concluidas. O Android passou nos
  tres fluxos Maestro e na inspecao manual com TalkBack em 2026-09-24. Em
  2026-09-26, o usuario aceitou encerrar o epic sem execucao iOS/VoiceOver;
  essa cobertura permanece sem evidencia.
- Producao Firebase, Supabase PostgreSQL, GCP, deploy, proxy confiavel no Cloud Run e
  rate limit compartilhado continuam fora do escopo da fundacao; `EPIC-08`
  ainda cobre store compartilhado e revisao do comportamento
  `trust proxy`/`X-Forwarded-For` antes de qualquer deploy Cloud Run com varias
  instancias.

## Evidencias Disponiveis

| Area | Evidencia |
| --- | --- |
| Backend | 262 testes; cobertura global >=80%; lint, typecheck e build passam |
| App | 253 testes; cobertura global >=80%; lint, typecheck e export Expo passam |
| E2E Web | 13 testes passam no Chromium com PostgreSQL, Firebase Auth Emulator, backend, acessibilidade, autenticacao, financas e mock AI |
| E2E Android | 3/3 fluxos Maestro passam no `emulator-5554`; login e criacao de transacao passam na inspecao manual com TalkBack |
| Bundles | Expo export passa para Web, iOS e Android |
| Firebase Auth | Auth Emulator valida registro, login, ID token e restauracao da sessao |
| PostgreSQL | schema de identidade baselined; `prisma migrate status` reporta banco atualizado |

## Evidencias de Smoke Confirmadas

- Entrega real do e-mail e conteudo final enviado pelo Firebase.
- `Action URL` do MoneyHub apontando para `${APP_URL}/reset-password`.
- Troca efetiva de senha na conta real e nao reutilizacao do action code.
- Falha do login com a senha antiga e sucesso com a senha nova.
- Paridade de resposta para endereco de e-mail desconhecido.

## Execucao Imediata

| Ordem | Task | Acao | Condicao de conclusao |
| --- | --- | --- | --- |
| 1 | `TASK-012` | Planejar documentacao operacional de GCP e Firebase | Escopo, dependencias, responsabilidades e criterios de aceite documentados para EPIC-08 |

`TASK-012` e `TASK-043` podem avancar em paralelo por serem documentais e nao
alterarem o gate de fundacao.

## Dependencias Liberadas

| Task | Estado da dependencia |
| --- | --- |
| `TASK-018` | Liberada por `TASK-009`; definir escopo de logout antes de iniciar |
| `TASK-035`, `TASK-041`, `TASK-042` | Concluidas; cobertura Expo, adapters e smoke Web foram verificados |
| `TASK-034`, `TASK-040` | Concluidas; cobertura GraphQL e contexto Firebase Admin foram verificados |
| `TASK-037` | Builds locais existem; ainda depende das decisoes de producao |

## Tasks Ainda Bloqueadas

| Tasks | Bloqueio |
| --- | --- |
| `TASK-014`, `TASK-045` a `TASK-047` | Identidade persistida e fundacao de agenda |
| `TASK-016`, `TASK-038`, `TASK-039` | Decisoes e documentacao de infraestrutura de producao, store compartilhado e revisao de `trust proxy`/`X-Forwarded-For` para Cloud Run |

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
