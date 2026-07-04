# Guia de Execucao das Proximas Tasks

## Objetivo

Este guia define quais tasks pendentes devem ser executadas agora, quais podem
avancar em paralelo e quais devem permanecer bloqueadas. Ele nao cria tasks,
nao altera escopo e nao substitui os criterios de aceite de cada task.

## Estado de Partida

- `TASK-001` ate `TASK-007` estao concluidas.
- `EPIC-01` permanece pendente porque a fundacao GraphQL e Expo foi planejada,
  mas ainda nao foi implementada.
- A proxima task obrigatoria e `TASK-008`.
- A ordem numerica nao deve ser usada isoladamente para decidir a execucao.

## Fluxo Recomendado

### Onda 1 - Decisao de identidade

Execute primeiro:

| Task | Objetivo | Depende de | Pode executar em paralelo |
| --- | --- | --- | --- |
| `TASK-008` | Configurar as especificacoes de autenticacao Firebase | `TASK-006`, `TASK-007` | Nao nesta onda |

A `TASK-008` deve fixar os contratos de registro, login, verificacao de e-mail,
recuperacao de senha, token Firebase, perfil e limites de autorizacao. As tasks
seguintes nao devem inventar regras de identidade diferentes.

### Onda 2 - Planos independentes

Depois da `TASK-008`, estas tasks podem ser executadas simultaneamente:

| Task | Objetivo | Depende de | Independencia |
| --- | --- | --- | --- |
| `TASK-010` | Planejar o contexto de autenticacao com Firebase Admin | `TASK-006`, `TASK-008` | Nao depende de `TASK-011` ou `TASK-012` |
| `TASK-011` | Planejar o adapter de Firebase Analytics | `TASK-007`, `TASK-008` | Nao depende de `TASK-010` ou `TASK-012` |
| `TASK-012` | Planejar a documentacao de GCP e Resend | `TASK-006`, `TASK-007`, `TASK-008` | Nao depende de `TASK-010` ou `TASK-011` |

Cada task deve permanecer no seu limite:

- `TASK-010` define verificacao de token, contexto autenticado e propagacao do
  Firebase UID no backend.
- `TASK-011` define o contrato de eventos e as implementacoes Web, iOS e
  Android sem acoplar Analytics aos fluxos financeiros.
- `TASK-012` define projetos, ambientes, segredos, Cloud Run, Cloud SQL e o
  limite de entrega de e-mails pelo Resend.

### Onda 3 - Guias de configuracao

Quando os planos da onda anterior estiverem concluidos, estas duas tasks podem
ser executadas em paralelo:

| Task | Objetivo | Depende de | Independencia |
| --- | --- | --- | --- |
| `TASK-043` | Documentar a configuracao de Firebase Auth e Analytics | `TASK-008`, `TASK-011` | Nao depende de `TASK-044` |
| `TASK-044` | Documentar dominio, remetente e entrega transacional do Resend | `TASK-008`, `TASK-012` | Nao depende de `TASK-043` |

## Tasks que Nao Devem Comecar Agora

### Bloqueio da fundacao alvo

As tasks abaixo exigem componentes que ainda nao existem no codigo:

| Tasks | Bloqueio |
| --- | --- |
| `TASK-009` | Requer a fundacao Expo implementada e a especificacao da `TASK-008` |
| `TASK-017` | Requer backend GraphQL, `TASK-009` e o plano da `TASK-010` |
| `TASK-034`, `TASK-040` | Requerem backend GraphQL e contexto Firebase Admin implementados |
| `TASK-035`, `TASK-041`, `TASK-042` | Requerem app Expo e adapters implementados |
| `TASK-015`, `TASK-036` | Requerem fluxos integrados e estaveis no app Expo e no backend GraphQL |
| `TASK-037` | Requer builds reais do backend GraphQL e do Expo Web |

O planejamento atual nao possui uma task de execucao para migrar o backend REST
para GraphQL nem uma task de execucao para migrar o frontend Vite para Expo.
Esse bloqueio deve ser resolvido no planejamento antes de iniciar `TASK-009`.
Este guia apenas registra o bloqueio e nao cria novas tasks.

### Dependencias dentro da autenticacao

| Task | Deve aguardar |
| --- | --- |
| `TASK-018` | `TASK-009` e o fluxo de sessao Firebase |
| `TASK-019` | `TASK-008`, `TASK-009`, `TASK-012` e `TASK-044` |
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

## Resumo de Paralelismo

```text
TASK-008
   |
   +--> TASK-010
   +--> TASK-011 --> TASK-043
   +--> TASK-012 --> TASK-044
```

- `TASK-010`, `TASK-011` e `TASK-012` sao independentes entre si depois da
  `TASK-008`.
- `TASK-043` e `TASK-044` sao independentes entre si quando seus respectivos
  planos estiverem concluidos.
- Nenhuma task de implementacao deve contornar o bloqueio da fundacao GraphQL e
  Expo.

## Regra de Inicio

Antes de mover uma task para `In Progress`, confirme:

1. Todas as dependencias listadas neste guia estao concluidas.
2. A task possui objetivo, escopo, fora de escopo e criterios de aceite claros.
3. Os testes necessarios foram definidos antes da implementacao.
4. Nenhuma decisao contradiz a arquitetura ou a especificacao de autenticacao.
5. A task pode ser concluida sem assumir componentes ainda inexistentes.
