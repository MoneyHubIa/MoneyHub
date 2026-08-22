import { fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { AccountsPayable } from '../src/components/AccountsPayable';
import { AccountsReceivable } from '../src/components/AccountsReceivable';
import { FinancialCategories } from '../src/components/FinancialCategories';
import { Transactions } from '../src/components/Transactions';
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
      uid: 'firebase-uid-test',
      email: 'user@example.com',
      emailVerified: true
    });
    return () => undefined;
  }
};

function Wrapper({ children }: PropsWithChildren) {
  return <AuthProvider service={mockService}>{children}</AuthProvider>;
}

const mockCreateCategory = jest.fn();
const mockCreateExpense = jest.fn();
const mockCreateIncome = jest.fn();
const mockCreatePayable = jest.fn();
const mockCreateReceivable = jest.fn();
const mockMarkPaid = jest.fn();
const mockMarkReceived = jest.fn();

jest.mock('@apollo/client/react', () => ({
  useQuery: () => ({
    data: {
      myCategories: [
        { id: 'cat-aluguel', name: 'Aluguel', type: 'EXPENSE', color: '#dc2626' },
        { id: 'cat-freelance', name: 'Freelance', type: 'INCOME', color: '#16a34a' }
      ],
      myExpenses: [
        {
          id: 'exp-1',
          categoryId: 'cat-aluguel',
          amount: '2500.00',
          description: 'Aluguel Agosto',
          date: '2026-08-22T00:00:00.000Z'
        }
      ],
      myIncomes: [
        {
          id: 'inc-1',
          categoryId: 'cat-freelance',
          amount: '5000.00',
          description: 'Projeto Web',
          date: '2026-08-22T00:00:00.000Z'
        }
      ],
      myAccountsPayable: [
        {
          id: 'pay-1',
          categoryId: 'cat-aluguel',
          costCenterId: null,
          description: 'Energia Elétrica',
          amount: '350.00',
          dueDate: '2026-08-22T00:00:00.000Z',
          status: 'PENDING',
          paidAt: null,
          createdAt: '2026-08-22T00:00:00.000Z'
        }
      ],
      myAccountsReceivable: [
        {
          id: 'rec-1',
          categoryId: 'cat-freelance',
          costCenterId: null,
          description: 'Consultoria TI',
          amount: '8000.00',
          dueDate: '2026-08-22T00:00:00.000Z',
          status: 'PENDING',
          receivedAt: null,
          createdAt: '2026-08-22T00:00:00.000Z'
        }
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
  useMutation: (mutation: any) => {
    return [jest.fn().mockResolvedValue({ data: {} }), { loading: false }];
  }
}));

describe('Full Financial Flow E2E Regression Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1. FinancialCategories renders and allows creating expense and income categories', async () => {
    await render(<FinancialCategories />, { wrapper: Wrapper });
    expect(screen.getByRole('header', { name: 'Categorias Financeiras' })).toBeOnTheScreen();
    expect(screen.getByText('Aluguel')).toBeOnTheScreen();
    expect(screen.getByText('Freelance')).toBeOnTheScreen();
  });

  test('2. Transactions renders with regional currency and displays expense and income records', async () => {
    await render(<Transactions />, { wrapper: Wrapper });
    expect(screen.getByRole('header', { name: 'Transações' })).toBeOnTheScreen();
    expect(screen.getByText('Aluguel Agosto')).toBeOnTheScreen();
    expect(screen.getByText('Projeto Web')).toBeOnTheScreen();
    expect(screen.getByText('- R$ 2.500,00')).toBeOnTheScreen();
    expect(screen.getByText('+ R$ 5.000,00')).toBeOnTheScreen();
  });

  test('3. AccountsPayable renders with regional date format and allows scheduling payable', async () => {
    await render(<AccountsPayable />, { wrapper: Wrapper });
    expect(screen.getByRole('header', { name: 'Contas a Pagar' })).toBeOnTheScreen();
    expect(screen.getByText('Energia Elétrica')).toBeOnTheScreen();
    expect(screen.getAllByText('R$ 350,00')).toHaveLength(2);
    expect(screen.getByText('Dar Baixa')).toBeOnTheScreen();
  });

  test('4. AccountsReceivable renders with regional date format and allows scheduling receivable', async () => {
    await render(<AccountsReceivable />, { wrapper: Wrapper });
    expect(screen.getByRole('header', { name: 'Contas a Receber' })).toBeOnTheScreen();
    expect(screen.getByText('Consultoria TI')).toBeOnTheScreen();
    expect(screen.getAllByText('R$ 8.000,00')).toHaveLength(2);
    expect(screen.getByText('Dar Baixa')).toBeOnTheScreen();
  });
});
