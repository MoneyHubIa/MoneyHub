# MoneyHub

Aplicação universal de gestão financeira pessoal e empresarial.

## Pré-requisitos

- Docker Desktop ou Docker Engine com Docker Compose v2, em execução e usando containers Linux.
- Git, para clonar o repositório (ou baixe e extraia o ZIP pelo GitHub).
- Portas locais `8080`, `3000` e `9099` livres e internet para o primeiro build.

Não é necessário instalar Node.js, npm ou PostgreSQL na máquina, nem criar conta Firebase.

## Instalação com Docker Compose

### 1. Baixar o projeto

Abra um terminal e execute:

```sh
git clone https://github.com/MoneyHubIa/MoneyHub.git
cd MoneyHub
```

Se você baixou o ZIP, abra o terminal na pasta extraída que contém `compose.yaml`.

### 2. Preparar a configuração local (opcional)

O projeto funciona com os valores de desenvolvimento do Compose, mesmo sem `.env`.
Para usar o arquivo de exemplo, copie [.env.example](.env.example) para `.env` na raiz.
Se já houver um `.env`, preserve-o e adicione apenas as opções desejadas do exemplo.

Linux/macOS:

```sh
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Mantenha os valores de demonstração para o primeiro uso. O Compose lê
`MONEYHUB_RATE_LIMIT_MAX` e `MONEYHUB_RATE_LIMIT_WINDOW_MS` para configurar o
limite de requisições da API. O exemplo também inclui variáveis para executar
o projeto sem Docker, identificadas em um bloco separado.
Não coloque segredos reais no exemplo nem versione o seu `.env`.

### 3. Construir e iniciar os serviços

Com o Docker em execução, rode na raiz do repositório:

```sh
docker compose up --build
```

O primeiro build baixa imagens e dependências e pode levar alguns minutos.
O comando mantém os logs no terminal. Ele inicia os serviços `db`, `backend` e
`frontend`; o Auth Emulator roda junto do backend.

O backend aguarda o banco ficar pronto, aplica as migrations e prepara os dados
de demonstração antes de iniciar a API. Você não precisa criar tabelas nem
executar o seed manualmente.

Em outro terminal, na mesma pasta, confira o estado:

```sh
docker compose ps
```

Aguarde os três serviços exibirem `healthy`. Depois, abra
<http://localhost:8080> e use as credenciais abaixo.

Para executar em segundo plano, use `docker compose up --build -d`.

## URLs e acesso de demonstração

- Aplicação: <http://localhost:8080>
- API GraphQL: <http://localhost:3000/graphql>
- Saúde da API: <http://localhost:3000/health>
- Firebase Auth Emulator: <http://localhost:9099> (API local, sem painel Web)
- Email: `demo@moneyhub.local`
- Senha: `MoneyHubDemo123!`

Explore dashboard, receitas, despesas, categorias, centros de custo, contas,
recorrências, metas e agenda. Os dados abrangem o mês da primeira inicialização
e três meses anteriores. Reiniciar não duplica nem sobrescreve os registros existentes.

Este ambiente usa somente valores de desenvolvimento e autenticação emulada.
Não o publique em produção. A IA usa respostas simuladas (`LLM_PROVIDER=mock`);
os emails de autenticação não são enviados: os links aparecem nos logs do backend.
Para consultar os logs, execute `docker compose logs backend`.

## Parar ou reiniciar a demonstração

Para interromper a execução no terminal, pressione `Ctrl+C`. Para parar e remover
os containers, execute na raiz:

```sh
docker compose down
```

O banco persiste em volume. As identidades do emulador são exportadas durante
o encerramento normal e importadas na próxima inicialização. Após uma parada
forçada, o usuário de demonstração é recriado se necessário; alterações recentes
de autenticação podem ser perdidas. Alterações de senha persistidas mudam o login acima.

Para iniciar novamente, execute `docker compose up --build`.

Para apagar **todos os dados locais da demonstração**, inclusive usuários, execute:

```sh
docker compose down -v
docker compose up --build
```

## Resolver problemas de inicialização

- Se o Docker não responder, abra o Docker Desktop ou inicie o Docker Engine.
- Se uma porta estiver ocupada, encerre o serviço que usa `8080`, `3000` ou `9099` e tente novamente.
- Para acompanhar falhas, execute `docker compose logs --tail=100 backend db frontend`.
- Se a autenticação foi alterada durante os testes, use a nova senha ou recrie a demonstração com o procedimento acima.


Documentação: [índice por assunto e palavra-chave](docs/INDEX.md).

Agentes e LLMs: comece pelo índice e carregue somente os assuntos necessários.
