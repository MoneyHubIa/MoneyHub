/** @jest-environment jsdom */
import { act, type ReactElement, type ReactNode } from 'react';
import PublicPage from '../src/components/public/PublicPage.web';
import type { PublicPageName } from '../src/components/public/content';

const { createRoot } = jest.requireActual<{
  createRoot(container: HTMLElement): { render(node: ReactNode): void; unmount(): void };
}>('react-dom/client');

let mockUser: { uid: string } | null = null;
let mockPathname = '/apresentacao';
let mockParams: Record<string, string | string[] | undefined> = {};
const mockScrollIntoView = jest.fn();

jest.mock('../src/components/public/public.css', () => ({}));
jest.mock('@/providers/AuthProvider', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('expo-router/head', () => ({ __esModule: true, default: () => null }));
jest.mock('expo-router', () => ({
  Link: ({ href, children }: { href: string; children: ReactElement<{ onClick?: () => void }> }) =>
    jest.requireActual('react').cloneElement(children, {
      href,
      onPress: () => undefined,
      onClick: (event: { preventDefault(): void }) => {
        event.preventDefault();
        children.props.onClick?.();
      }
    }),
  usePathname: () => mockPathname,
  useLocalSearchParams: () => mockParams
}));
jest.mock('lucide-react-native', () => {
  const Icon = () => <svg aria-hidden="true" />;
  return Object.fromEntries(
    [
      'ArrowUpRight',
      'Menu',
      'WalletCards',
      'X',
      'ArrowDownLeft',
      'Flag',
      'CalendarDays',
      'ChartNoAxesCombined',
      'Check',
      'Mail',
      'MessageCircle',
      'ShieldCheck',
      'Sparkles'
    ].map((name) => [name, Icon])
  );
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockUser = null;
  mockPathname = '/apresentacao';
  mockParams = {};
  mockScrollIntoView.mockClear();
  HTMLElement.prototype.scrollIntoView = mockScrollIntoView;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  window.history.replaceState({}, '', '/');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});

async function renderPage(page: PublicPageName) {
  mockPathname = `/${page}`;
  await act(async () => root.render(<PublicPage page={page} />));
}

function button(text: string) {
  const element = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === text
  );
  if (!element) throw new Error(`Button not found: ${text}`);
  return element;
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

test('router native press handlers do not leak to DOM anchors', async () => {
  const errors = jest.spyOn(console, 'error');
  await renderPage('apresentacao');
  expect(container.querySelector('.mh-desktop-nav a[aria-current="page"]')?.getAttribute('href'))
    .toBe('/apresentacao');
  await click(container.querySelector('[aria-label="Abrir menu"]')!);
  await click(container.querySelector('#mh-mobile-menu a')!);
  expect(container.querySelector('#mh-mobile-menu')).toBeNull();
  expect(errors).not.toHaveBeenCalled();
});

test('financial demonstration explains each destination and switches personal/business examples', async () => {
  await renderPage('apresentacao');
  expect(container.querySelector('.mh-map-available')?.textContent).toContain('1.800,00');
  for (const [selector, explanation] of [
    ['.mh-map-income', 'Salário e renda extra'],
    ['.mh-map-commitments', 'Moradia, alimentação'],
    ['.mh-map-goals', 'Um valor separado para a viagem'],
    ['.mh-map-available', 'O que resta depois dos compromissos']
  ]) {
    await click(container.querySelector(selector!)!);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(explanation);
  }
  await click(button('Negócio'));
  expect(container.querySelector('.mh-map-available')?.textContent).toContain('4.500,00');
  expect(button('Negócio').getAttribute('aria-pressed')).toBe('true');
  await click(button('Pessoal'));
  expect(container.querySelector('.mh-map-available')?.textContent).toContain('1.800,00');
});

test('institutional content stays public while account actions adapt to an authenticated visitor', async () => {
  for (const page of [
    'apresentacao',
    'informacoes',
    'planos',
    'contato',
    'privacidade',
    'termos'
  ] as const) {
    await renderPage(page);
    expect(container.querySelector('main h1')?.textContent).toBeTruthy();
    expect(container.querySelector('.mh-login')?.textContent).toContain('Entrar');
  }
  mockUser = { uid: 'existing-user' };
  await renderPage('apresentacao');
  expect(container.querySelector('.mh-login')?.getAttribute('href')).toBe('/(app)');
  expect(container.querySelector('.mh-hero-actions .mh-button')?.textContent).toContain(
    'Acessar meu painel'
  );
  await renderPage('planos');
  expect(container.querySelector('.mh-plan-gratuito a')?.getAttribute('href')).toBe('/(app)');
  expect(container.querySelector('.mh-plan-ultra a')?.getAttribute('href')).toBe(
    '/contato?plano=ultra'
  );
});

test('mobile menu exposes expanded state, closes on Escape and returns focus to its trigger', async () => {
  await renderPage('informacoes');
  const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Abrir menu"]')!;
  await click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  const nav = container.querySelector('#mh-mobile-menu')!;
  await act(async () =>
    nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  );
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger);
  await click(trigger);
  await click(container.querySelector('#mh-mobile-menu a')!);
  expect(container.querySelector('#mh-mobile-menu')).toBeNull();
  await click(trigger);
  await click(container.querySelector('#mh-mobile-menu a:last-child')!);
  expect(container.querySelector('#mh-mobile-menu')).toBeNull();
});

test('contact identifies a selected plan and ignores invalid or repeated plan parameters', async () => {
  mockParams = { plano: 'plus' };
  await renderPage('contato');
  expect(container.querySelector('.mh-contact-plan h2')?.textContent).toBe('Plano Plus');
  mockParams = { plano: 'ultra' };
  await renderPage('contato');
  expect(container.querySelector('.mh-contact-plan')?.textContent).toContain('10 licenças');
  for (const plano of ['unknown', ['plus', 'ultra']]) {
    mockParams = { plano };
    await renderPage('contato');
    expect(container.querySelector('.mh-contact-plan')).toBeNull();
  }
});

test('privacy fragments locate their section after mount, including browser hash navigation', async () => {
  mockParams = { '#': 'tecnologias' };
  await renderPage('privacidade');
  expect(mockScrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  expect(mockScrollIntoView.mock.instances[0]?.id).toBe('tecnologias');
  mockParams = {};
  window.history.replaceState({}, '', '/privacidade#tecnologias');
  await renderPage('privacidade');
  await act(async () => window.dispatchEvent(new HashChangeEvent('hashchange')));
  expect(mockScrollIntoView.mock.instances.at(-1)?.id).toBe('tecnologias');
  window.history.replaceState({}, '', '/privacidade#%E0%A4%A');
  await act(async () => window.dispatchEvent(new HashChangeEvent('hashchange')));
  expect(container.querySelector('main h1')).not.toBeNull();
});
