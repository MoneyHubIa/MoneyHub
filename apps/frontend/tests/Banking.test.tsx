import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Banking } from '../src/components/Banking';
import { FinancialAccountSelector } from '../src/components/FinancialAccountSelector';
import { ThemeProvider } from '../src/theme/ThemeContext';

const mockMutate = jest.fn();
const mockRefetch = jest.fn();
let mockCards: { id: string; name: string; brand: string; archived: boolean; creditLimit: string; statements: never[] }[] = [];
let mockCategories: { id: string; name: string; type: string }[] = [];
const mockAccounts = [
  { id: 'current', name: 'Conta Corrente', type: 'CHECKING', isDefault: true, balance: '100.00', initialBalance: '0.00', archived: false },
  { id: 'invest', name: 'Investimentos', type: 'INVESTMENT', isDefault: false, balance: '50.00', initialBalance: '0.00', archived: false }
];
jest.mock('expo-crypto', () => ({ randomUUID: () => '11111111-1111-4111-8111-111111111111' }));
jest.mock('@apollo/client/react', () => ({
  useApolloClient: () => ({ mutate: mockMutate, refetchQueries: mockRefetch }),
  useQuery: (document: { definitions: { name?: { value: string } }[] }) => ({
    data: document.definitions[0]?.name?.value === 'FinancialAccounts' ? { myFinancialAccounts: mockAccounts } : {
      myTransfers: [], myCreditCards: mockCards, creditCardBrands: ['Visa', 'Mastercard', 'Outra'], myCategories: mockCategories
    }, loading: false
  })
}));
beforeEach(() => { mockCards = []; mockCategories = []; mockMutate.mockReset().mockResolvedValue({ data: {} }); mockRefetch.mockReset().mockResolvedValue({}); });

test('records purchases from Banking using the shared card purchase form', async () => {
  mockCards = [{ id: 'card', name: 'Principal', brand: 'Visa', archived: false, creditLimit: '1000', statements: [] }];
  mockCategories = [{ id: 'food', name: 'Alimentação', type: 'EXPENSE' }];
  await render(<ThemeProvider><Banking section="cards" /></ThemeProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Registrar compra' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Principal • Visa' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Alimentação' }));
  await fireEvent.changeText(screen.getByLabelText('Descrição da compra'), 'Mercado');
  await fireEvent.changeText(screen.getByLabelText('Valor total da compra'), '25,50');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ variables: { input: expect.objectContaining({ cardId: 'card', categoryId: 'food', amount: '25.50', first: 1, total: 1 }) } }));
  expect(screen.getByText('Operação concluída.')).toBeOnTheScreen();
});

test('blocks transfer until destination differs and amount and date are valid', async () => {
  await render(<ThemeProvider><Banking section="transfers" /></ThemeProvider>);
  const save = () => screen.getByRole('button', { name: 'Salvar' });
  expect(save()).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Valor'), '25,50');
  await fireEvent.press(screen.getAllByRole('button', { name: 'Conta Corrente' })[1]!);
  expect(save()).toBeDisabled();
  await fireEvent.press(screen.getAllByRole('button', { name: 'Investimentos' })[1]!);
  await fireEvent.changeText(screen.getByLabelText('Data prevista (YYYY-MM-DD)'), '2026-02-30');
  await fireEvent.press(save());
  expect(mockMutate).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Data prevista (YYYY-MM-DD)'), '2026-02-28');
  expect(save()).toBeEnabled();
});

test('blocks purchase without a selected card', async () => {
  await render(<ThemeProvider><Banking section="cards" /></ThemeProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Registrar compra' }));
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  expect(mockMutate).not.toHaveBeenCalled();
});

test('creates a financial account with exact bank number and initial balance', async () => {
  await render(<ThemeProvider><Banking section="accounts" /></ThemeProvider>);
  await fireEvent.changeText(screen.getByLabelText('Nome da conta'), 'Reserva');
  await fireEvent.changeText(screen.getByLabelText('Número da conta'), '000123-4');
  await fireEvent.changeText(screen.getByLabelText('Saldo inicial'), '125,50');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ variables: { input: expect.objectContaining({ name: 'Reserva', accountNumber: '000123-4', initialBalance: '125.50' }) } })));
});
test('creates a pending transfer between selected accounts', async () => {
  await render(<ThemeProvider><Banking section="transfers" /></ThemeProvider>);
  await fireEvent.press(screen.getAllByRole('button', { name: 'Investimentos' })[1]!);
  await fireEvent.changeText(screen.getByLabelText('Valor'), '25.00');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ variables: { input: expect.objectContaining({ sourceId: 'current', destinationId: 'invest', amount: '25.00' }) } })));
  expect(mockMutate.mock.calls[0][0].variables.input.effectiveDate).toBeUndefined();
});
test('configures dynamic closing and business-day due dates', async () => {
  await render(<ThemeProvider><Banking section="cards" /></ThemeProvider>);
  await fireEvent.changeText(screen.getByLabelText('Nome do cartão'), 'Principal');
  await fireEvent.changeText(screen.getByLabelText('Limite'), '2000');
  await fireEvent.press(screen.getByRole('switch', { name: 'Fechamento dinâmico' }));
  await fireEvent.changeText(screen.getByLabelText('Dias antes do vencimento'), '7');
  await fireEvent.press(screen.getByRole('switch', { name: 'Vencimento no próximo dia útil' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ variables: { input: expect.objectContaining({ financialAccountId: 'current', dynamicDays: 7, businessDays: true }) } })));
});
test('multiple account selection supports specific accounts and all', async () => {
  const changed = jest.fn();
  function Filter() {
    const [ids, setIds] = useState<string[]>([]);
    return <FinancialAccountSelector multiple value={ids} onChange={value => { setIds(value); changed(value); }} />;
  }
  await render(<ThemeProvider><Filter /></ThemeProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Investimentos' }));
  expect(changed).toHaveBeenLastCalledWith(['invest']);
  await fireEvent.press(screen.getByRole('button', { name: 'Conta Corrente' }));
  expect(changed).toHaveBeenLastCalledWith(['invest', 'current']);
  await fireEvent.press(screen.getByRole('button', { name: 'Todas' }));
  expect(changed).toHaveBeenLastCalledWith([]);
});
