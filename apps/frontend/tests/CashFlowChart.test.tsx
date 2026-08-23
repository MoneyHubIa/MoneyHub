import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { CashFlowChart } from '../src/components/CashFlowChart';

const mockCashFlowDaily = {
  granularity: 'DAILY',
  dataPoints: [
    {
      label: '01/08',
      date: '2026-08-01',
      income: '1500.00',
      expense: '200.00',
      net: '1300.00',
      accumulatedBalance: '1300.00'
    },
    {
      label: '02/08',
      date: '2026-08-02',
      income: '0.00',
      expense: '500.00',
      net: '-500.00',
      accumulatedBalance: '800.00'
    }
  ],
  totals: {
    totalIncome: '1500.00',
    totalExpense: '700.00',
    netBalance: '800.00'
  }
};

const mockCashFlowMonthly = {
  granularity: 'MONTHLY',
  dataPoints: [
    {
      label: 'Jul/26',
      date: '2026-07',
      income: '5000.00',
      expense: '3000.00',
      net: '2000.00',
      accumulatedBalance: '2000.00'
    },
    {
      label: 'Ago/26',
      date: '2026-08',
      income: '6000.00',
      expense: '2500.00',
      net: '3500.00',
      accumulatedBalance: '5500.00'
    }
  ],
  totals: {
    totalIncome: '11000.00',
    totalExpense: '5500.00',
    netBalance: '5500.00'
  }
};

let currentGranularity = 'DAILY';

jest.mock('@apollo/client/react', () => ({
  useQuery: (_query: unknown, options: { variables?: { input?: { granularity?: string } } }) => {
    const gran = options?.variables?.input?.granularity ?? 'DAILY';
    return {
      data: {
        cashFlow: gran === 'MONTHLY' ? mockCashFlowMonthly : mockCashFlowDaily
      },
      loading: false,
      error: null,
      refetch: jest.fn()
    };
  }
}));

describe('CashFlowChart', () => {
  test('renders header, totals ribbon and daily data points', async () => {
    await render(<CashFlowChart preferredCurrency="BRL" />);

    expect(screen.getByRole('header', { name: 'Fluxo de Caixa' })).toBeOnTheScreen();
    expect(screen.getByText('Total Entradas')).toBeOnTheScreen();
    expect(screen.getByText('R$ 1.500,00')).toBeOnTheScreen();
    expect(screen.getByText('Total Saídas')).toBeOnTheScreen();
    expect(screen.getByText('R$ 700,00')).toBeOnTheScreen();
    expect(screen.getByText('Saldo do Período')).toBeOnTheScreen();
    expect(screen.getByText('R$ 800,00')).toBeOnTheScreen();

    // Data points
    expect(screen.getByText('01/08')).toBeOnTheScreen();
    expect(screen.getByText('02/08')).toBeOnTheScreen();
  });

  test('switches granularity to Monthly view on button click', async () => {
    await render(<CashFlowChart preferredCurrency="BRL" />);

    const monthlyButton = screen.getByRole('button', { name: 'Visualização Mensal' });
    await act(async () => {
      fireEvent.press(monthlyButton);
    });

    expect(screen.getByText('Jul/26')).toBeOnTheScreen();
    expect(screen.getByText('Ago/26')).toBeOnTheScreen();
  });

  test('selects point and displays details box when tapping a bar', async () => {
    await render(<CashFlowChart preferredCurrency="BRL" />);

    const pointButton = screen.getByRole('button', { name: 'Ponto 01/08' });
    await act(async () => {
      fireEvent.press(pointButton);
    });

    expect(screen.getByText(/Detalhes de 01\/08 \(2026-08-01\)/)).toBeOnTheScreen();
    expect(screen.getByText('Entradas: R$ 1.500,00')).toBeOnTheScreen();
    expect(screen.getByText('Saídas: R$ 200,00')).toBeOnTheScreen();
  });
});
