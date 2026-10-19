import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import {
  CategoryItem,
  TransactionModal
} from '../src/components/TransactionModal';
import { ThemeProvider } from '../src/theme/ThemeContext';

const mockCreateIncome = jest.fn();
const mockCreateExpense = jest.fn();

jest.mock('@apollo/client/react', () => ({
  useQuery: () => ({
    data: {
      myCategories: [
        { id: 'cat-inc', name: 'Salário', type: 'INCOME', color: '#10B981' },
        { id: 'cat-exp', name: 'Alimentação', type: 'EXPENSE', color: '#F43F5E' }
      ],
      myProfile: {
        id: 'p-1',
        preferredCurrency: 'BRL'
      }
    },
    loading: false
  }),
  useMutation: (mutationDoc: { definitions: Array<{ name?: { value: string } }> }) => {
    const name = mutationDoc.definitions[0]?.name?.value;
    if (name === 'CreateIncome') return [mockCreateIncome, { loading: false }];
    if (name === 'CreateExpense') return [mockCreateExpense, { loading: false }];
    return [jest.fn(), { loading: false }];
  }
}));

describe('TransactionModal Component', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider>{children}</ThemeProvider>
  );

  const mockCategories: CategoryItem[] = [
    { id: 'cat-1', name: 'Salário', type: 'INCOME', color: '#10B981' },
    { id: 'cat-2', name: 'Supermercado', type: 'EXPENSE', color: '#F43F5E' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal with initial type EXPENSE and validates fields', async () => {
    const onCloseMock = jest.fn();

    await render(
      <TransactionModal
        categories={mockCategories}
        initialType="EXPENSE"
        onClose={onCloseMock}
        visible={true}
      />,
      { wrapper }
    );

    expect(screen.getByRole('header', { name: 'Nova Despesa' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Adicionar transação' })).toBeOnTheScreen();

    // Trigger validation
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar transação' }));
    expect(screen.getByText('Informe a descrição.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Descrição da transação'), 'Compras');
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar transação' }));
    expect(screen.getByText('Informe um valor válido.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Valor da transação'), '250.50');
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar transação' }));
    expect(screen.getByText('Selecione uma categoria.')).toBeOnTheScreen();
  });

  it('submits a new expense when properly filled', async () => {
    mockCreateExpense.mockResolvedValue({ data: { createExpense: { id: 'exp-1' } } });
    const onCloseMock = jest.fn();
    const onSuccessMock = jest.fn();

    await render(
      <TransactionModal
        categories={mockCategories}
        initialType="EXPENSE"
        onClose={onCloseMock}
        onSuccess={onSuccessMock}
        visible={true}
      />,
      { wrapper }
    );

    await fireEvent.changeText(screen.getByLabelText('Descrição da transação'), 'Mercado Semanal');
    await fireEvent.changeText(screen.getByLabelText('Valor da transação'), '320.00');
    await fireEvent.press(screen.getByRole('button', { name: 'Supermercado' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar transação' }));

    await waitFor(() => {
      expect(mockCreateExpense).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            input: expect.objectContaining({
              description: 'Mercado Semanal',
              amount: '320',
              categoryId: 'cat-2'
            })
          }
        })
      );
    });
  });

  it('toggles to income and submits createIncome', async () => {
    mockCreateIncome.mockResolvedValue({ data: { createIncome: { id: 'inc-1' } } });
    const onCloseMock = jest.fn();

    await render(
      <TransactionModal
        categories={mockCategories}
        initialType="EXPENSE"
        onClose={onCloseMock}
        visible={true}
      />,
      { wrapper }
    );

    // Toggle to income
    await fireEvent.press(screen.getByRole('button', { name: 'Receita' }));
    expect(screen.getByRole('header', { name: 'Nova Receita' })).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Descrição da transação'), 'Freelance');
    await fireEvent.changeText(screen.getByLabelText('Valor da transação'), '1500');
    await fireEvent.press(screen.getByRole('button', { name: 'Salário' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar transação' }));

    await waitFor(() => {
      expect(mockCreateIncome).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            input: expect.objectContaining({
              description: 'Freelance',
              amount: '1500',
              categoryId: 'cat-1'
            })
          }
        })
      );
    });
  });

  it('closes on cancel button click', async () => {
    const onCloseMock = jest.fn();

    await render(
      <TransactionModal
        categories={mockCategories}
        onClose={onCloseMock}
        visible={true}
      />,
      { wrapper }
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it.each(['EXPENSE', 'INCOME'] as const)('rejects invalid dates and preserves valid date for %s', async (initialType) => {
    await render(
      <TransactionModal categories={mockCategories} preferredCurrency="BRL" initialType={initialType} onClose={jest.fn()} visible />,
      { wrapper }
    );
    await fireEvent.changeText(screen.getByLabelText('Descrição da transação'), 'Teste de data');
    await fireEvent.changeText(screen.getByLabelText('Valor da transação'), '100');
    await fireEvent.press(screen.getByRole('button', { name: initialType === 'INCOME' ? 'Salário' : 'Supermercado' }));

    for (const invalidDate of ['', 'abc', '31/02/2026', '2026-02-30']) {
      await fireEvent.changeText(screen.getByLabelText('Data da Ocorrência'), invalidDate);
      await fireEvent.press(screen.getByRole('button', { name: 'Adicionar transação' }));
      expect(screen.getByText('Informe uma data válida.')).toBeOnTheScreen();
      expect(mockCreateExpense).not.toHaveBeenCalled();
      expect(mockCreateIncome).not.toHaveBeenCalled();
    }

    await fireEvent.changeText(screen.getByLabelText('Data da Ocorrência'), '28/02/2026');
    expect(screen.queryByText('Informe uma data válida.')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar transação' }));
    expect(initialType === 'INCOME' ? mockCreateIncome : mockCreateExpense).toHaveBeenCalledWith({
      variables: { input: expect.objectContaining({ occurredAt: '2026-02-28T12:00:00.000Z' }) }
    });
  });
});
