import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Transactions } from '../src/components/Transactions';

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
    await render(<Transactions />);

    expect(screen.getByRole('header', { name: 'Transações' })).toBeOnTheScreen();
    expect(screen.getByText('Salário')).toBeOnTheScreen();
    expect(screen.getByText('+ R$ 5.000,00')).toBeOnTheScreen();
    expect(screen.getByText('Mercado')).toBeOnTheScreen();
    expect(screen.getByText('- R$ 450,00')).toBeOnTheScreen();
  });

  test('creates a new expense when form is filled', async () => {
    mockCreateExpense.mockResolvedValue({ data: { createExpense: { id: 'exp-2' } } });

    await render(<Transactions />);

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
    await render(<Transactions />);
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
    await render(<Transactions />);

    await fireEvent.press(screen.getByText('Receita'));
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
    const view = await render(<Transactions />);
    expect(screen.getByText('Crie categorias primeiro.')).toBeOnTheScreen();

    mockTransactionsQueryOverride = {
      data: { myIncomes: [], myExpenses: [], myCategories: [], myProfile: null },
      loading: false,
      refetch: mockRefetch
    };
    await view.rerender(<Transactions />);
    expect(screen.getByText('Nenhuma transação encontrada.')).toBeOnTheScreen();
  });
});
