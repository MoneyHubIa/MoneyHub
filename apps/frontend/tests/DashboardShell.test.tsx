import { fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { DashboardShell } from '../src/components/DashboardShell';
import { AuthProvider } from '../src/providers/AuthProvider';
import type { AuthService } from '../src/services/authService';

const mockService: AuthService = {
  register: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  getIdToken: jest.fn(),
  observeSession: (callback) => {
    callback({ uid: 'firebase-uid', email: 'person@example.com' });
    return () => undefined;
  }
};

function Wrapper({ children }: PropsWithChildren) {
  return <AuthProvider service={mockService}>{children}</AuthProvider>;
}

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() })
}));

jest.mock('@apollo/client', () => ({
  useApolloClient: () => ({
    clearStore: jest.fn()
  })
}));

describe('MoneyHub dashboard shell', () => {
  test('renders the product and financial summary', async () => {
    await render(<DashboardShell />, { wrapper: Wrapper });

    expect(screen.getByText('MoneyHub')).toBeOnTheScreen();
    expect(screen.getByText('Dashboard financeiro')).toBeOnTheScreen();
    expect(screen.getByText('Saldo previsto')).toBeOnTheScreen();
    expect(screen.getAllByText('R$ 0,00')).toHaveLength(3);
  });

  test('changes the active section from the navigation', async () => {
    await render(<DashboardShell />, { wrapper: Wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Agenda' }));

    expect(screen.getByRole('header', { name: 'Agenda' })).toBeOnTheScreen();
    expect(screen.getByText('O conteudo de Agenda estara disponivel em breve.'))
      .toBeOnTheScreen();
  });

  test('renders a logout button', async () => {
    await render(<DashboardShell />, { wrapper: Wrapper });

    expect(screen.getByRole('button', { name: 'Sair' })).toBeOnTheScreen();
  });
});

