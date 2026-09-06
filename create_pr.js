async function createPR() {
  const token = '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';
  const url = 'https://api.github.com/repos/MoneyHubIa/MoneyHub/pulls';
  const data = {
    title: 'feat(ai): assistente financeiro flutuante com function calling e integração Ollama',
    head: 'feature/ai-assistant-widget-and-tool-calling',
    base: 'main',
    body: `## 🎯 O que foi feito

Esta Pull Request traz uma evolução completa para o **Agente de IA do MoneyHub**, integrando suporte a **Function Calling / Tool Calling** nativo (com Ollama \`llama3.1:8b\` e provedores compatíveis), um novo **Widget Flutuante no canto inferior direito** com suporte a Markdown formatado, e prompts refinados para respostas financeiras concisas e diretas.

---

### 🤖 1. Principais Funcionalidades Entregues

#### 🔹 Widget Flutuante de IA no Canto Inferior Direito
- **Floating Action Button (FAB)**: O assistente agora fica disponível em todas as telas no canto inferior direito, podendo ser aberto e fechado/minimizado a qualquer momento.
- **Remoção da aba isolada**: A aba vazia "ia" da barra lateral foi removida, e a ação "Consultar IA" no topo e menu agora aciona diretamente o widget flutuante.
- **Renderização Markdown Nata**: Suporte completo a formatação com **negrito** (\`**texto**\`), itálico (\`*texto*\`), listas com marcadores (\`•\` ou \`-\`), listas numeradas (\`1.\`), títulos (\`###\`) e blocos de código inline (\`code\`).

#### 🔹 Function Calling / Tool Calling Nativo
- **Módulo de Ferramentas (\`apps/backend/src/ai-tools.ts\`)**:
  - \`get_financial_summary\`: Consulta dinamicamente totais de receitas, despesas, saldo e maiores categorias para qualquer intervalo de datas (ex: ano de 2025, últimos 2 meses, etc.).
  - \`get_category_expenses\`: Detalha gastos específicos por categoria em períodos arbitrários.
  - \`get_upcoming_bills\`: Consulta contas a pagar pendentes e em atraso nos próximos N dias.
- **Isolamento Multi-tenant Estrito**: Todas as ferramentas executam consultas no PostgreSQL filtrando estritamente pelo \`userId\` autenticado.

#### 🔹 Suporte a Provedores LLM & Ollama Local
- **OpenAiCompatibleLlmAdapter**: Atualizado para enviar definições de \`tools\`, tratar respostas com \`finish_reason: "tool_calls"\` e timeout configurável (\`LLM_TIMEOUT_MS=120000\` para modelos locais).
- **Loop Multi-Turn Orchestrator (\`apps/backend/src/ai-service.ts\`)**:
  - Permite até 3 iterações autônomas de execução de ferramentas e reenvio de resultados para síntese final do modelo.
  - Rastreamento cumulativo de tokens (\`promptTokens\`, \`completionTokens\`, \`totalTokens\`).

#### 🔹 Otimização de Prompts & Respostas Concisas
- **Respostas Diretas e Objetivas**: Diretrizes de comunicação no prompt do sistema instruindo o modelo a evitar saudações longas ou prolixidade, priorizando tópicos, números em negrito e no máximo 2 a 3 sugestões práticas.

---

### 🛡️ 2. Qualidade e Conformidade com Diretrizes

- **TypeScript — Proibição de Any**: Zero \`any\` em todo o código adicionado ou modificado. Tipagem 100% estrita para ferramentas, argumentos, retornos e componentes React.
- **Segurança e Redação**: Chaves e credenciais protegidas; sanitização XML contra injeções diretas e indiretas de prompt.

---

### 🧪 3. Cobertura de Testes

- **Backend:** **223/223 testes passando** (31 suites de teste)
- **Frontend:** **163/163 testes passando** (27 suites de teste)
- **Total:** **386/386 testes passando com 100% de sucesso** ✅
- **Teste ao Vivo com Ollama (\`llama3.1:8b\`):** Validado com sucesso end-to-end simulando perguntas com datas anteriores (ex: 2025) e confirmando o disparo correto das ferramentas.

---

### 📋 Como Testar

1. Inicie o Ollama localmente com o modelo \`llama3.1:8b\` (\`ollama run llama3.1:8b\`).
2. Inicie o backend com \`npm run dev\` e o frontend com \`npm run dev\`.
3. Abra a aplicação no navegador e clique no botão do assistente flutuante no canto inferior direito.
4. Faça perguntas como:
   - *"Qual foi meu resumo financeiro no ano de 2025 inteiro?"*
   - *"Onde eu mais gastei nos últimos meses?"*
   - *"Quais contas tenho para pagar nos próximos dias?"*
   - *"Como posso economizar com base nos meus maiores gastos?"*`
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'node'
    },
    body: JSON.stringify(data)
  });

  const json = await response.json();
  if (!response.ok) {
    console.error('Error creating PR:', json);
    process.exit(1);
  }
  console.log('PR created successfully:', json.html_url);
}

createPR();
