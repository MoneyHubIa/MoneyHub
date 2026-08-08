# Aplicação de origem única

## Objetivo

Publicar o frontend web e a API GraphQL na mesma origem pública para que o
frontend use `/graphql` e não precise conhecer uma URL de backend separada.

## Configuração

- `APP_URL` é a única URL pública da aplicação, por exemplo
  `http://177.71.25.231:3000`.
- O backend escuta na porta indicada por `PORT` e deriva a origem permitida de
  `APP_URL` apenas para compatibilidade com clientes externos.
- O frontend não usa `EXPO_PUBLIC_GRAPHQL_ENDPOINT`. No web, o Apollo Client
  usa o caminho relativo `/graphql`. Em clientes nativos, ele resolve esse
  caminho contra `APP_URL`.

## Entrega HTTP

1. O Express registra `/graphql`, `/health` e seus middlewares de segurança.
2. Em produção, o Express entrega `apps/frontend/dist` como arquivos estáticos.
3. Requisições GET que não correspondam a uma rota da API retornam o
   `index.html` do frontend, permitindo o roteamento web do Expo.
4. O navegador carrega o frontend e chama `/graphql` na mesma origem; portanto
   não há preflight CORS nesse fluxo.

## Desenvolvimento

O Expo continua disponível para desenvolvimento da interface. Para um navegador
acessar a API pelo servidor Express, o build exportado é servido pelo backend.
Clientes Android e iOS usam `APP_URL` para resolver `/graphql`; não há uma
variável de endpoint diferente por ambiente.

## Erros e segurança

- Rotas de API continuam com resposta JSON e `x-request-id`.
- Rotas do frontend retornam o HTML da aplicação somente para requisições GET
  que aceitem HTML; caminhos desconhecidos da API permanecem 404 JSON.
- CORS não é uma dependência da comunicação web de origem única.

## Testes

- Testar que o Apollo resolve `/graphql` a partir de `APP_URL` em ambiente
  nativo e mantém o caminho relativo no web.
- Testar que o Express entrega o arquivo estático e o fallback `index.html`.
- Testar que `/graphql` continua acessível e que uma rota de API desconhecida
  não recebe o fallback HTML.
