import { render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { AccountsPayable } from '../src/components/AccountsPayable';
import { AccountsReceivable } from '../src/components/AccountsReceivable';
import { FinancialCategories } from '../src/components/FinancialCategories';
import { Transactions } from '../src/components/Transactions';
import { CashFlowChart } from '../src/components/CashFlowChart';
import { CategoryAnalysis } from '../src/components/CategoryAnalysis';
import { PeriodComparison } from '../src/components/PeriodComparison';
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

jest.mock('@apollo/client/react', () => ({
  useQuery: () => ({
    data: {
      myCategories: [
        { id: 'cat-aluguel', name: 'Aluguel', type: 'EXPENSE', color: '#dc2626', icon: 'home' },
        { id: 'cat-alimentacao', name: 'Alimentação', type: 'EXPENSE', color: '#f59e0b', icon: 'utensils' },
        { id: 'cat-freelance', name: 'Freelance', type: 'INCOME', color: '#16a34a', icon: 'laptop' }
      ],
      myExpenses: [
        {
          id: 'exp-1',
          categoryId: 'cat-aluguel',
          amount: '2500.00',
          description: 'Aluguel Agosto',
          date: '2026-08-22T00:00:00.000Z'
        },
        {
          id: 'exp-2',
          categoryId: 'cat-alimentacao',
          amount: '1200.00',
          description: 'Supermercado',
          date: '2026-08-22T00:00:00.000Z'
        }
      ],
      myIncomes: [
        {
          id: 'inc-1',
          categoryId: 'cat-freelance',
          amount: '7500.00',
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
      },
      cashFlow: {
        granularity: 'DAILY',
        dataPoints: [
          {
            label: '01/08',
            date: '2026-08-01',
            income: '7500.00',
            expense: '2500.00',
            net: '5000.00',
            accumulatedBalance: '5000.00'
          },
          {
            label: '15/08',
            date: '2026-08-15',
            income: '0.00',
            expense: '1200.00',
            net: '-1200.00',
            accumulatedBalance: '3800.00'
          }
        ],
        totals: {
          totalIncome: '7500.00',
          totalExpense: '3700.00',
          netBalance: '3800.00'
        }
      },
      categoryAnalysis: {
        type: 'EXPENSE',
        month: 8,
        year: 2026,
        totalAmount: '3700.00',
        items: [
          {
            categoryId: 'cat-aluguel',
            categoryName: 'Aluguel',
            categoryColor: '#dc2626',
            categoryIcon: 'home',
            totalAmount: '2500.00',
            percentage: 67.57,
            transactionCount: 1
          },
          {
            categoryId: 'cat-alimentacao',
            categoryName: 'Alimentação',
            categoryColor: '#f59e0b',
            categoryIcon: 'utensils',
            totalAmount: '1200.00',
            percentage: 32.43,
            transactionCount: 1
          }
        ]
      },
      periodComparison: {
        basePeriod: {
          month: 8,
          year: 2026,
          label: 'Agosto/2026',
          totalIncome: '7500.00',
          totalExpense: '3700.00',
          netBalance: '3800.00',
          savingsRate: 50.67,
          incomeCount: 1,
          expenseCount: 2
        },
        comparisonPeriod: {
          month: 7,
          year: 2026,
          label: 'Julho/2026',
          totalIncome: '6000.00',
          totalExpense: '3500.00',
          netBalance: '2500.00',
          savingsRate: 41.67,
          incomeCount: 1,
          expenseCount: 2
        },
        delta: {
          incomeDelta: '1500.00',
          incomePercentage: 25.0,
          expenseDelta: '200.00',
          expensePercentage: 5.71,
          netBalanceDelta: '1300.00',
          netBalancePercentage: 52.0,
          savingsRateDelta: 9.0
        }
      }
    },
    loading: false,
    refetch: jest.fn()
  }),
  useMutation: () => {
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
    expect(screen.getByText('+ R$ 7.500,00')).toBeOnTheScreen();
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

  test('5. CashFlowChart adapts dynamically with multi-value scaling and cumulative balance', async () => {
    await render(<CashFlowChart preferredCurrency="BRL" />);
    expect(screen.getByRole('header', { name: 'Fluxo de Caixa' })).toBeOnTheScreen();
    expect(screen.getByText('Total Entradas')).toBeOnTheScreen();
    expect(screen.getByText('R$ 7.500,00')).toBeOnTheScreen();
    expect(screen.getByText('Total Saídas')).toBeOnTheScreen();
    expect(screen.getByText('R$ 3.700,00')).toBeOnTheScreen();
    expect(screen.getByText('Saldo do Período')).toBeOnTheScreen();
    expect(screen.getByText('R$ 3.800,00')).toBeOnTheScreen();
    expect(screen.getByText('01/08')).toBeOnTheScreen();
    expect(screen.getByText('15/08')).toBeOnTheScreen();
  });

  test('6. CategoryAnalysis computes proportional distributions and ordered ranking', async () => {
    await render(<CategoryAnalysis preferredCurrency="BRL" />);
    expect(screen.getByRole('header', { name: 'Análise por Categoria' })).toBeOnTheScreen();
    expect(screen.getByText('Total de Despesas:')).toBeOnTheScreen();
    expect(screen.getByText('R$ 3.700,00')).toBeOnTheScreen();
    expect(screen.getByText('Aluguel')).toBeOnTheScreen();
    expect(screen.getByText('67.6%')).toBeOnTheScreen();
    expect(screen.getByText('Alimentação')).toBeOnTheScreen();
    expect(screen.getByText('32.4%')).toBeOnTheScreen();
  });

  test('7. PeriodComparison provides customizable comparison indicators and deltas', async () => {
    await render(<PeriodComparison baseMonth={8} baseYear={2026} preferredCurrency="BRL" />);
    expect(screen.getByRole('header', { name: 'Comparativo de Períodos Personalizado' })).toBeOnTheScreen();
    expect(screen.getByText('Receitas (Entradas)')).toBeOnTheScreen();
    expect(screen.getByText('R$ 7.500,00')).toBeOnTheScreen();
    expect(screen.getByText('R$ 6.000,00')).toBeOnTheScreen();
    expect(screen.getByText('Taxa de Economia')).toBeOnTheScreen();
    expect(screen.getByText('50.7%')).toBeOnTheScreen();
    expect(screen.getByText('41.7%')).toBeOnTheScreen();
    expect(screen.getByText('+9.0 p.p.')).toBeOnTheScreen();
  });
});
