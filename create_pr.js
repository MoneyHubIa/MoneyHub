async function createPR() {
  const token = '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';
  const url = 'https://api.github.com/repos/MoneyHubIa/MoneyHub/pulls';
  const data = {
    title: 'feat(auth): implement profile bootstrap flow',
    head: 'feat/auth-profile-bootstrap',
    base: 'main',
    body: `## O que foi feito
Esta Pull Request implementa a **TASK-017** (Profile Bootstrap) no Frontend e no Backend.

- **Backend:** 
  - Adicionada a mutation \`bootstrapProfile\` no GraphQL.
  - Implementado o resolver com transação ACID usando Prisma (garante a atualização na tabela \`users\` e criação na tabela \`profiles\`).
  - Corrigida a variável de ambiente \`.env\` para suportar o caractere \`#\` na string de conexão do PostgreSQL.
  
- **Frontend:**
  - Nova tela \`app/(app)/onboarding.tsx\` para captação dos dados complementares.
  - O \`AuthenticatedLayout\` agora consulta o GraphQL (\`me\`) e redireciona automaticamente usuários sem perfil configurado para o Onboarding.
  
## Como Testar
1. Suba os contêineres e certifique-se de que o banco de dados está atualizado (\`npx prisma db push\`).
2. Faça login com um usuário novo.
3. Você será forçado a passar pela tela de Onboarding.
4. Preencha os dados e confirme. Você deverá ser redirecionado para o Dashboard e as duas tabelas no DB devem constar seus dados corretamente.`
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
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
