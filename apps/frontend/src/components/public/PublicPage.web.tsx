import { useLocalSearchParams } from 'expo-router';
import {
  ArrowDownLeft,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  Flag,
  Mail,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  WalletCards
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import {
  contactLinks,
  faqs,
  formatBRL,
  publicContact,
  publicPlans,
  type PublicPageProps
} from './content';
import { MoneyMap } from './MoneyMap.web';
import { ArrowIcon, PublicShell, SiteLink } from './PublicShell.web';

function StartLink({
  className = 'mh-button',
  children
}: {
  className?: string;
  children?: ReactNode;
}) {
  const { user } = useAuth();
  return (
    <SiteLink href={user ? '/(app)' : '/register'} className={className}>
      {user ? 'Acessar meu painel' : children ?? 'Começar gratuitamente'}
      <ArrowIcon />
    </SiteLink>
  );
}

function ClosingInvitation() {
  return (
    <section className="mh-invitation mh-container">
      <div>
        <p className="mh-kicker">O próximo passo é seu</p>
        <h2>
          Menos contas na cabeça.
          <br />
          Mais planos pela frente.
        </h2>
      </div>
      <StartLink className="mh-button mh-button-light" />
    </section>
  );
}

function Plans({ preview = false }: { preview?: boolean }) {
  const Heading = preview ? 'h3' : 'h2';
  return (
    <div className={`mh-plans${preview ? ' mh-plans-preview' : ''}`}>
      {publicPlans.map((plan) => (
        <article key={plan.id} className={`mh-plan mh-plan-${plan.id}`}>
          <div className="mh-plan-heading">
            <Heading>{plan.name}</Heading>
            {plan.id === 'plus' && <span className="mh-plan-tag">Seu plano individual</span>}
          </div>
          <p className="mh-plan-description">{plan.description}</p>
          <p className="mh-price">
            <strong>{formatBRL(plan.monthlyPrice)}</strong>
            <span>/mês</span>
          </p>
          <p className="mh-plan-license">
            {plan.licenses} {plan.licenses === 1 ? 'licença' : 'licenças incluídas'}
          </p>
          {!preview && (
            <ul className="mh-plan-features">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <span aria-hidden={true}>
                    <Check size={17} />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          )}
          {plan.id === 'gratuito' ? (
            <StartLink className="mh-button mh-button-outline" />
          ) : (
            <SiteLink
              href={plan.href}
              className={plan.id === 'plus' ? 'mh-button' : 'mh-button mh-button-outline'}
            >
              {plan.action}
              <ArrowIcon />
            </SiteLink>
          )}
        </article>
      ))}
    </div>
  );
}

function Faq() {
  return (
    <section className="mh-faq mh-container" aria-labelledby="faq-title">
      <div>
        <p className="mh-kicker">Pode perguntar</p>
        <h2 id="faq-title">
          Clareza desde
          <br />o primeiro contato.
        </h2>
        <p>
          Se a sua dúvida não estiver aqui,
          <br />a conversa continua com a gente.
        </p>
        <SiteLink href="/contato" className="mh-text-link">
          Falar sobre o MoneyHub
          <ArrowIcon />
        </SiteLink>
      </div>
      <div className="mh-faq-list">
        {faqs.map((item) => (
          <details key={item.question}>
            <summary>
              {item.question}
              <span aria-hidden={true} className="mh-faq-plus">
                +
              </span>
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function PresentationPage() {
  return (
    <>
      <section className="mh-hero mh-container">
        <div className="mh-hero-copy">
          <p className="mh-kicker">
            <span className="mh-small-line" />
            Finanças com perspectiva
          </p>
          <h1>
            Seu dinheiro
            <br />
            tem um caminho.
            <br />
            Dê a direção.
          </h1>
          <p className="mh-hero-description">
            Conecte o que entra, o que sai e o que você quer conquistar. Sua vida financeira, vista
            por inteiro.
          </p>
          <div className="mh-hero-actions">
            <StartLink />
            <SiteLink href="/informacoes" className="mh-text-link">
              Conhecer o MoneyHub
              <ArrowIcon />
            </SiteLink>
          </div>
          <p className="mh-hero-note">
            <span aria-hidden={true}>
              <Check size={16} />
            </span>
            Para sua vida. Para seu pequeno negócio.
          </p>
        </div>
        <MoneyMap />
        <div className="mh-hero-baseline">
          <span>Do primeiro registro ao próximo objetivo.</span>
          <span className="mh-scroll-hint">
            Explore uma nova perspectiva<span aria-hidden={true}>↓</span>
          </span>
        </div>
      </section>
      <section className="mh-resource-band" aria-label="O que você pode organizar">
        <div className="mh-container">
          <span>
            <WalletCards size={20} aria-hidden={true} />
            Receitas e despesas
          </span>
          <span>
            <CalendarDays size={20} aria-hidden={true} />
            Agenda financeira
          </span>
          <span>
            <Flag size={20} aria-hidden={true} />
            Metas que fazem sentido
          </span>
          <span>
            <Sparkles size={20} aria-hidden={true} />
            Assistente IA
          </span>
        </div>
      </section>
      <section className="mh-perspective mh-container">
        <div>
          <p className="mh-kicker">Mais contexto. Melhores escolhas.</p>
          <h2>
            Você não precisa
            <br />
            guardar tudo
            <br />
            na cabeça.
          </h2>
          <p>
            Uma conta para pagar. Um valor para receber. Um objetivo que merece sair do papel. O
            MoneyHub ajuda a colocar tudo em perspectiva.
          </p>
          <SiteLink href="/informacoes" className="mh-text-link">
            Veja como funciona
            <ArrowIcon />
          </SiteLink>
        </div>
        <div className="mh-feature-rows">
          <article>
            <span className="mh-feature-icon" aria-hidden={true}>
              <ArrowDownLeft size={25} />
            </span>
            <div>
              <h3>Entenda seu movimento</h3>
              <p>
                Registre entradas e saídas, organize categorias e acompanhe o fluxo do seu dinheiro.
              </p>
            </div>
          </article>
          <article>
            <span className="mh-feature-icon mh-feature-violet" aria-hidden={true}>
              <CalendarDays size={25} />
            </span>
            <div>
              <h3>Antecipe o que vem pela frente</h3>
              <p>
                Contas a pagar e receber, recorrências e agenda para acompanhar seus compromissos.
              </p>
            </div>
          </article>
          <article>
            <span className="mh-feature-icon mh-feature-teal" aria-hidden={true}>
              <Flag size={25} />
            </span>
            <div>
              <h3>Dê um destino aos seus planos</h3>
              <p>Defina metas, acompanhe aportes e veja como seus objetivos estão evoluindo.</p>
            </div>
          </article>
        </div>
      </section>
      <section className="mh-start-section">
        <div className="mh-container">
          <div className="mh-section-heading">
            <div>
              <p className="mh-kicker">Comece do seu jeito</p>
              <h2>
                Uma pequena rotina.
                <br />
                Uma visão muito maior.
              </h2>
            </div>
            <p>
              Não é preciso organizar a vida inteira de uma vez.
              <br />
              Comece pelo que faz parte do seu dia.
            </p>
          </div>
          <ol className="mh-steps">
            <li>
              <span>1</span>
              <h3>Crie seu espaço</h3>
              <p>Cadastre-se, confirme seu email e personalize seu perfil.</p>
            </li>
            <li>
              <span>2</span>
              <h3>Conecte as informações</h3>
              <p>Registre contas, receitas e despesas. Cada registro ajuda a completar a visão.</p>
            </li>
            <li>
              <span>3</span>
              <h3>Escolha o próximo passo</h3>
              <p>Acompanhe seus compromissos e construa metas para o que vem depois.</p>
            </li>
          </ol>
        </div>
      </section>
      <section className="mh-plans-section mh-container">
        <div className="mh-section-heading">
          <div>
            <p className="mh-kicker">Espaço para cada momento</p>
            <h2>
              Comece pequeno.
              <br />
              Planeje ir além.
            </h2>
          </div>
          <SiteLink href="/planos" className="mh-text-link">
            Conhecer os planos
            <ArrowIcon />
          </SiteLink>
        </div>
        <Plans preview />
        <p className="mh-disclaimer">
          Propostas iniciais com preços mensais. Benefícios ilustrativos; planos pagos sujeitos à
          definição, sem contratação automática.
        </p>
      </section>
      <ClosingInvitation />
    </>
  );
}

const resources = [
  {
    icon: WalletCards,
    title: 'O que entra e o que sai',
    text: 'Receitas, despesas, categorias e contas reunidas para acompanhar seu movimento financeiro.'
  },
  {
    icon: CalendarDays,
    title: 'Seus compromissos à vista',
    text: 'Contas a pagar e receber, recorrências e agenda para organizar o que acontece ao longo do mês.'
  },
  {
    icon: Flag,
    title: 'Objetivos com acompanhamento',
    text: 'Metas financeiras e registro de aportes para acompanhar a evolução do que você quer conquistar.'
  },
  {
    icon: ChartNoAxesCombined,
    title: 'Uma visão com mais contexto',
    text: 'Dashboard, fluxo de caixa e comparações de períodos para compreender suas informações.'
  },
  {
    icon: Sparkles,
    title: 'Uma ajuda para entender',
    text: 'Assistente IA para consultar informações do aplicativo e apoiar sua leitura dos dados. Confira sempre as respostas.'
  },
  {
    icon: ShieldCheck,
    title: 'Um espaço com acesso pessoal',
    text: 'Acesso por conta e senha, confirmação de email e recuperação de acesso. Consulte como seus dados são utilizados.'
  }
] as const;

function InformationPage() {
  return (
    <>
      <section className="mh-page-intro mh-container">
        <p className="mh-kicker">Conheça o MoneyHub</p>
        <h1>
          Organizar o dinheiro
          <br />é abrir possibilidades.
        </h1>
        <p>
          Um lugar para acompanhar suas finanças pessoais ou as de um pequeno negócio. Com
          informação organizada, o próximo passo fica mais claro.
        </p>
      </section>
      <section className="mh-about-statement mh-container">
        <div className="mh-about-symbol" aria-hidden={true}>
          <span />
          <span />
          <span />
          <WalletCards size={52} />
        </div>
        <div>
          <h2>
            Finanças fazem parte da vida.
            <br />
            Não precisam ocupar a vida toda.
          </h2>
          <p>
            O MoneyHub nasceu da proposta de reunir o cotidiano financeiro em uma visão
            compreensível: o que você recebe, os compromissos que assume e os planos que quer
            construir.
          </p>
          <p>
            Você registra suas informações e acompanha o que elas mostram. O controle continua nas
            suas mãos.
          </p>
        </div>
      </section>
      <section className="mh-resources mh-container" aria-labelledby="resources-title">
        <h2 id="resources-title">O que você encontra por aqui</h2>
        <div className="mh-resource-grid">
          {resources.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <span className="mh-resource-icon" aria-hidden={true}>
                <Icon size={25} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <Faq />
      <ClosingInvitation />
    </>
  );
}

function PlansPage() {
  return (
    <>
      <section className="mh-page-intro mh-container mh-intro-centered">
        <p className="mh-kicker">Planos para o seu momento</p>
        <h1>Uma direção para cada fase.</h1>
        <p>
          Comece a organizar. Conheça as propostas para ir além.
          <br />
          Preços em reais, por mês, com licenças informadas em cada plano.
        </p>
      </section>
      <section className="mh-container mh-full-plans" aria-label="Planos mensais">
        <Plans />
        <div className="mh-plan-notice">
          <span aria-hidden={true}>
            <ShieldCheck size={23} />
          </span>
          <div>
            <h2>Transparência antes de qualquer escolha</h2>
            <p>
              Os benefícios são ilustrativos e ainda serão definidos. Plus e Ultra são propostas de
              planos, sem cobrança ou ativação por este site. Consultar um plano apenas abre os
              canais de contato. Os planos não alteram os recursos disponíveis na sua conta nesta
              etapa.
            </p>
          </div>
        </div>
      </section>
      <section className="mh-container mh-plan-comparison" aria-labelledby="comparison-title">
        <h2 id="comparison-title">Os números, lado a lado.</h2>
        <div className="mh-table-scroll">
          <table>
            <caption>Comparação das propostas mensais do MoneyHub</caption>
            <thead>
              <tr>
                <th scope="col">Proposta</th>
                {publicPlans.map((plan) => (
                  <th scope="col" key={plan.id}>
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Valor mensal</th>
                {publicPlans.map((plan) => (
                  <td key={plan.id}>{formatBRL(plan.monthlyPrice)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Licenças</th>
                {publicPlans.map((plan) => (
                  <td key={plan.id}>{plan.licenses}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Como começar</th>
                <td>Cadastro gratuito</td>
                <td>Consultar condições</td>
                <td>Consultar condições</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <Faq />
    </>
  );
}

function ContactPage() {
  const { plano } = useLocalSearchParams<{ plano?: string | string[] }>();
  const links = contactLinks(plano);
  return (
    <>
      <section className="mh-contact-section mh-container">
        <div className="mh-contact-copy">
          <p className="mh-kicker">Uma conversa pode ser o começo</p>
          <h1>
            Vamos encontrar
            <br />o próximo passo?
          </h1>
          <p>
            Uma dúvida, uma ideia ou vontade de conhecer melhor o MoneyHub. Escolha o canal que
            funciona para você.
          </p>
          {links.plan && (
            <div className="mh-contact-plan">
              <span>Você quer conhecer o</span>
              <h2>Plano {links.plan.name}</h2>
              <p>
                {formatBRL(links.plan.monthlyPrice)}/mês · {links.plan.licenses}{' '}
                {links.plan.licenses === 1 ? 'licença' : 'licenças'}
              </p>
              <SiteLink href="/contato" className="mh-text-link">
                Conversar sobre outro assunto
              </SiteLink>
            </div>
          )}
          <p className="mh-contact-footnote">
            Dúvidas de uso, sugestões, planos ou solicitações sobre seus dados: a conversa começa
            por aqui.
          </p>
        </div>
        <div className="mh-contact-options">
          <a className="mh-contact-option" href={links.email}>
            <span className="mh-contact-icon" aria-hidden={true}>
              <Mail size={28} />
            </span>
            <span>
              <strong>Escreva para a gente</strong>
              <span>{publicContact.email}</span>
              <small>Abrir no seu aplicativo de email</small>
            </span>
            <ArrowIcon />
          </a>
          <a
            className="mh-contact-option"
            href={links.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="mh-contact-icon" aria-hidden={true}>
              <MessageCircle size={28} />
            </span>
            <span>
              <strong>Converse pelo WhatsApp</strong>
              <span>{publicContact.phone}</span>
              <small>Abrir conversa em uma nova aba</small>
            </span>
            <ArrowIcon />
          </a>
          <div className="mh-contact-help">
            <h2>Antes de continuar</h2>
            <p>
              Os links abrem serviços externos. A mensagem fica pronta para você revisar e enviar;
              nada é enviado automaticamente. Evite compartilhar senhas ou informações financeiras
              sensíveis no contato.
            </p>
            <SiteLink href="/informacoes" className="mh-text-link">
              Consultar dúvidas frequentes
              <ArrowIcon />
            </SiteLink>
          </div>
        </div>
      </section>
      <section className="mh-contact-bottom mh-container">
        <h2>
          Informação aberta.
          <br />
          Relação mais clara.
        </h2>
        <div>
          <p>Veja como o MoneyHub funciona e como as informações são utilizadas.</p>
          <SiteLink href="/privacidade" className="mh-text-link">
            Privacidade e dados
            <ArrowIcon />
          </SiteLink>
        </div>
      </section>
    </>
  );
}

function LegalPage({ privacy }: { privacy: boolean }) {
  return (
    <div className="mh-container mh-legal-layout">
      <aside>
        <span className="mh-kicker">Transparência</span>
        <nav aria-label="Documentos institucionais">
          <SiteLink href="/privacidade" current={privacy}>
            Privacidade e dados
          </SiteLink>
          <SiteLink href="/termos" current={!privacy}>
            Termos de uso
          </SiteLink>
          <SiteLink href="/contato">
            Canal de contato
            <ArrowIcon />
          </SiteLink>
        </nav>
      </aside>
      <article className="mh-legal">
        <h1>{privacy ? 'Seus dados merecem clareza.' : 'Uma relação começa com clareza.'}</h1>
        <p className="mh-legal-lead">
          {privacy
            ? 'Informações iniciais sobre privacidade e uso de dados no MoneyHub.'
            : 'Condições iniciais de uso do MoneyHub e das propostas apresentadas neste site.'}
        </p>
        <div className="mh-legal-pending">
          <strong>Documento inicial, em revisão</strong>
          <p>
            Nome jurídico do responsável, CPF/CNPJ e endereço comercial ainda estão pendentes de
            definição. As condições definitivas e os detalhes operacionais também precisam ser
            formalizados antes da oferta comercial. Este documento não representa certificação de
            conformidade.
          </p>
        </div>
        {privacy ? (
          <>
            <section>
              <h2>Quais informações são utilizadas</h2>
              <p>
                O cadastro utiliza email e credenciais de autenticação. O perfil pode incluir nome,
                moeda e preferência visual. Ao usar o aplicativo, você informa dados financeiros
                como contas, receitas, despesas, categorias, metas e compromissos.
              </p>
              <p>
                Essas informações permitem identificar sua conta, organizar seus registros e
                apresentar os recursos que você solicita. Não é necessário informar dados
                financeiros para explorar esta apresentação.
              </p>
            </section>
            <section>
              <h2>Serviços envolvidos</h2>
              <p>
                O MoneyHub utiliza Firebase para autenticação e um backend com banco de dados para
                os registros financeiros. O aplicativo possui recursos de análise de uso com
                Firebase Analytics. Ao acionar o assistente IA, perguntas e informações necessárias
                à resposta podem ser processadas pelo provedor configurado para esse recurso.
              </p>
              <p>
                A identificação definitiva dos fornecedores, as bases legais aplicáveis, eventuais
                transferências internacionais e os prazos de retenção ainda precisam ser
                formalizados pelo responsável.
              </p>
            </section>
            <section id="tecnologias">
              <h2>Cookies e tecnologias de armazenamento</h2>
              <p>
                O aplicativo utiliza armazenamento local para manter a sessão e a preferência de
                tema. As páginas de apresentação não acrescentam rastreadores nem enviam novos
                eventos de análise.
              </p>
              <p>
                O aplicativo também possui instrumentação de análise de uso. A classificação final
                das tecnologias, os prazos e os mecanismos de escolha para usos opcionais precisam
                ser definidos antes da sua ampliação. Esta apresentação não solicita consentimento
                para tecnologias que não adiciona.
              </p>
            </section>
            <section>
              <h2>Seus direitos e solicitações</h2>
              <p>
                Você pode entrar em contato para solicitar informações sobre o tratamento dos seus
                dados e exercer os direitos previstos na LGPD, como acesso, correção e eliminação
                quando aplicável. O atendimento pode exigir confirmação de identidade para proteger
                suas informações.
              </p>
              <p>
                Envie sua solicitação para{' '}
                <a href={`mailto:${publicContact.email}?subject=Privacidade%20MoneyHub`}>
                  {publicContact.email}
                </a>
                . Procedimentos e prazos operacionais ainda serão formalizados; o site não oferece
                exclusão automática da conta.
              </p>
            </section>
            <section>
              <h2>Links externos e atualizações</h2>
              <p>
                Ao abrir o WhatsApp ou seu serviço de email, você passa a utilizar plataformas com
                políticas próprias. Consulte os documentos desses serviços. Este aviso deve ser
                atualizado quando fornecedores, finalidades ou condições de operação forem definidos
                ou alterados.
              </p>
            </section>
          </>
        ) : (
          <>
            <section>
              <h2>Proposta do serviço</h2>
              <p>
                O MoneyHub é uma ferramenta de organização financeira pessoal e de pequenos
                negócios. Você pode registrar e acompanhar informações de receitas, despesas,
                contas, metas e compromissos. Os exemplos da apresentação são fictícios e não
                representam seus dados ou resultados garantidos.
              </p>
            </section>
            <section>
              <h2>Conta e responsabilidade de uso</h2>
              <p>
                Mantenha suas credenciais protegidas e forneça informações que você tenha
                autorização para utilizar. Não use o serviço para atividades ilícitas, tentativas de
                acesso a dados de terceiros ou ações que prejudiquem seu funcionamento.
              </p>
              <p>
                Você é responsável por conferir a exatidão dos registros e pelas decisões tomadas a
                partir deles.
              </p>
            </section>
            <section>
              <h2>Planos e condições comerciais</h2>
              <p>
                As propostas apresentadas são: Gratuito, R$ 0 por mês e 1 licença; Plus, R$ 14,99
                por mês e 1 licença; Ultra, R$ 99,99 por mês e 10 licenças. Os benefícios são
                ilustrativos e as condições ainda serão definidas.
              </p>
              <p>
                Os botões dos planos pagos apenas direcionam ao contato, sem contratar, cobrar ou
                liberar licenças. Condições de pagamento, renovação, cancelamento, reembolso e
                exercício dos direitos do consumidor deverão ser informadas antes de qualquer
                contratação futura.
              </p>
            </section>
            <section>
              <h2>Assistente IA e limites</h2>
              <p>
                As respostas do assistente podem conter erros ou omissões. Confira os dados e
                procure orientação profissional quando necessário. O MoneyHub não promete
                rentabilidade, resultados financeiros ou substituição de aconselhamento financeiro,
                contábil ou jurídico.
              </p>
            </section>
            <section>
              <h2>Disponibilidade e alterações</h2>
              <p>
                O serviço e suas funcionalidades podem passar por manutenção ou alterações. Esta
                apresentação não estabelece garantia de disponibilidade ininterrupta nem prazo de
                atendimento. Mudanças nas condições devem ser comunicadas nos canais do produto
                quando aplicável.
              </p>
            </section>
            <section>
              <h2>Contato e privacidade</h2>
              <p>
                Para dúvidas ou solicitações, utilize{' '}
                <a href={`mailto:${publicContact.email}`}>{publicContact.email}</a> ou o WhatsApp{' '}
                {publicContact.phone}. Consulte também o{' '}
                <SiteLink href="/privacidade">aviso de privacidade e dados</SiteLink>.
              </p>
            </section>
          </>
        )}
      </article>
    </div>
  );
}

export default function PublicPage({ page }: PublicPageProps) {
  let content: ReactNode;
  switch (page) {
    case 'apresentacao':
      content = <PresentationPage />;
      break;
    case 'informacoes':
      content = <InformationPage />;
      break;
    case 'planos':
      content = <PlansPage />;
      break;
    case 'contato':
      content = <ContactPage />;
      break;
    case 'privacidade':
      content = <LegalPage privacy />;
      break;
    case 'termos':
      content = <LegalPage privacy={false} />;
      break;
  }
  return <PublicShell page={page}>{content}</PublicShell>;
}
