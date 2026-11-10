/** @jest-environment jsdom */
import { act, type ReactNode } from 'react';
import { AiAssistant } from '../src/components/AiAssistant';

const { createRoot } = jest.requireActual<{
  createRoot(container: HTMLElement): { render(node: ReactNode): void; unmount(): void };
}>('react-dom/client');

jest.mock('react-native', () => jest.requireActual('react-native-web'));
// Use the real SVG web renderer instead of the native test renderer.
jest.mock('react-native-svg', () => jest.requireActual('react-native-svg/lib/commonjs/elements.web'));
jest.mock('@apollo/client', () => ({ gql: (strings: TemplateStringsArray) => strings.join('') }));
jest.mock('@apollo/client/react', () => ({ useApolloClient: () => ({}), useMutation: () => [jest.fn(), { loading: false, error: null }] }));
jest.mock('../src/hooks/useVoiceInput', () => ({
  ASSISTANT_MESSAGE_MAX_LENGTH: 2000,
  VOICE_UNAVAILABLE_MESSAGE: 'Entrada por voz indisponível.',
  useVoiceInput: () => ({
    available: true, status: mockVoiceStatus, isBusy: mockVoiceStatus !== 'idle',
    message: null, start: jest.fn(), stop: jest.fn(), cancel: jest.fn()
  })
}));

// This DOM-only test does not use Expo's lazy native fetch polyfill.
Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: jest.fn() });

let mockVoiceStatus = 'idle';
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});

test.each(['idle', 'listening', 'preparing', 'stopping'])('voice icon renders on web without invalid DOM props (%s)', async (status) => {
  mockVoiceStatus = status;
  const errors = jest.spyOn(console, 'error');
  await act(async () => root.render(<AiAssistant isOpen />));
  const label = status === 'listening' ? 'Parar entrada por voz' : 'Iniciar entrada por voz';
  const button = container.querySelector(`[aria-label="${label}"]`);
  expect(button).not.toBeNull();
  expect(button?.querySelector('svg')).not.toBeNull();
  if (status === 'idle' || status === 'listening') {
    expect(button?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  }
  expect(errors).not.toHaveBeenCalled();
});
