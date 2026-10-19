import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { print } from 'graphql';
import { DashboardShell } from '../src/components/DashboardShell';
import { AuthProvider } from '../src/providers/AuthProvider';
import type { AuthService } from '../src/services/authService';

const mockSyncAgendaNotifications = jest.fn().mockResolvedValue({ data: {} });
const mockDashboardQuery = jest.fn();
let mockAccountsData: Record<string, unknown> = {};

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

import { ThemeProvider } from '../src/theme/ThemeContext';

function Wrapper({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <AuthProvider service={mockService}>{children}</AuthProvider>
    </ThemeProvider>
  );
}

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() })
}));

jest.mock('@apollo/client/react', () => ({
  useApolloClient: () => ({
    clearStore: jest.fn()
  }),
  useQuery: (document: unknown) => {
    mockDashboardQuery(document);
    return ({
    data: {
      ...mockAccountsData,
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
    });
  },
  useMutation: () => [mockSyncAgendaNotifications, { loading: false }]
}));

describe('MoneyHub dashboard shell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccountsData = {};
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-18T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders the product and financial summary', async () => {
    await render(<DashboardShell />, { wrapper: Wrapper });

    expect(screen.getByText('MoneyHub')).toBeOnTheScreen();
    expect(screen.getByLabelText('Metas no dashboard')).toHaveTextContent('R$ 250,00', { exact: false });
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
    await fireEvent.press(screen.getByRole('button', { name: /Agenda/i }));

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

  test('includes pending and overdue accounts in projections and upcoming obligations', async () => {
    const account = (id: string, amount: string, status: string, dueDate: string) => ({ id, description: id, amount, status, dueDate });
    mockAccountsData = {
      myAccountsPayable: [account('Pagamento pendente', '100', 'PENDING', '2026-08-20')],
      overdueAccountsPayable: [account('Pagamento vencido', '200', 'OVERDUE', '2026-08-10')],
      myAccountsReceivable: [account('Recebimento pendente', '400', 'PENDING', '2026-08-20')],
      overdueAccountsReceivable: [account('Recebimento vencido', '50', 'OVERDUE', '2026-08-11')]
    };
    await render(<DashboardShell />, { wrapper: Wrapper });
    expect(screen.getByText('Saldo Projetado: R$ 3.350,00')).toBeOnTheScreen();
    expect(screen.getByText(/R\$ 300,00 a pagar/)).toBeOnTheScreen();
    expect(screen.getByText(/R\$ 450,00 a receber/)).toBeOnTheScreen();
    for (const description of ['Pagamento pendente', 'Pagamento vencido', 'Recebimento pendente', 'Recebimento vencido']) {
      expect(screen.getByText(description)).toBeOnTheScreen();
    }
    expect(screen.getByText(/1 vencida/)).toBeOnTheScreen();
    expect(screen.queryByText('Nenhuma conta pendente. Tudo em dia!')).toBeNull();
    const query = print(mockDashboardQuery.mock.calls[0]![0]);
    expect(query).toContain('overdueAccountsPayable: myAccountsPayable(status: OVERDUE)');
    expect(query).toContain('overdueAccountsReceivable: myAccountsReceivable(status: OVERDUE)');
  });

  test('does not show all clear when only overdue accounts exist', async () => {
    mockAccountsData = {
      overdueAccountsPayable: [{ id: 'overdue', description: 'Dívida vencida', amount: '200', dueDate: '2026-08-10', status: 'OVERDUE' }]
    };
    await render(<DashboardShell />, { wrapper: Wrapper });
    expect(screen.getByText('Dívida vencida')).toBeOnTheScreen();
    expect(screen.queryByText('Nenhuma conta pendente. Tudo em dia!')).toBeNull();
    expect(screen.getByText('Saldo Projetado: R$ 3.000,00')).toBeOnTheScreen();
  });
});


