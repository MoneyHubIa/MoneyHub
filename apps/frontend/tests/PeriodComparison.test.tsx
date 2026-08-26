import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { PeriodComparison } from '../src/components/PeriodComparison';

const mockPeriodComparisonMoM = {
  periodComparison: {
    basePeriod: {
      month: 8,
      year: 2026,
      label: 'Agosto/2026',
      totalIncome: '10000.00',
      totalExpense: '6000.00',
      netBalance: '4000.00',
      savingsRate: 40.0,
      incomeCount: 2,
      expenseCount: 10
    },
    comparisonPeriod: {
      month: 7,
      year: 2026,
      label: 'Julho/2026',
      totalIncome: '8000.00',
      totalExpense: '5000.00',
      netBalance: '3000.00',
      savingsRate: 37.5,
      incomeCount: 2,
      expenseCount: 8
    },
    delta: {
      incomeDelta: '2000.00',
      incomePercentage: 25.0,
      expenseDelta: '1000.00',
      expensePercentage: 20.0,
      netBalanceDelta: '1000.00',
      netBalancePercentage: 33.33,
      savingsRateDelta: 2.5
    }
  }
};

const mockPeriodComparisonYoY = {
  periodComparison: {
    basePeriod: {
      month: 8,
      year: 2026,
      label: 'Agosto/2026',
      totalIncome: '10000.00',
      totalExpense: '6000.00',
      netBalance: '4000.00',
      savingsRate: 40.0,
      incomeCount: 2,
      expenseCount: 10
    },
    comparisonPeriod: {
      month: 8,
      year: 2025,
      label: 'Agosto/2025',
      totalIncome: '7000.00',
      totalExpense: '4500.00',
      netBalance: '2500.00',
      savingsRate: 35.71,
      incomeCount: 1,
      expenseCount: 7
    },
    delta: {
      incomeDelta: '3000.00',
      incomePercentage: 42.86,
      expenseDelta: '1500.00',
      expensePercentage: 33.33,
      netBalanceDelta: '1500.00',
      netBalancePercentage: 60.0,
      savingsRateDelta: 4.29
    }
  }
};

jest.mock('@apollo/client/react', () => ({
  useQuery: (_query: unknown, options: { variables?: { input?: { comparisonYear?: number } } }) => {
    const compYear = options?.variables?.input?.comparisonYear;
    return {
      data: compYear === 2025 ? mockPeriodComparisonYoY : mockPeriodComparisonMoM,
      loading: false,
      error: null,
      refetch: jest.fn()
    };
  }
}));

describe('PeriodComparison component', () => {
  test('renders comparison cards and custom period selectors with MoM data', async () => {
    await render(<PeriodComparison baseMonth={8} baseYear={2026} preferredCurrency="BRL" />);

    expect(screen.getByRole('header', { name: 'Comparativo de Períodos Personalizado' })).toBeOnTheScreen();
    expect(screen.getByText('Período Base (Referência)')).toBeOnTheScreen();
    expect(screen.getByText('Período Comparado')).toBeOnTheScreen();

    // Receitas card
    expect(screen.getByText('Receitas (Entradas)')).toBeOnTheScreen();
    expect(screen.getByText('R$ 10.000,00')).toBeOnTheScreen();
    expect(screen.getByText('R$ 8.000,00')).toBeOnTheScreen();
    expect(screen.getByText('+25.0% (+R$ 2.000,00)')).toBeOnTheScreen();

    // Despesas card
    expect(screen.getByText('Despesas (Saídas)')).toBeOnTheScreen();
    expect(screen.getByText('R$ 6.000,00')).toBeOnTheScreen();
    expect(screen.getByText('R$ 5.000,00')).toBeOnTheScreen();
    expect(screen.getByText('+20.0% (+R$ 1.000,00)')).toBeOnTheScreen();

    // Saldo Líquido
    expect(screen.getByText('Saldo Líquido')).toBeOnTheScreen();
    expect(screen.getByText('R$ 4.000,00')).toBeOnTheScreen();
    expect(screen.getByText('R$ 3.000,00')).toBeOnTheScreen();

    // Taxa de Economia
    expect(screen.getByText('Taxa de Economia')).toBeOnTheScreen();
    expect(screen.getByText('40.0%')).toBeOnTheScreen();
    expect(screen.getByText('37.5%')).toBeOnTheScreen();
    expect(screen.getByText('+2.5 p.p.')).toBeOnTheScreen();
  });

  test('switches to YoY comparison when clicking Atalho Ano Anterior', async () => {
    await render(<PeriodComparison baseMonth={8} baseYear={2026} preferredCurrency="BRL" />);

    const yoyButton = screen.getByRole('button', { name: 'Atalho Ano Anterior' });
    await act(async () => {
      fireEvent.press(yoyButton);
    });

    expect(screen.getByText('+42.9% (+R$ 3.000,00)')).toBeOnTheScreen();
    expect(screen.getByText('+4.3 p.p.')).toBeOnTheScreen();
  });

  test('allows custom month and year selection for both periods', async () => {
    await render(<PeriodComparison baseMonth={8} baseYear={2026} preferredCurrency="BRL" />);

    // Tap on month pill 'Mar' for base period
    const marchPill = screen.getByRole('button', { name: 'Selecionar mês base Mar' });
    await act(async () => {
      fireEvent.press(marchPill);
    });

    // Tap on year stepper
    const prevYearBtn = screen.getByRole('button', { name: 'Diminuir ano base' });
    await act(async () => {
      fireEvent.press(prevYearBtn);
    });

    expect(screen.getByText('2025')).toBeOnTheScreen();
  });
});
