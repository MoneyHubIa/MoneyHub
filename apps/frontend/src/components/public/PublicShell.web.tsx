import { Link, type Href, useLocalSearchParams, usePathname } from 'expo-router';
import { ArrowUpRight, Menu, WalletCards, X } from 'lucide-react-native';
import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type PropsWithChildren,
  type ReactNode
} from 'react';
import Head from 'expo-router/head';
import { useAuth } from '@/providers/AuthProvider';
import { publicContact, publicMetadata, type PublicPageName } from './content';
import './public.css';

type SiteLinkProps = PropsWithChildren<{
  href: string;
  className?: string;
  current?: boolean;
  onClick?: () => void;
}>;

type RouterAnchorProps = ComponentPropsWithRef<'a'> & { onPress?: unknown };

function RouterAnchor(props: RouterAnchorProps) {
  // Expo Router supplies both handlers on Web; only onClick belongs on a DOM anchor.
  const anchorProps = { ...props };
  delete anchorProps.onPress;
  return <a {...anchorProps} />;
}

export function SiteLink({ href, children, className, current, onClick }: SiteLinkProps) {
  return (
    <Link href={href as Href} asChild>
      <RouterAnchor className={className} aria-current={current ? 'page' : undefined} onClick={onClick}>
        {children}
      </RouterAnchor>
    </Link>
  );
}

export function ArrowIcon() {
  return (
    <span className="mh-icon" aria-hidden="true">
      <ArrowUpRight size={18} />
    </span>
  );
}

export function Brand() {
  return (
    <>
      <span className="mh-brand-mark" aria-hidden="true">
        <WalletCards size={23} />
      </span>
      <span>
        moneyhub<span className="mh-brand-dot">.</span>
      </span>
    </>
  );
}

const navigation = [
  { href: '/apresentacao', label: 'Apresentação' },
  { href: '/informacoes', label: 'Como funciona' },
  { href: '/planos', label: 'Planos' },
  { href: '/contato', label: 'Contato' }
] as const;

export function PublicShell({ page, children }: { page: PublicPageName; children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const { '#': fragment } = useLocalSearchParams<{ '#': string }>();
  const site = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const metadata = publicMetadata[page];

  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = 'pt-BR';
    return () => {
      document.documentElement.lang = previous;
    };
  }, []);

  useEffect(() => {
    function scrollToFragment() {
      let id: string;
      try {
        id = decodeURIComponent(fragment ?? window.location.hash.slice(1));
      } catch {
        return;
      }
      if (!id) return;
      const target = Array.from(site.current?.querySelectorAll<HTMLElement>('[id]') ?? []).find(
        (element) => element.id === id
      );
      target?.scrollIntoView({ block: 'start' });
    }
    const frame = requestAnimationFrame(scrollToFragment);
    window.addEventListener('hashchange', scrollToFragment);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', scrollToFragment);
    };
  }, [fragment]);

  function closeMenu() {
    setMenuOpen(false);
    menuButton.current?.focus();
  }

  return (
    <div className="mh-public" ref={site}>
      <Head>
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
        <meta property="og:title" content={metadata.title} />
        <meta property="og:description" content={metadata.description} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="pt_BR" />
        <meta name="twitter:card" content="summary" />
        <meta name="theme-color" content="#073B42" />
      </Head>
      <a className="mh-skip" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="mh-header">
        <div className="mh-container mh-header-inner">
          <SiteLink href="/apresentacao" className="mh-brand">
            <Brand />
          </SiteLink>
          <nav className="mh-desktop-nav" aria-label="Navegação principal">
            {navigation.map((item) => (
              <SiteLink
                key={item.href}
                href={item.href}
                current={
                  pathname === item.href || (item.href === '/apresentacao' && pathname === '/')
                }
              >
                {item.label}
              </SiteLink>
            ))}
          </nav>
          <div className="mh-header-actions">
            <SiteLink href={user ? '/(app)' : '/login'} className="mh-login">
              {user ? 'Meu painel' : 'Entrar'}
              <ArrowIcon />
            </SiteLink>
            <SiteLink
              href={user ? '/(app)' : '/register'}
              className="mh-button mh-button-small mh-header-start"
            >
              {user ? 'Acessar MoneyHub' : 'Começar agora'}
            </SiteLink>
            <button
              className="mh-menu-toggle"
              ref={menuButton}
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menuOpen}
              aria-controls="mh-mobile-menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span aria-hidden="true">{menuOpen ? <X size={24} /> : <Menu size={24} />}</span>
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav
            id="mh-mobile-menu"
            className="mh-mobile-nav"
            aria-label="Navegação móvel"
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeMenu();
            }}
          >
            {navigation.map((item) => (
              <SiteLink
                key={item.href}
                href={item.href}
                current={
                  pathname === item.href || (item.href === '/apresentacao' && pathname === '/')
                }
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </SiteLink>
            ))}
            <SiteLink href={user ? '/(app)' : '/register'} onClick={() => setMenuOpen(false)}>
              {user ? 'Acessar meu painel' : 'Criar minha conta'}
            </SiteLink>
          </nav>
        )}
      </header>
      <main id="conteudo" tabIndex={-1}>
        {children}
      </main>
      <footer className="mh-footer">
        <div className="mh-container mh-footer-top">
          <div className="mh-footer-about">
            <SiteLink href="/apresentacao" className="mh-brand">
              <Brand />
            </SiteLink>
            <p>
              Seu dinheiro faz parte da sua vida.
              <br />
              Dê uma direção para ele.
            </p>
          </div>
          <nav aria-label="Conheça o MoneyHub">
            <h2>Conheça</h2>
            {navigation.map((item) => (
              <SiteLink key={item.href} href={item.href}>
                {item.label}
              </SiteLink>
            ))}
          </nav>
          <nav aria-label="Informações institucionais">
            <h2>Transparência</h2>
            <SiteLink href="/privacidade">Privacidade e dados</SiteLink>
            <SiteLink href="/termos">Termos de uso</SiteLink>
            <SiteLink href="/privacidade#tecnologias">Cookies e tecnologias</SiteLink>
          </nav>
          <div className="mh-footer-contact">
            <h2>Vamos conversar?</h2>
            <a href={`mailto:${publicContact.email}`}>{publicContact.email}</a>
            <a
              href={`https://wa.me/${publicContact.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp {publicContact.phone}
              <ArrowIcon />
            </a>
          </div>
        </div>
        <div className="mh-container mh-footer-bottom">
          <span>© {new Date().getFullYear()} MoneyHub</span>
          <span>Feito para trazer clareza ao próximo passo.</span>
          <span>Brasil · Português</span>
        </div>
      </footer>
    </div>
  );
}
