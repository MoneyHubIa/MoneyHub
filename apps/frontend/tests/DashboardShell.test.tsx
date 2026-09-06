import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { DashboardShell } from '../src/components/DashboardShell';
import { AuthProvider } from '../src/providers/AuthProvider';
import type { AuthService } from '../src/services/authService';

const mockSyncAgendaNotifications = jest.fn().mockResolvedValue({ data: {} });

const mockService: AuthService = {
  register: jest.fn(),
  resendEmailVerification: jest.fn(),
  refreshEmailVerification: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  getIdToken: jest.fn(),
  observeSession: (callback) => {
    callback({
      uid: 'firebase-uid',
      email: 'person@example.com',
      emailVerified: false
    });
    return () => undefined;
  }
};

function Wrapper({ children }: PropsWithChildren) {
  return <AuthProvider service={mockService}>{children}</AuthProvider>;
}

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() })
}));

jest.mock('@apollo/client/react', () => ({
  useApolloClient: () => ({
    clearStore: jest.fn()
  }),
  useMutation: () => [jest.fn(), { loading: false }],
  useQuery: () => ({
    data: {
      dashboardSummary: {
        totalIncome: '5000.00',
        totalExpense: '1800.00',
        netBalance: '3200.00',
        incomeCount: 2,
        expenseCount: 4,
        month: 8,
        year: 2026
      },
      myProfile: {
        id: 'profile-1',
        preferredCurrency: 'BRL'
      }
    },
    loading: false,
    refetch: jest.fn()
  }),
  useMutation: () => [mockSyncAgendaNotifications, { loading: false }]
}));

describe('MoneyHub dashboard shell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-18T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders the product and financial summary', async () => {
    await render(<DashboardShell />, { wrapper: Wrapper });

    expect(screen.getByText('MoneyHub')).toBeOnTheScreen();
    expect(screen.getByText('Dashboard financeiro')).toBeOnTheScreen();
    expect(screen.getByText('Saldo previsto')).toBeOnTheScreen();
    expect(screen.getByText('R$ 3.200,00')).toBeOnTheScreen();
    expect(screen.getByText('Receitas do mes')).toBeOnTheScreen();
    expect(screen.getByText('R$ 5.000,00')).toBeOnTheScreen();
    expect(screen.getByText('Despesas do mes')).toBeOnTheScreen();
    expect(screen.getByText('R$ 1.800,00')).toBeOnTheScreen();
  });

  test('opens floating IA assistant when clicking Consultar IA', async () => {
    await render(<DashboardShell />, { wrapper: Wrapper });
    expect(
      screen.getByRole('button', { name: 'Abrir Assistente Financeiro IA' })
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Consultar IA' }));

    expect(
      screen.getByRole('header', { name: 'Assistente Financeiro IA' })
    ).toBeOnTheScreen();
  });

  test('changes the active section from the navigation', async () => {
    await render(<DashboardShell />, { wrapper: Wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Agenda' }));

    expect(screen.getByRole('header', { name: 'Agenda financeira' })).toBeOnTheScreen();
    expect(mockSyncAgendaNotifications).toHaveBeenCalledWith({
      variables: { today: '2026-08-18' }
    });
  });

  test('shows sync failure in notification center and retries with local today', async () => {
    mockSyncAgendaNotifications.mockRejectedValueOnce(new Error('Falha temporária'));
    await render(<DashboardShell />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(mockSyncAgendaNotifications).toHaveBeenCalledWith({
        variables: { today: '2026-08-18' }
      });
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Notificações' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Falha de sincronização da agenda')).toBeOnTheScreen();
      expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível sincronizar lembretes da agenda.');
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    await waitFor(() => {
      expect(mockSyncAgendaNotifications).toHaveBeenCalledTimes(2);
    });
    expect(mockSyncAgendaNotifications).toHaveBeenLastCalledWith({
      variables: { today: '2026-08-18' }
    });
  });

  test('renders a logout button', async () => {
    await render(<DashboardShell />, { wrapper: Wrapper });

    expect(screen.getByRole('button', { name: 'Sair' })).toBeOnTheScreen();
  });

  test('keeps the notification panel layer above side navigation and content', async () => {
    await render(<DashboardShell />, { wrapper: Wrapper });

    const brand = screen.getByText('MoneyHub');
    const brandRowStyle = StyleSheet.flatten(brand.parent?.parent?.props.style);
    const navigationStyle = StyleSheet.flatten(brand.parent?.parent?.parent?.props.style);

    expect(navigationStyle.zIndex).toBeGreaterThan(0);
    expect(brandRowStyle.zIndex).toBeGreaterThan(navigationStyle.zIndex);
  });
  test('renders notification center in dashboard navigation', async () => {
    await render(<DashboardShell />, { wrapper: Wrapper });

    expect(screen.getByRole('button', { name: 'Notificações' })).toBeOnTheScreen();
  });
});


