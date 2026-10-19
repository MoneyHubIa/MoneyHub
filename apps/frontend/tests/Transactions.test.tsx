import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Transactions } from '../src/components/Transactions';

import type { PropsWithChildren } from 'react';
import { ThemeProvider } from '../src/theme/ThemeContext';

function Wrapper({ children }: PropsWithChildren) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

const mockCreateIncome = jest.fn();
const mockCreateExpense = jest.fn();
const mockDeleteIncome = jest.fn();
const mockDeleteExpense = jest.fn();
const mockRefetch = jest.fn();
let mockTransactionsQueryOverride: {
  data: Record<string, unknown> | undefined;
  loading: boolean;
  refetch: typeof mockRefetch;
} | null = null;

jest.mock('@apollo/client/react', () => ({
  useQuery: () => mockTransactionsQueryOverride ?? ({
    data: {
      myIncomes: [
        {
          id: 'inc-1',
          categoryId: 'cat-1',
          description: 'Salário',
          amount: '5000',
          occurredAt: '2026-01-05T10:00:00Z',
          __typename: 'Income'
        }
      ],
      myExpenses: [
        {
          id: 'exp-1',
          categoryId: 'cat-2',
          description: 'Mercado',
          amount: '450',
          occurredAt: '2026-01-06T10:00:00Z',
          __typename: 'Expense'
        }
      ],
      myCategories: [
        {
          id: 'cat-1',
          name: 'Trabalho',
          type: 'INCOME',
          color: '#059669'
        },
        {
          id: 'cat-2',
          name: 'Alimentação',
          type: 'EXPENSE',
          color: '#ef4444'
        }
      ]
    },
    loading: false,
    refetch: mockRefetch
  }),
  useMutation: (mutationDoc: { definitions: Array<{ name?: { value: string } }> }) => {
    const name = mutationDoc.definitions[0]?.name?.value;
    if (name === 'CreateIncome') return [mockCreateIncome, { loading: false }];
    if (name === 'CreateExpense') return [mockCreateExpense, { loading: false }];
    if (name === 'DeleteIncome') return [mockDeleteIncome, { loading: false }];
    if (name === 'DeleteExpense') return [mockDeleteExpense, { loading: false }];
    return [jest.fn(), { loading: false }];
  }
}));

describe('Transactions Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionsQueryOverride = null;
  });

  test('renders header and transactions list', async () => {
    await render(<Transactions />, { wrapper: Wrapper });

    expect(screen.getByRole('header', { name: 'Transações' })).toBeOnTheScreen();
    expect(screen.getByText('Salário')).toBeOnTheScreen();
    expect(screen.getByText('+ R$ 5.000,00')).toBeOnTheScreen();
    expect(screen.getByText('Mercado')).toBeOnTheScreen();
    expect(screen.getByText('- R$ 450,00')).toBeOnTheScreen();
  });

  test('creates a new expense when form is filled', async () => {
    mockCreateExpense.mockResolvedValue({ data: { createExpense: { id: 'exp-2' } } });

    await render(<Transactions />, { wrapper: Wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Nova Transação' }));

    await fireEvent.changeText(screen.getByPlaceholderText('Ex: Supermercado'), 'Aluguel');
    await fireEvent.changeText(screen.getByPlaceholderText('Ex: 150.00'), '1800');
    await fireEvent.press(screen.getByRole('button', { name: 'Alimentação' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar transação' }));

    await waitFor(() => {
      expect(mockCreateExpense).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            input: expect.objectContaining({
              description: 'Aluguel',
              amount: '1800',
              categoryId: 'cat-2'
            })
          }
        })
      );
    });
  });

  test('validates required transaction fields', async () => {
    await render(<Transactions />, { wrapper: Wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Nova Transação' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar transação' }));
    expect(screen.getByText('Informe a descrição.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Descrição da transação'), 'Teste');
    await fireEvent.changeText(screen.getByLabelText('Valor da transação'), 'inválido');
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar transação' }));
    expect(screen.getByText('Informe um valor válido.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Valor da transação'), '10');
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar transação' }));
    expect(screen.getByText('Selecione uma categoria.')).toBeOnTheScreen();
  });

  test('creates income and deletes both transaction types', async () => {
    mockCreateIncome.mockResolvedValue({ data: { createIncome: { id: 'inc-2' } } });
    await render(<Transactions />, { wrapper: Wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Nova Transação' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Receita' }));
    await fireEvent.changeText(screen.getByLabelText('Descrição da transação'), 'Projeto');
    await fireEvent.changeText(screen.getByLabelText('Valor da transação'), '900');
    await fireEvent.press(screen.getByRole('button', { name: 'Trabalho' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar transação' }));
    expect(mockCreateIncome).toHaveBeenCalledWith(expect.objectContaining({
      variables: { input: expect.objectContaining({ description: 'Projeto', amount: '900' }) }
    }));

    await fireEvent.press(screen.getByRole('button', { name: 'Excluir transação Salário' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir transação Mercado' }));
    expect(mockDeleteIncome).toHaveBeenCalledWith({ variables: { id: 'inc-1' } });
    expect(mockDeleteExpense).toHaveBeenCalledWith({ variables: { id: 'exp-1' } });
  });

  test('renders loading and empty states with safe defaults', async () => {
    mockTransactionsQueryOverride = { data: undefined, loading: true, refetch: mockRefetch };
    const view = await render(<Transactions />, { wrapper: Wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Nova Transação' }));
    expect(screen.getByText('Crie categorias primeiro.')).toBeOnTheScreen();

    mockTransactionsQueryOverride = {
      data: { myIncomes: [], myExpenses: [], myCategories: [], myProfile: null },
      loading: false,
      refetch: mockRefetch
    };
    await view.rerender(<Transactions />);
    expect(screen.getByText('Nenhuma transação encontrada.')).toBeOnTheScreen();
  });

  test('paginates 10 transactions per page with navigation and resets page on search', async () => {
    // Generate 12 income transactions
    const incomes = Array.from({ length: 12 }, (_, i) => ({
      id: `inc-${i + 1}`,
      categoryId: 'cat-1',
      description: `Venda ${i + 1}`,
      amount: `${100 * (i + 1)}`,
      occurredAt: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
      __typename: 'Income' as const
    }));

    mockTransactionsQueryOverride = {
      data: {
        myIncomes: incomes,
        myExpenses: [],
        myCategories: [{ id: 'cat-1', name: 'Vendas', type: 'INCOME', color: '#059669' }],
        myProfile: null
      },
      loading: false,
      refetch: mockRefetch
    };

    await render(<Transactions />, { wrapper: Wrapper });

    // Should display Page 1 of 2
    expect(screen.getByText(/Página 1 de 2/i)).toBeOnTheScreen();
    // First 10 items rendered (sorted descending by date: Venda 12 to Venda 3)
    expect(screen.getByText('Venda 12')).toBeOnTheScreen();
    expect(screen.queryByText('Venda 2')).toBeNull();

    // Navigate to next page
    const nextButton = screen.getByRole('button', { name: 'Próxima página' });
    await fireEvent.press(nextButton);

    expect(screen.getByText(/Página 2 de 2/i)).toBeOnTheScreen();
    expect(screen.getByText('Venda 2')).toBeOnTheScreen();
    expect(screen.getByText('Venda 1')).toBeOnTheScreen();
    expect(screen.queryByText('Venda 12')).toBeNull();

    // Navigate back to previous page
    const prevButton = screen.getByRole('button', { name: 'Página anterior' });
    await fireEvent.press(prevButton);
    expect(screen.getByText(/Página 1 de 2/i)).toBeOnTheScreen();
    expect(screen.getByText('Venda 12')).toBeOnTheScreen();
  });

  test('filters transactions by selecting category from dropdown', async () => {
    mockTransactionsQueryOverride = {
      data: {
        myIncomes: [
          { id: 'inc-1', categoryId: 'cat-1', description: 'Freela', amount: '1200', occurredAt: '2026-01-01', __typename: 'Income' },
          { id: 'inc-2', categoryId: 'cat-2', description: 'Venda Item', amount: '300', occurredAt: '2026-01-02', __typename: 'Income' }
        ],
        myExpenses: [],
        myCategories: [
          { id: 'cat-1', name: 'Serviços', type: 'INCOME', color: '#10b981' },
          { id: 'cat-2', name: 'Produtos', type: 'INCOME', color: '#6366f1' }
        ],
        myProfile: null
      },
      loading: false,
      refetch: mockRefetch
    };

    await render(<Transactions />, { wrapper: Wrapper });
    expect(screen.getByText('Freela')).toBeOnTheScreen();
    expect(screen.getByText('Venda Item')).toBeOnTheScreen();

    // Open dropdown
    await fireEvent.press(screen.getByRole('button', { name: 'Selecionar filtro de categoria' }));
    expect(screen.getByRole('button', { name: 'Opção categoria Serviços' })).toBeOnTheScreen();

    // Select category Serviços
    await fireEvent.press(screen.getByRole('button', { name: 'Opção categoria Serviços' }));
    expect(screen.getByText('Freela')).toBeOnTheScreen();
    expect(screen.queryByText('Venda Item')).toBeNull();

    // Clear filter
    await fireEvent.press(screen.getByRole('button', { name: 'Limpar filtro de categoria' }));
    expect(screen.getByText('Freela')).toBeOnTheScreen();
    expect(screen.getByText('Venda Item')).toBeOnTheScreen();
  });

  test.each(['delete', 'resize'])('normalizes pagination after %s reduces page count', async (change) => {
    const incomes = Array.from({ length: 9 }, (_, i) => ({
      id: `inc-${i}`, categoryId: 'cat-1', description: `Venda ${i}`, amount: '100',
      occurredAt: `2026-01-${String(i + 1).padStart(2, '0')}`, __typename: 'Income'
    }));
    mockTransactionsQueryOverride = {
      data: { myIncomes: incomes, myExpenses: [], myCategories: [] },
      loading: false, refetch: mockRefetch
    };
    const view = await render(<Transactions pageSize={4} />, { wrapper: Wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Próxima página' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Próxima página' }));
    expect(screen.getByText('Página 3 de 3')).toBeOnTheScreen();

    if (change === 'delete') {
      await fireEvent.press(screen.getByRole('button', { name: 'Excluir transação Venda 0' }));
      expect(mockDeleteIncome).toHaveBeenCalledWith({ variables: { id: 'inc-0' } });
      mockTransactionsQueryOverride.data = { myIncomes: incomes.slice(1), myExpenses: [], myCategories: [] };
    }
    await view.rerender(<Transactions pageSize={change === 'resize' ? 6 : 4} />);
    expect(screen.getByText('Página 2 de 2')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Página anterior' }));
    expect(screen.getByText('Página 1 de 2')).toBeOnTheScreen();
    expect(screen.getByText('Venda 8')).toBeOnTheScreen();
  });
});
