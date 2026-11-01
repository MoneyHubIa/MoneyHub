export type PublicPageName =
  | 'apresentacao'
  | 'informacoes'
  | 'planos'
  | 'contato'
  | 'privacidade'
  | 'termos';
export type PublicPageProps = Readonly<{ page: PublicPageName }>;

export const publicContact = {
  email: 'igorcardosofrancolin@gmail.com',
  phone: '(16) 98801-5612',
  whatsapp: '5516988015612'
} as const;

export type PublicPlan = Readonly<{
  id: 'gratuito' | 'plus' | 'ultra';
  name: string;
  monthlyPrice: number;
  licenses: number;
  description: string;
  features: readonly string[];
  action: string;
  href: '/register' | '/contato?plano=plus' | '/contato?plano=ultra';
}>;

export const publicPlans: readonly PublicPlan[] = [
  {
    id: 'gratuito',
    name: 'Gratuito',
    monthlyPrice: 0,
    licenses: 1,
    description: 'O primeiro passo para organizar seu dinheiro.',
    features: [
      'Organização financeira inicial',
      'Visão de receitas e despesas',
      'Acompanhamento do dia a dia'
    ],
    action: 'Começar gratuitamente',
    href: '/register'
  },
  {
    id: 'plus',
    name: 'Plus',
    monthlyPrice: 14.99,
    licenses: 1,
    description: 'Mais espaço para seus planos pessoais.',
    features: [
      'Proposta de gestão individual',
      'Metas e acompanhamento financeiro',
      'Visão ampliada da sua organização'
    ],
    action: 'Consultar Plus',
    href: '/contato?plano=plus'
  },
  {
    id: 'ultra',
    name: 'Ultra',
    monthlyPrice: 99.99,
    licenses: 10,
    description: 'Uma proposta para organizar mais pessoas.',
    features: [
      'Proposta de uso com 10 licenças',
      'Organização para pequenos negócios',
      'Condições de uso a definir'
    ],
    action: 'Consultar Ultra',
    href: '/contato?plano=ultra'
  }
];

export const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function contactLinks(planParameter?: string | string[]) {
  const plan =
    typeof planParameter === 'string'
      ? publicPlans.find((item) => item.id !== 'gratuito' && item.id === planParameter)
      : undefined;
  const subject = plan ? `Conhecer o plano ${plan.name} do MoneyHub` : 'Conversar sobre o MoneyHub';
  const message = plan
    ? `Olá! Quero saber mais sobre o plano ${plan.name} do MoneyHub, de ${formatBRL(
        plan.monthlyPrice
      )}/mês, com ${plan.licenses} ${plan.licenses === 1 ? 'licença' : 'licenças'}.`
    : 'Olá! Gostaria de saber mais sobre o MoneyHub.';
  return {
    plan,
    email: `mailto:${publicContact.email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(message)}`,
    whatsapp: `https://wa.me/${publicContact.whatsapp}?text=${encodeURIComponent(message)}`
  };
}

export const publicMetadata: Record<PublicPageName, { title: string; description: string }> = {
  apresentacao: {
    title: 'MoneyHub | Seu dinheiro, com direção',
    description:
      'Organize receitas, despesas, metas e compromissos pessoais ou do seu pequeno negócio. Conheça o MoneyHub e encontre seu próximo passo.'
  },
  informacoes: {
    title: 'Como funciona | MoneyHub',
    description:
      'Conheça os recursos do MoneyHub, veja como começar e tire dúvidas sobre organização financeira e o assistente IA.'
  },
  planos: {
    title: 'Planos Gratuito, Plus e Ultra | MoneyHub',
    description:
      'Conheça as propostas mensais do MoneyHub: Gratuito, Plus por R$ 14,99 com 1 licença e Ultra por R$ 99,99 com 10 licenças.'
  },
  contato: {
    title: 'Fale com a gente | MoneyHub',
    description:
      'Converse sobre o MoneyHub, tire dúvidas e consulte os planos por email ou WhatsApp.'
  },
  privacidade: {
    title: 'Privacidade e dados | MoneyHub',
    description:
      'Saiba quais dados são usados no MoneyHub, conheça as tecnologias envolvidas e encontre o canal para solicitações de privacidade.'
  },
  termos: {
    title: 'Termos de uso | MoneyHub',
    description:
      'Leia as condições iniciais de uso do MoneyHub e informações sobre as propostas de planos e o assistente IA.'
  }
};

export const faqs = [
  {
    question: 'O MoneyHub é para mim ou para minha empresa?',
    answer:
      'Para os dois contextos. Você pode organizar sua vida financeira pessoal ou acompanhar receitas, despesas e compromissos de um pequeno negócio. A apresentação mostra exemplos de cada uso.'
  },
  {
    question: 'Por onde eu começo?',
    answer:
      'Crie uma conta, confirme seu email e conclua seu perfil. Depois, registre suas contas, receitas e despesas para começar a acompanhar suas finanças.'
  },
  {
    question: 'Os planos pagos já podem ser contratados?',
    answer:
      'Os planos Plus e Ultra são propostas iniciais. Os preços são mensais, e os benefícios apresentados são ilustrativos. Consulte os canais de contato para saber mais. Os botões não contratam nem ativam uma assinatura.'
  },
  {
    question: 'Preciso conectar minha conta bancária?',
    answer:
      'Não é necessário conectar sua conta bancária para registrar e acompanhar suas finanças. Não anunciamos sincronização bancária automática nesta apresentação.'
  },
  {
    question: 'O que o assistente IA faz?',
    answer:
      'O assistente ajuda a consultar e compreender informações financeiras disponibilizadas pelo aplicativo. As respostas podem conter erros e devem ser conferidas. Ele não substitui orientação financeira, contábil ou jurídica profissional.'
  },
  {
    question: 'Onde posso acessar o MoneyHub?',
    answer:
      'Você pode usar a versão Web pelo navegador. O projeto também possui clientes Android e iOS, mas esta apresentação não anuncia disponibilidade em lojas de aplicativos.'
  }
] as const;
