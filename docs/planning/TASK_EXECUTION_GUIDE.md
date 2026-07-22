# Guia de Execucao das Proximas Tasks

## Objetivo

Este guia define quais tasks pendentes devem ser executadas agora, quais podem
avancar em paralelo e quais devem permanecer bloqueadas. Ele nao cria tasks,
nao altera escopo e nao substitui os criterios de aceite de cada task.

## Estado Atual

- `TASK-001` ate `TASK-008`, `TASK-010` e `TASK-011` estao concluidas.
- `EPIC-01` permanece pendente porque GraphQL e Expo foram planejados, mas ainda
  nao foram implementados.
- Nenhuma task esta em andamento.
- `TASK-012` e `TASK-043` sao as proximas tasks existentes liberadas e podem
  avancar em paralelo.
- A ordem numerica nao deve ser usada isoladamente para decidir a execucao.

## Correcao Obrigatoria do Backlog

Antes de iniciar tasks de implementacao dependentes da fundacao alvo, devem ser
criadas no catalogo:

1. Uma task para implementar a fundacao Node.js, Express e Apollo Server
   GraphQL.
2. Uma task para implementar a fundacao React Native, Expo e Expo Router.

Essas tasks devem possuir objetivo, escopo, fora de escopo, dependencias,
criterios de aceite e estrategia de testes. Este guia nao atribui numeros a
elas. A numeracao deve ser definida quando o catalogo for atualizado.

As duas fundacoes podem ser planejadas em paralelo. A implementacao GraphQL
depende do plano da `TASK-006` e deve respeitar os contratos das `TASK-008` e
`TASK-010`. A implementacao Expo depende do plano da `TASK-007` e deve respeitar
os contratos das `TASK-008` e `TASK-011`.

## Proxima Onda

As proximas tasks existentes podem ser executadas simultaneamente:

| Task | Objetivo | Dependencias concluidas | Pode executar em paralelo |
| --- | --- | --- | --- |
| `TASK-012` | Planejar GCP, Cloud Run, Cloud SQL, Secret Manager e Resend | `TASK-006`, `TASK-007`, `TASK-008` | Sim, com `TASK-043` |
| `TASK-043` | Documentar Firebase Auth e Analytics | `TASK-008`, `TASK-011` | Sim, com `TASK-012` |

Cada task deve permanecer no seu limite:

- `TASK-012` define projetos, ambientes, segredos, Cloud Run, Cloud SQL e o
  limite de entrega de e-mails pelo Resend. Nao provisiona infraestrutura.
- `TASK-043` documenta a configuracao dos projetos Firebase Auth e Analytics.
  Nao implementa o app Expo nem o adapter de Analytics.

`TASK-044` permanece bloqueada ate a conclusao da `TASK-012`.

## Tasks que Nao Devem Comecar Agora

### Bloqueio da fundacao alvo

As tasks abaixo exigem componentes que ainda nao existem no codigo:

| Tasks | Bloqueio |
| --- | --- |
| `TASK-009` | Aguarda a nova fundacao Expo e a especificacao concluida da `TASK-008` |
| `TASK-017` | Aguarda a nova fundacao GraphQL, `TASK-009` e o plano concluido da `TASK-010` |
| `TASK-034`, `TASK-040` | Aguardam a nova fundacao GraphQL e o contexto Firebase Admin implementado |
| `TASK-035`, `TASK-041`, `TASK-042` | Aguardam a nova fundacao Expo e os adapters implementados |
| `TASK-015`, `TASK-036` | Aguardam fundacoes e fluxos integrados estaveis |
| `TASK-037` | Aguarda builds reais do backend GraphQL e do Expo Web |

Nenhuma task de implementacao deve contornar a correcao obrigatoria do backlog
ou assumir que as fundacoes GraphQL e Expo ja existem.

### Dependencias dentro da autenticacao

| Task | Deve aguardar |
| --- | --- |
| `TASK-018` | `TASK-009` e o fluxo de sessao Firebase |
| `TASK-019` | `TASK-009`, `TASK-012` e `TASK-044` |
| `TASK-020` | `TASK-017` e o modelo de perfil autenticado |

### Funcionalidades de produto

| Tasks | Deve aguardar |
| --- | --- |
| `TASK-021`, `TASK-022`, `TASK-024` a `TASK-027` | Autenticacao, autorizacao e persistencia GraphQL estaveis |
| `TASK-023`, `TASK-028` a `TASK-030` | Dados financeiros implementados e consultaveis |
| `TASK-013`, `TASK-031` a `TASK-033` | Autorizacao e contexto financeiro seguro |
| `TASK-014`, `TASK-045` a `TASK-047` | Identidade, persistencia e fundacao da agenda |

### Deploy e operacao

| Tasks | Deve aguardar |
| --- | --- |
| `TASK-016` | Decisoes das `TASK-012`, `TASK-043` e `TASK-044`, alem dos alvos de build |
| `TASK-038`, `TASK-039` | Infraestrutura e builds de producao definidos e verificaveis |

## Resumo de Execucao

```text
Agora:
  TASK-012 --------> TASK-044
  TASK-043

Correcao do backlog:
  criar task GraphQL --> implementar fundacao GraphQL
  criar task Expo ----> implementar fundacao Expo --> TASK-009
```

- `TASK-012` e `TASK-043` podem avancar em paralelo.
- `TASK-044` depende da `TASK-012`.
- As novas tasks de fundacao podem ser planejadas em paralelo com a proxima
  onda documental.
- Tasks de implementacao dependentes permanecem bloqueadas ate suas fundacoes
  existirem e serem verificadas.

## Regra de Inicio

Antes de mover uma task para `In Progress`, confirme:

1. Todas as dependencias listadas neste guia estao concluidas.
2. A task possui objetivo, escopo, fora de escopo e criterios de aceite claros.
3. Os testes necessarios foram definidos antes da implementacao.
4. Nenhuma decisao contradiz a arquitetura ou as especificacoes aprovadas.
5. A task pode ser concluida sem assumir componentes ainda inexistentes.
