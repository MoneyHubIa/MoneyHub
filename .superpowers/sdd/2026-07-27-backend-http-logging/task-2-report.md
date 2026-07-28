# Task 2 — Integração Express do logging HTTP

## Status

Concluída. `createApp` aceita um logger HTTP injetável, usa `appLogger` como
padrão e instala o middleware imediatamente após a atribuição de request ID.

## Arquivos alterados

- `apps/backend/src/app.ts`
- `apps/backend/src/http-logger.ts`
- `apps/backend/tests/http-logger.test.ts`

O ajuste em `http-logger.ts` captura o caminho antes do evento `finish`. Em
Express, um middleware montado pode alterar `request.path` para a rota interna
antes de a resposta terminar; sem o snapshot, o evento de `/graphql` registrava
`/`.

## Evidência RED

Comando:

```powershell
fnm env --shell powershell | Out-String | Invoke-Expression; fnm use 22.23.1; npm test --workspace @moneyhub/backend
```

Resultado: falhou como esperado antes da integração. As quatro novas integrações
produziram `logs.length === 0` em vez de `1`, pois `CreateAppOptions` ainda não
aceitava `logger` e o middleware ainda não estava instalado. Após a integração
inicial, a cobertura GraphQL revelou a falha real de caminho: esperado
`/graphql`, recebido `/`.

## Evidência GREEN e suíte completa

Mesmo comando, com Node `v22.23.1`:

```text
# tests 16
# pass 16
# fail 0
```

Cobertura incluída: `/health` com request ID e query excluída, GraphQL anônimo
200/info, GraphQL rejeitado 401/warn sem token ou variáveis, e fallback 404/warn.

Validações adicionais:

```powershell
npm run typecheck --workspace @moneyhub/backend
npm run lint --workspace @moneyhub/backend
```

Ambas concluíram com código de saída `0`.

## Self-review

- O middleware vem após o middleware de request ID e antes de todas as rotas.
- A injeção não muda o comportamento de produção: `appLogger` permanece padrão.
- Cada request gera um único evento no `finish` e o caminho é sanitizado, sem
  query string, cabeçalhos, corpo, token ou variáveis GraphQL.
- O snapshot de caminho resolve o comportamento específico do Express em rotas
  montadas e é exercitado pelos dois cenários GraphQL.
- `apps/backend/tests/foundation.test.ts` não foi alterado.
- Revisão independente: sem achados críticos, importantes ou menores.

## Commit

`feat(backend): integrate HTTP request logging with Express`

## Preocupações

Nenhuma conhecida.
