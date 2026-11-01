import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { print } from 'graphql';
import { DashboardShell } from '../src/components/DashboardShell';
import { AuthProvider } from '../src/providers/AuthProvider';
import type { AuthService } from '../src/services/authService';

const mockSyncAgendaNotifications = jest.fn().mockResolvedValue({ data: {} });
const mockDashboardQuery = jest.fn();
const mockClearStore = jest.fn();
const mockReplace = jest.fn();
const mockMarkPayablePaid = jest.fn();
const mockMarkReceivableReceived = jest.fn();
let mockAccountsData: Record<string, unknown> = {};
let mockSummaryUnavailable = false;
let mockSummaryLoading = false;

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
  useRouter: () => ({ replace: mockReplace })
}));

jest.mock('@apollo/client/react', () => ({
  useApolloClient: () => ({
    clearStore: mockClearStore
  }),
  useQuery: (document: unknown) => {
    mockDashboardQuery(document);
    return {
      data: mockSummaryUnavailable ? undefined : {
        myCategories: [],
        myCostCenters: [],
        financialGoalsSummary: { count: 1, totalAccumulated: '250.00', totalTarget: '1000.00' },
        myFinancialGoals: [{
          id: 'goal-1', name: 'Reserva real', description: null,
          targetAmount: '1000.00', accumulatedAmount: '250.00', remainingAmount: '750.00',
          progress: 25, status: 'ACTIVE', startDate: '2026-01-01', deadline: '2027-01-01'
        }],
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
        },
        ...mockAccountsData
      },
      loading: mockSummaryLoading,
      refetch: jest.fn()
    };
  },
  useMutation: (document: Parameters<typeof print>[0]) => {
    const { print: printDocument } = jest.requireActual<typeof import('graphql')>('graphql');
    const mutation = printDocument(document);
    const mutate = mutation.includes('MarkAccountPayablePaid')
      ? mockMarkPayablePaid
      : mutation.includes('MarkAccountReceivableReceived')
        ? mockMarkReceivableReceived
        : mockSyncAgendaNotifications;
    return [mutate, { loading: false }];
  }
}));

describe('MoneyHub dashboard shell', () => {
  test.each(['desktop', 'mobile'])('opens Transferência from quick actions without changing the dashboard (%s)', async source => {
    if (source === 'mobile') jest.mocked(Dimensions.get).mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
    await render(<DashboardShell />, { wrapper: Wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Novo lançamento rápido' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Criar Transferência' }));
    expect(screen.getByRole('header', { name: 'Transferência' })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Novo Lançamento Rápido' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('header', { name: 'Transferência' })).toBeNull();
    expect(screen.getByText('Dashboard financeiro')).toBeOnTheScreen();
  });

  test.each(['sidebar', 'menu', 'mobile'])('opens Despesa Cartão from %s without changing the dashboard', async source => {
    if (source === 'mobile') jest.mocked(Dimensions.get).mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
    await render(<DashboardShell />, { wrapper: Wrapper });
    if (source !== 'sidebar') {
      await fireEvent.press(screen.getByRole('button', { name: 'Novo lançamento rápido' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Criar Despesa Cartão' }));
    } else await fireEvent.press(screen.getByRole('button', { name: 'Despesa Cartão' }));
    expect(screen.getByRole('header', { name: 'Despesa Cartão' })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Novo Lançamento Rápido' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('header', { name: 'Despesa Cartão' })).toBeNull();
    expect(screen.getByText('Dashboard financeiro')).toBeOnTheScreen();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccountsData = {};
    mockSummaryUnavailable = false;
    mockSummaryLoading = false;
    mockClearStore.mockReset().mockResolvedValue(undefined);
    mockMarkPayablePaid.mockReset().mockResolvedValue({ data: {} });
    mockMarkReceivableReceived.mockReset().mockResolvedValue({ data: {} });
    jest.mocked(mockService.logout).mockReset().mockResolvedValue(undefined);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-18T12:00:00.000Z'));
    jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 1280, height: 800, scale: 1, fontScale: 1 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('renders the product and financial summary', async () => {
    await render(<DashboardShell />, { wrapper: Wrapper });

    expect(screen.getByText('MoneyHub')).toBeOnTheScreen();
    expect(screen.getByLabelText('Metas no dashboard')).toHaveTextContent('R$ 250,00', { exact: false });
    expect(screen.getByText('Dashboard financeiro')).toBeOnTheScreen();
    expect(screen.getByText('Resultado do período')).toBeOnTheScreen();
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

  test('shows persisted goals and opens the functional goals screen', async () => {
    await render(<DashboardShell />, { wrapper: Wrapper });

    expect(screen.getByText('Progresso das Metas')).toBeOnTheScreen();
    expect(screen.getByText('Reserva real')).toBeOnTheScreen();
    expect(screen.getByText('25%')).toBeOnTheScreen();
    expect(screen.queryByText('Preview')).toBeNull();
    const query = print(mockDashboardQuery.mock.calls.find(call => print(call[0]).includes('query DashboardSummary'))![0]);
    expect(query).toContain('financialGoalsSummary');
    expect(query).toContain('myFinancialGoals');

    await fireEvent.press(screen.getByRole('button', { name: 'Explorar' }));

    expect(screen.getByRole('header', { name: 'Metas financeiras' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Nova meta' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Nova meta' }));
    expect(screen.getByLabelText('Nome da meta')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Salvar meta' })).toBeOnTheScreen();
    expect(screen.queryByText('Dashboard financeiro')).toBeNull();
  });

  test('hides and restores summary and upcoming account values', async () => {
    mockAccountsData = {
      myAccountsPayable: [{ id: 'rent', description: 'Aluguel', amount: '700', dueDate: '2026-08-18', status: 'PENDING' }]
    };
    await render(<DashboardShell />, { wrapper: Wrapper });
    expect(screen.getByText('Hoje')).toBeOnTheScreen();
    expect(screen.getByText('1 conta')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Ocultar valores' }));

    expect(screen.queryByText('R$ 3.200,00')).toBeNull();
    expect(screen.queryByText('R$ 700,00')).toBeNull();
    expect(screen.getByLabelText('Metas no dashboard')).not.toHaveTextContent('R$ 250,00', { exact: false });
    expect(screen.getByLabelText('Metas no dashboard')).toHaveTextContent('R$ ••••••', { exact: false });
    expect(screen.getByText('Saldo Projetado: R$ ••••••')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Mostrar valores' }));
    expect(screen.getByText('R$ 3.200,00')).toBeOnTheScreen();
    expect(screen.getByText('R$ 700,00')).toBeOnTheScreen();
    expect(screen.getByLabelText('Metas no dashboard')).toHaveTextContent('R$ 250,00', { exact: false });
  });

  test('shows an empty goals state without demonstration data for a new account', async () => {
    mockAccountsData = {
      myFinancialGoals: [],
      financialGoalsSummary: { count: 0, totalAccumulated: '0.00', totalTarget: '0.00' }
    };
    await render(<DashboardShell />, { wrapper: Wrapper });

    expect(screen.getByText('Crie sua primeira meta financeira.')).toBeOnTheScreen();
    expect(screen.queryByText('Reserva real')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Explorar' }));
    expect(screen.getByText('Crie sua primeira meta financeira.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Nova meta' })).toBeOnTheScreen();
  });

  test.each([
    ['USD', '$ 3,200.00'],
    ['EUR', '€ 3.200,00'],
    ['GBP', 'R$ 3.200,00']
  ])('formats summary values for profile currency %s', async (currency, expected) => {
    mockAccountsData = { myProfile: { id: 'profile-1', preferredCurrency: currency } };
    await render(<DashboardShell />, { wrapper: Wrapper });

    expect(screen.getByText(expected)).toBeOnTheScreen();
  });

  test('shows zero balances when summary and profile are unavailable', async () => {
    mockSummaryUnavailable = true;
    await render(<DashboardShell />, { wrapper: Wrapper });

    expect(screen.getByText('Saldo Projetado: R$ 0,00')).toBeOnTheScreen();
    expect(screen.getByText(/0 entradas/)).toBeOnTheScreen();
    expect(screen.getByText(/0 saídas/)).toBeOnTheScreen();
    expect(screen.getByText('Nenhuma conta pendente. Tudo em dia!')).toBeOnTheScreen();
  });

  test('keeps cached summary visible while refreshing', async () => {
    mockSummaryLoading = true;
    await render(<DashboardShell />, { wrapper: Wrapper });

    expect(screen.getByText('R$ 3.200,00')).toBeOnTheScreen();
    expect(screen.getByText('R$ 5.000,00')).toBeOnTheScreen();
    expect(screen.getByText('R$ 1.800,00')).toBeOnTheScreen();
  });

  test('loads summary after initially missing data', async () => {
    mockSummaryUnavailable = true;
    mockSummaryLoading = true;
    const { rerender } = await render(<DashboardShell />, { wrapper: Wrapper });
    expect(screen.queryByText('R$ 3.200,00')).toBeNull();

    mockSummaryUnavailable = false;
    mockSummaryLoading = false;
    await rerender(<DashboardShell />);

    expect(screen.getByText('R$ 3.200,00')).toBeOnTheScreen();
  });

  test('clears cached data and signs out before returning to login', async () => {
    await render(<DashboardShell />, { wrapper: Wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/login'));
    expect(mockClearStore).toHaveBeenCalledTimes(1);
    expect(mockService.logout).toHaveBeenCalledTimes(1);
    expect(mockClearStore.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(mockService.logout).mock.invocationCallOrder[0]!);
    expect(jest.mocked(mockService.logout).mock.invocationCallOrder[0]).toBeLessThan(mockReplace.mock.invocationCallOrder[0]!);
  });

  test('allows retrying logout on mobile after a cache error', async () => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
    mockClearStore.mockRejectedValueOnce(new Error('Cache unavailable'));
    await render(<DashboardShell />, { wrapper: Wrapper });

    await fireEvent.press(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled());
    expect(mockService.logout).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/login'));
  });

  test('settles payable and receivable accounts with the current timestamp', async () => {
    mockAccountsData = {
      myAccountsPayable: [{ id: 'rent', description: 'Aluguel', amount: '700', dueDate: '2026-08-18', status: 'PENDING' }],
      myAccountsReceivable: [{ id: 'salary', description: 'Salário', amount: '2000', dueDate: '2026-08-28', status: 'PENDING' }]
    };
    let finishPayment!: (value: unknown) => void;
    mockMarkPayablePaid.mockReturnValueOnce(new Promise((resolve) => { finishPayment = resolve; }));
    await render(<DashboardShell />, { wrapper: Wrapper });

    await fireEvent.press(screen.getByRole('button', { name: 'Pagar Aluguel' }));
    expect(screen.getByRole('button', { name: 'Pagar Aluguel' })).toBeDisabled();
    expect(mockMarkPayablePaid).toHaveBeenCalledWith({ variables: { id: 'rent', paidAt: '2026-08-18T12:00:00.000Z' } });

    await act(async () => { finishPayment({ data: {} }); });
    expect(screen.getByRole('button', { name: 'Pagar Aluguel' })).toBeEnabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Receber Salário' }));
    expect(mockMarkReceivableReceived).toHaveBeenCalledWith({ variables: { id: 'salary', receivedAt: '2026-08-18T12:00:00.000Z' } });
  });

  test('allows retrying a failed account payment', async () => {
    mockAccountsData = {
      myAccountsPayable: [{ id: 'rent', description: 'Aluguel', amount: '700', dueDate: '2026-08-18', status: 'PENDING' }]
    };
    mockMarkPayablePaid.mockRejectedValueOnce(new Error('Payment unavailable'));
    await render(<DashboardShell />, { wrapper: Wrapper });

    await fireEvent.press(screen.getByRole('button', { name: 'Pagar Aluguel' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pagar Aluguel' })).toBeEnabled());
    await fireEvent.press(screen.getByRole('button', { name: 'Pagar Aluguel' }));
    expect(mockMarkPayablePaid).toHaveBeenCalledTimes(2);
  });

  test('opens only payable, receivable and card creation from mobile quick actions', async () => {
    jest.mocked(Dimensions.get).mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
    await render(<DashboardShell />, { wrapper: Wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Novo lan\u00e7amento r\u00e1pido' }));
    const options = within(screen.getByTestId('quick-action-options'));
    expect(options.getAllByRole('button')).toHaveLength(4);
    expect(options.queryByRole('button', { name: 'Criar Transa\u00e7\u00e3o' })).toBeNull();
  });

  test.each([1280, 390])('opens quick account modals without navigating at width %s', async width => {
    jest.mocked(Dimensions.get).mockReturnValue({ width, height: 844, scale: 1, fontScale: 1 });
    await render(<DashboardShell />, { wrapper: Wrapper });
    for (const [action, title] of [
      ['Criar Conta a Pagar', 'Nova Conta a Pagar'],
      ['Criar Conta a Receber', 'Nova Conta a Receber'],
    ] as const) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await fireEvent.press(screen.getByRole('button', { name: 'Novo lan\u00e7amento r\u00e1pido' }));
        await fireEvent.press(within(screen.getByTestId('quick-action-options')).getByRole('button', { name: action }));
        expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
        expect(screen.queryByRole('header', { name: 'Novo Lan\u00e7amento R\u00e1pido' })).toBeNull();
        await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
        expect(screen.queryByRole('header', { name: title })).toBeNull();
        expect(screen.getByText('Dashboard financeiro')).toBeOnTheScreen();
      }
    }
  });

  test.each([
    [1280, 'Dashboard'],
    [390, 'MoneyHub']
  ])('keeps the notification layer above content at width %s', async (width, headerTitle) => {
    jest.mocked(Dimensions.get).mockReturnValue({ width, height: 844, scale: 1, fontScale: 1 });
    await render(<DashboardShell />, { wrapper: Wrapper });

    const brand = screen.getByRole('header', { name: headerTitle });
    const brandRowStyle = StyleSheet.flatten(brand.parent?.parent?.props.style);
    const navigationStyle = StyleSheet.flatten(brand.parent?.parent?.parent?.props.style);

    expect(navigationStyle.zIndex).toBeGreaterThan(0);
    expect(brandRowStyle.zIndex).toBeGreaterThan(navigationStyle.zIndex);
  });

  test.each([
    ['Criar Meta', 'Metas financeiras']
  ])('opens the target screen from desktop quick action %s', async (action, title) => {
    await render(<DashboardShell />, { wrapper: Wrapper });
    await fireEvent.press(screen.getByRole('button', { name: action }));

    screen.getAllByRole('header', { name: title }).forEach((header) => {
      expect(header).toBeOnTheScreen();
    });
    expect(screen.queryByText('Dashboard financeiro')).toBeNull();
  });

  test.each([
    ['Extrato', 'Extrato'],
    ['Contas a Pagar', 'Contas a Pagar'],
    ['Contas a Receber', 'Contas a Receber'],
    ['Recorrências', 'Transações Recorrentes'],
    ['Centros de Custo', 'Centros de Custo'],
    ['Ajustes', 'Ajustes de perfil'],
    ['MoneyHub IA', 'Assistente Financeiro IA']
  ])('navigates to %s and returns to the dashboard', async (section, title) => {
    await render(<DashboardShell />, { wrapper: Wrapper });
    await fireEvent.press(screen.getByRole('button', { name: section }));

    screen.getAllByRole('header', { name: title }).forEach((header) => {
      expect(header).toBeOnTheScreen();
    });
    expect(screen.queryByText('Dashboard financeiro')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Dashboard' }));
    expect(screen.getByText('Dashboard financeiro')).toBeOnTheScreen();
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
    const query = print(mockDashboardQuery.mock.calls.find(call => print(call[0]).includes('query DashboardSummary'))![0]);
    expect(query).toMatch(/overdueAccountsPayable: myAccountsPayable\(\s*status: OVERDUE[\s,]+financialAccountIds: \$financialAccountIds\s*\)/);
    expect(query).toMatch(/overdueAccountsReceivable: myAccountsReceivable\(\s*status: OVERDUE[\s,]+financialAccountIds: \$financialAccountIds\s*\)/);
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


