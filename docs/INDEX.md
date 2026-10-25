# Índice da documentação

Palavras-chave: @docs | documentacao | indice | contexto

Documentação do código atual. Cada assunto possui um arquivo responsável;
consulte a fonte executável para assinaturas, campos ou versões completas.

## Consulta por assunto

| Palavra-chave | Aliases de busca | Ler quando precisar de |
| --- | --- | --- |
| [@project](PROJECT.md) | arquitetura, stack, estrutura, convencoes | Entender componentes e organização do projeto. |
| [@setup](SETUP.md) | ambiente, env, instalar, executar, rede | Configurar desenvolvimento e localizar variáveis. |
| [@auth](AUTH.md) | autenticacao, login, firebase, sessao, senha, autorizacao | Entender identidade, permissões e recuperação. |
| [@data](DATA.md) | dados, postgres, prisma, schema, migrations | Entender persistência e relações. |
| [@api](API.md) | graphql, rest, endpoints, queries, mutations, erros | Localizar operações e contratos de transporte. |
| [@finance](FINANCE.md) | financeiro, metas, aportes, recorrencias, agenda, notificacoes, dashboard | Consultar regras de negócio atuais. |
| [@frontend](FRONTEND.md) | expo, rotas, componentes, tema, interface, analytics | Alterar app, navegação e instrumentação. |
| [@ai](AI.md) | ia, llm, prompts, ferramentas, tools, modelo, auditoria | Configurar ou entender o assistente. |
| [@tests](TESTING.md) | testes, cobertura, e2e, maestro, ci, acessibilidade | Executar verificações e identificar seu alcance. |
| [@deploy](DEPLOY.md) | vercel, publicar, producao, operacao, rollback | Publicar app/API e aplicar migrations. |
| [@limits](LIMITS.md) | limites, seguranca, riscos, evidencias, pendencias | Verificar limitações e garantias ausentes. |

## Uso por agentes e LLMs

1. Localize a palavra-chave ou alias da solicitação nesta tabela.
2. Abra somente o documento correspondente; não carregue toda a pasta.
3. Siga os links relacionados apenas quando a tarefa atravessar outro assunto.
4. Para um valor ou contrato preciso, abra a fonte indicada pelo documento.
5. Não infira comportamento de produção a partir de código ou status de entrega.

Exemplo de busca local: rg -n "recuperacao|senha|@auth" docs/INDEX.md.

## Rotas de consulta frequentes

| Solicitação | Entrada | Complemento quando necessário |
| --- | --- | --- |
| Recuperar senha | [@auth](AUTH.md) | [@api](API.md) para respostas HTTP. |
| Configurar modelo IA | [@ai](AI.md) | [@setup](SETUP.md) para ambiente. |
| Executar E2E | [@tests](TESTING.md) | [@setup](SETUP.md) para rede. |
| Publicar metas | [@deploy](DEPLOY.md) | [@finance](FINANCE.md) para smoke funcional. |
| Rever segurança | [@limits](LIMITS.md) | [@auth](AUTH.md) para identidade. |

## Manutenção

Cada arquivo tem até 200 linhas. Atualize o assunto responsável e mantenha
links por palavra-chave; não replique schemas, prompts, manifests ou histórico
de tarefas. Registre resultados de execução na entrega correspondente, não
como garantia permanente nesta documentação.

Fontes: [manifest raiz](../package.json) e fontes executáveis indicadas por assunto.
