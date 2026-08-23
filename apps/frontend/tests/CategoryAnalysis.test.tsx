import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { CategoryAnalysis } from '../src/components/CategoryAnalysis';

const mockCategoryExpenseData = {
  categoryAnalysis: {
    type: 'EXPENSE',
    month: 8,
    year: 2026,
    totalAmount: '2800.00',
    items: [
      {
        categoryId: 'cat-1',
        categoryName: 'Moradia',
        categoryColor: '#3b82f6',
        categoryIcon: 'home',
        totalAmount: '1800.00',
        percentage: 64.29,
        transactionCount: 2
      },
      {
        categoryId: 'cat-2',
        categoryName: 'Alimentação',
        categoryColor: '#10b981',
        categoryIcon: 'utensils',
        totalAmount: '1000.00',
        percentage: 35.71,
        transactionCount: 5
      }
    ]
  }
};

const mockCategoryIncomeData = {
  categoryAnalysis: {
    type: 'INCOME',
    month: 8,
    year: 2026,
    totalAmount: '8000.00',
    items: [
      {
        categoryId: 'cat-3',
        categoryName: 'Salário',
        categoryColor: '#059669',
        categoryIcon: 'wallet',
        totalAmount: '8000.00',
        percentage: 100.0,
        transactionCount: 1
      }
    ]
  }
};

jest.mock('@apollo/client/react', () => ({
  useQuery: (_query: unknown, options: { variables?: { input?: { type?: string } } }) => {
    const type = options?.variables?.input?.type ?? 'EXPENSE';
    return {
      data: type === 'INCOME' ? mockCategoryIncomeData : mockCategoryExpenseData,
      loading: false,
      error: null,
      refetch: jest.fn()
    };
  }
}));

describe('CategoryAnalysis component', () => {
  test('renders header, total amount and category ranking list', async () => {
    await render(<CategoryAnalysis preferredCurrency="BRL" />);

    expect(screen.getByRole('header', { name: 'Análise por Categoria' })).toBeOnTheScreen();
    expect(screen.getByText('Total de Despesas:')).toBeOnTheScreen();
    expect(screen.getByText('R$ 2.800,00')).toBeOnTheScreen();

    // Ranked items
    expect(screen.getByText('Moradia')).toBeOnTheScreen();
    expect(screen.getByText('R$ 1.800,00')).toBeOnTheScreen();
    expect(screen.getByText('64.3%')).toBeOnTheScreen();

    expect(screen.getByText('Alimentação')).toBeOnTheScreen();
    expect(screen.getByText('R$ 1.000,00')).toBeOnTheScreen();
    expect(screen.getByText('35.7%')).toBeOnTheScreen();
  });

  test('switches to Receitas when pressing the Receitas toggle', async () => {
    await render(<CategoryAnalysis preferredCurrency="BRL" />);

    const receitasButton = screen.getByRole('button', { name: 'Analisar Receitas' });
    await act(async () => {
      fireEvent.press(receitasButton);
    });

    expect(screen.getByText('Total de Receitas:')).toBeOnTheScreen();
    expect(screen.getAllByText('R$ 8.000,00').length).toBe(2);
    expect(screen.getByText('Salário')).toBeOnTheScreen();
    expect(screen.getByText('100.0%')).toBeOnTheScreen();
  });
});
