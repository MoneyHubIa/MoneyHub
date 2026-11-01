import { render, screen } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';
import PublicPage from '../src/components/public/PublicPage';

let mockSession: { loading: boolean; user: { uid: string } | null };
jest.mock('@/providers/AuthProvider', () => ({ useAuth: () => mockSession }));
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => <MockText>{href}</MockText>
}));

test('native institutional deep links preserve loading, login and authenticated entry', async () => {
  mockSession = { loading: true, user: null };
  const view = await render(<PublicPage page="planos" />);
  expect(screen.getByLabelText('Carregando sessao')).toBeOnTheScreen();
  mockSession = { loading: false, user: null };
  await view.rerender(<PublicPage page="planos" />);
  expect(screen.getByText('/(auth)/login')).toBeOnTheScreen();
  mockSession = { loading: false, user: { uid: 'user-1' } };
  await view.rerender(<PublicPage page="planos" />);
  expect(screen.getByText('/(app)')).toBeOnTheScreen();
});
