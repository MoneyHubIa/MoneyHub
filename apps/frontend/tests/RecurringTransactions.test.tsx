import { fireEvent, render, screen } from '@testing-library/react-native';
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

jest.mock('@apollo/client/react', () => ({
  useQuery: () => ({
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
    refetch: jest.fn()
  }),
  useMutation: () => {
    return [mockCreateRecurring, { loading: false }];
  }
}));

describe('RecurringTransactions component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
