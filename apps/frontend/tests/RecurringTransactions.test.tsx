import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { RecurringTransactions } from '../src/components/RecurringTransactions';
import { AuthProvider } from '../src/providers/AuthProvider';
import type { AuthService } from '../src/services/authService';

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
      emailVerified: true
    });
    return () => undefined;
  }
};

function Wrapper({ children }: PropsWithChildren) {
  return <AuthProvider service={mockService}>{children}</AuthProvider>;
}

const mockCreateRecurring = jest.fn();
const mockDeleteRecurring = jest.fn();
const mockProcessRecurring = jest.fn();
const mockRefetch = jest.fn();
let mockRecurringQueryOverride: {
  data: Record<string, unknown> | undefined;
  loading: boolean;
  refetch: typeof mockRefetch;
} | null = null;
const mockMutationOptions: Record<string, {
  onCompleted?: (result?: unknown) => void;
  onError?: (error: Error) => void;
}> = {};

jest.mock('@apollo/client/react', () => ({
  useQuery: () => mockRecurringQueryOverride ?? ({
    data: {
      myRecurringTransactions: [
        {
          id: 'rec-1',
          userId: 'user-1',
          type: 'EXPENSE',
          categoryId: 'cat-1',
          costCenterId: null,
          description: 'Aluguel Escritório',
          amount: '2500.00',
          recurrenceRule: 'MONTHLY',
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: null,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z'
        },
        {
          id: 'rec-2',
          userId: 'user-1',
          type: 'INCOME',
          categoryId: 'cat-2',
          costCenterId: null,
          description: 'Consultoria TI',
          amount: '8000.00',
          recurrenceRule: 'MONTHLY',
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: null,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z'
        }
      ],
      myCategories: [
        { id: 'cat-1', name: 'Moradia', type: 'EXPENSE', color: '#dc2626' },
        { id: 'cat-2', name: 'Serviços', type: 'INCOME', color: '#16a34a' }
      ],
      myCostCenters: [],
      myProfile: {
        id: 'profile-1',
        preferredCurrency: 'BRL'
      }
    },
    loading: false,
    refetch: mockRefetch
  }),
  useMutation: (document: { definitions: Array<{ name?: { value?: string } }> }, options: object) => {
    const operationName = document.definitions[0]?.name?.value ?? '';
    mockMutationOptions[operationName] = options;
    if (operationName === 'DeleteRecurringTransaction') {
      return [mockDeleteRecurring, { loading: false }];
    }
    if (operationName === 'ProcessRecurringTransactions') {
      return [mockProcessRecurring, { loading: false }];
    }
    return [mockCreateRecurring, { loading: false }];
  }
}));

describe('RecurringTransactions component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecurringQueryOverride = null;
    for (const key of Object.keys(mockMutationOptions)) delete mockMutationOptions[key];
  });

  test('renders header, KPIs, form, and active rules', async () => {
    await render(<RecurringTransactions />, { wrapper: Wrapper });

    expect(screen.getByRole('header', { name: 'Transações Recorrentes' })).toBeOnTheScreen();
    expect(screen.getByText('Despesas Fixas / Mês')).toBeOnTheScreen();
    expect(screen.getByText('Receitas Fixas / Mês')).toBeOnTheScreen();
    expect(screen.getByText('R$ 2.500,00')).toBeOnTheScreen();
    expect(screen.getByText('R$ 8.000,00')).toBeOnTheScreen();
    expect(screen.getByText('Aluguel Escritório')).toBeOnTheScreen();
    expect(screen.getByText('Consultoria TI')).toBeOnTheScreen();
  });

  test('shows validation error when submitting empty form', async () => {
    await render(<RecurringTransactions />, { wrapper: Wrapper });

    await fireEvent.press(screen.getByRole('button', { name: 'Criar Regra de Recorrência' }));

    expect(screen.getByText('Informe uma descrição.')).toBeOnTheScreen();
  });

  test('submits valid form with category and amount', async () => {
    await render(<RecurringTransactions />, { wrapper: Wrapper });

    await fireEvent.changeText(
      screen.getByLabelText('Descrição da recorrência'),
      'Assinatura Software'
    );
    await fireEvent.changeText(screen.getByLabelText('Valor da recorrência'), '120');

    await fireEvent.press(screen.getByRole('button', { name: 'Criar Regra de Recorrência' }));

    expect(mockCreateRecurring).toHaveBeenCalled();
  });

  test('validates amount and date before creating', async () => {
    await render(<RecurringTransactions />, { wrapper: Wrapper });
    await fireEvent.changeText(screen.getByLabelText('Descrição da recorrência'), 'Software');
    await fireEvent.changeText(screen.getByLabelText('Valor da recorrência'), '0');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar Regra de Recorrência' }));
    expect(screen.getByText('Informe um valor numérico positivo.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Valor da recorrência'), '120');
    await fireEvent.changeText(screen.getByLabelText('Data de Início'), 'data inválida');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar Regra de Recorrência' }));
    expect(screen.getByText('Informe uma data de início válida.')).toBeOnTheScreen();
  });

  test('changes type and frequency before submitting income', async () => {
    await render(<RecurringTransactions />, { wrapper: Wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Tipo Receita' }));
    await fireEvent.press(screen.getByText('Semanal'));
    await fireEvent.changeText(screen.getByLabelText('Descrição da recorrência'), 'Contrato');
    await fireEvent.changeText(screen.getByLabelText('Valor da recorrência'), '500');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar Regra de Recorrência' }));

    expect(mockCreateRecurring).toHaveBeenCalledWith(expect.objectContaining({
      variables: { input: expect.objectContaining({ type: 'INCOME', recurrenceRule: 'WEEKLY' }) }
    }));
  });

  test('processes cycles, deletes a rule, and exposes mutation feedback', async () => {
    await render(<RecurringTransactions />, { wrapper: Wrapper });

    await fireEvent.press(screen.getByRole('button', { name: 'Sincronizar ciclos de recorrência' }));
    expect(mockProcessRecurring).toHaveBeenCalledTimes(1);
    await act(() => {
      mockMutationOptions.ProcessRecurringTransactions?.onCompleted?.({
        processRecurringTransactions: { generatedPayables: 2, generatedReceivables: 1 }
      });
    });
    expect(screen.getByText(/2 conta\(s\) a pagar e 1 conta\(s\) a receber/)).toBeOnTheScreen();

    await fireEvent.press(screen.getAllByRole('button', { name: 'Excluir regra de recorrência' })[0]!);
    expect(mockDeleteRecurring).toHaveBeenCalledWith({ variables: { id: 'rec-1' } });
    await act(() => {
      mockMutationOptions.DeleteRecurringTransaction?.onError?.(new Error('falha ao excluir'));
    });
    expect(screen.getByText('falha ao excluir')).toBeOnTheScreen();
  });

  test('handles successful creation callback', async () => {
    await render(<RecurringTransactions />, { wrapper: Wrapper });
    await act(() => {
      mockMutationOptions.CreateRecurringTransaction?.onCompleted?.();
    });
    expect(screen.getByText(/Regra de recorrência cadastrada/)).toBeOnTheScreen();
  });

  test('renders loading and empty defaults without categories', async () => {
    mockRecurringQueryOverride = {
      data: undefined,
      loading: true,
      refetch: mockRefetch
    };
    const view = await render(<RecurringTransactions />, { wrapper: Wrapper });
    expect(screen.getByText('Nenhuma categoria encontrada para este tipo. Cadastre uma categoria na aba Categorias.')).toBeOnTheScreen();

    mockRecurringQueryOverride = {
      data: { myRecurringTransactions: [], myCategories: [], myCostCenters: [] },
      loading: false,
      refetch: mockRefetch
    };
    await view.rerender(<RecurringTransactions />);
    expect(screen.getByText(/Nenhuma transação recorrente configurada/)).toBeOnTheScreen();
  });

  test('covers weekly, yearly, missing category, and cost center selection', async () => {
    mockRecurringQueryOverride = {
      data: {
        myRecurringTransactions: [
          { id: 'weekly', type: 'EXPENSE', categoryId: 'missing', description: 'Semanal', amount: '10', recurrenceRule: 'WEEKLY', startDate: '2026-09-01' },
          { id: 'yearly', type: 'INCOME', categoryId: 'both', description: 'Anual', amount: '1200', recurrenceRule: 'YEARLY', startDate: '2026-09-01' },
          { id: 'invalid', type: 'EXPENSE', categoryId: 'both', description: 'Inválida', amount: 'texto', recurrenceRule: 'OTHER', startDate: '2026-09-01' }
        ],
        myCategories: [{ id: 'both', name: 'Geral', type: 'BOTH', color: '#123456' }],
        myCostCenters: [{ id: 'center-1', name: 'Operações' }],
        myProfile: { preferredCurrency: 'USD' }
      },
      loading: false,
      refetch: mockRefetch
    };
    await render(<RecurringTransactions />, { wrapper: Wrapper });

    expect(screen.getByText('Sem categoria')).toBeOnTheScreen();
    expect(screen.getAllByText('Semanal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Anual').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByText('Operações'));
    await fireEvent.press(screen.getByText('Nenhum'));
    await fireEvent.press(screen.getByRole('button', { name: 'Tipo Receita' }));
    expect(screen.getByRole('button', { name: 'Geral' })).toBeOnTheScreen();
  });
});
