# Navegação do menu lateral

## Objetivo

Tornar os botões do menu lateral interativos dentro da aplicação atual, exibindo
uma seção correspondente no painel principal sem introduzir roteamento por URL.

## Comportamento

- `Dashboard` inicia selecionado e mantém o conteúdo financeiro existente.
- Ao clicar em `Financeiro`, `Contas`, `Metas`, `Agenda`, `IA` ou `Ajustes`, a
  seção clicada passa a ser a ativa.
- Cada seção diferente de `Dashboard` exibe seu título e uma mensagem curta
  indicando que o conteúdo será disponibilizado futuramente.
- Somente o item ativo recebe o destaque visual.
- O item ativo expõe `aria-current="page"` para tecnologias assistivas.

## Implementação

`App` manterá a identificação da seção ativa em estado local. Os itens de
navegação terão uma identificação estável, título, ícone e descrição. Um único
handler atualizará o estado, e a renderização do painel principal escolherá
entre o dashboard existente e o placeholder da seção ativa.

Não será adicionada uma biblioteca de rotas, porque não há requisito atual de
URLs, histórico do navegador ou links profundos.

## Testes

Um teste de interação deverá:

1. confirmar que `Dashboard` inicia ativo;
2. clicar em outro botão;
3. confirmar a alteração do conteúdo principal;
4. confirmar que `aria-current` foi movido para o botão selecionado.

Os testes existentes de estrutura e o build também deverão continuar passando.
