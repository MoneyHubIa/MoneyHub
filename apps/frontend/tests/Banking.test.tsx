import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Banking } from '../src/components/Banking';
import { FinancialAccountSelector } from '../src/components/FinancialAccountSelector';
import { ThemeProvider } from '../src/theme/ThemeContext';

const mockMutate = jest.fn();
const mockRefetch = jest.fn();
let mockCards: { id: string; name: string; brand: string; archived: boolean; creditLimit: string; statements: never[]; financialAccountId?: string; dueDay?: number; closingDay?: number; dynamicDays?: number | null; businessDays?: boolean; isPrimary?: boolean }[] = [];
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
  await fireEvent.press(screen.getByRole('button', { name: 'Cartão' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Principal • Visa' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Categoria' }));
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
  await fireEvent.press(screen.getByRole('button', { name: 'Conta destino' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Conta Corrente' }));
  expect(save()).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Conta destino' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Investimentos' }));
  await fireEvent.changeText(screen.getByLabelText('Data prevista'), '30/02/2026');
  await fireEvent.press(save());
  expect(mockMutate).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Data prevista'), '28/02/2026');
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
  await fireEvent.press(screen.getByRole('button', { name: 'Conta destino' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Investimentos' }));
  await fireEvent.changeText(screen.getByLabelText('Valor'), '25.00');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ variables: { input: expect.objectContaining({ sourceId: 'current', destinationId: 'invest', amount: '25.00' }) } })));
  expect(mockMutate.mock.calls[0][0].variables.input.effectiveDate).toBeUndefined();
});
test('configures dynamic closing and business-day due dates', async () => {
  await render(<ThemeProvider><Banking section="cards" /></ThemeProvider>);
  await fireEvent.changeText(screen.getByLabelText('Nome do cartão'), 'Principal');
  await fireEvent.changeText(screen.getByLabelText('Limite'), '2000');
  expect(screen.getByRole('button', { name: 'Bandeira' })).toHaveProp('accessibilityValue', { text: 'Visa' });
  expect(screen.queryByRole('button', { name: 'Outra' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Bandeira' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Outra' }));
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Nome da outra bandeira'), 'Bandeira local');
  await fireEvent.press(screen.getByRole('switch', { name: 'Fechamento dinâmico' }));
  await fireEvent.changeText(screen.getByLabelText('Dias antes do vencimento'), '7');
  await fireEvent.press(screen.getByRole('switch', { name: 'Vencimento no próximo dia útil' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ variables: { input: expect.objectContaining({ financialAccountId: 'current', brand: 'Bandeira local', dynamicDays: 7, closingDay: 10, businessDays: true }) } })));
});

test('selects the card brand and account and saves fixed closing days', async () => {
  await render(<ThemeProvider><Banking section="cards" /></ThemeProvider>);
  await fireEvent.changeText(screen.getByLabelText('Nome do cartão'), 'Cartão principal');
  await fireEvent.changeText(screen.getByLabelText('Limite'), '2000,50');
  await fireEvent.press(screen.getByRole('button', { name: 'Conta financeira' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Investimentos' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Bandeira' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Mastercard' }));
  expect(screen.getByRole('button', { name: 'Bandeira' })).toHaveProp('accessibilityValue', { text: 'Mastercard' });
  expect(screen.queryByRole('button', { name: 'Mastercard' })).toBeNull();
  expect(screen.queryByLabelText('Nome da outra bandeira')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Aumentar dia de vencimento' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Diminuir dia de fechamento' }));
  await fireEvent.press(screen.getByRole('switch', { name: 'Cartão principal' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ variables: { input: {
    name: 'Cartão principal', financialAccountId: 'invest', brand: 'Mastercard', creditLimit: '2000.50',
    dueDay: 11, closingDay: 2, dynamicDays: null, businessDays: false, isPrimary: true, archived: false
  } } }));
});

test.each([
  ['Dia de vencimento', 31, false],
  ['Dia de fechamento', 31, false],
  ['Dias antes do vencimento', 28, true]
] as const)('enforces the limit for %s', async (label, maximum, dynamic) => {
  await render(<ThemeProvider><Banking section="cards" /></ThemeProvider>);
  await fireEvent.changeText(screen.getByLabelText('Nome do cartão'), 'Principal');
  await fireEvent.changeText(screen.getByLabelText('Limite'), '2000');
  if (dynamic) await fireEvent.press(screen.getByRole('switch', { name: 'Fechamento dinâmico' }));
  const field = screen.getByLabelText(label);
  await fireEvent.changeText(field, String(maximum + 1));
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  expect(mockMutate).not.toHaveBeenCalled();
  await fireEvent.changeText(field, String(maximum));
  const increase = screen.getByRole('button', { name: `Aumentar ${label.toLowerCase()}` });
  const decrease = screen.getByRole('button', { name: `Diminuir ${label.toLowerCase()}` });
  expect(increase).toBeDisabled();
  await fireEvent.press(decrease);
  expect(field).toHaveDisplayValue(String(maximum - 1));
  await fireEvent.changeText(field, '1');
  expect(decrease).toBeDisabled();
  await fireEvent.press(increase);
  expect(field).toHaveDisplayValue('2');
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
});

test('preserves custom card brands and existing settings when editing', async () => {
  mockCards = [{ id: 'card', name: 'Principal', brand: 'Bandeira local', financialAccountId: 'invest', archived: false,
    creditLimit: '2500.00', dueDay: 18, closingDay: 6, dynamicDays: null, businessDays: false, isPrimary: true, statements: [] }];
  await render(<ThemeProvider><Banking section="cards" /></ThemeProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Editar Principal' }));
  expect(screen.getByRole('button', { name: 'Bandeira' })).toHaveProp('accessibilityValue', { text: 'Outra' });
  expect(screen.getByRole('button', { name: 'Conta financeira' })).toHaveProp('accessibilityValue', { text: 'Investimentos' });
  expect(screen.getByLabelText('Nome da outra bandeira')).toHaveDisplayValue('Bandeira local');
  expect(screen.getByLabelText('Dia de vencimento')).toHaveDisplayValue('18');
  expect(screen.getByLabelText('Dia de fechamento')).toHaveDisplayValue('6');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ variables: { input: {
    id: 'card', name: 'Principal', financialAccountId: 'invest', brand: 'Bandeira local', creditLimit: '2500.00',
    dueDay: 18, closingDay: 6, dynamicDays: null, businessDays: false, isPrimary: true, archived: false
  } } }));
});

test('blocks editing card registration fields and duplicate saves while saving', async () => {
  let finish!: () => void;
  mockMutate.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  await render(<ThemeProvider><Banking section="cards" /></ThemeProvider>);
  await fireEvent.changeText(screen.getByLabelText('Nome do cartão'), 'Principal');
  await fireEvent.changeText(screen.getByLabelText('Limite'), '2000');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  for (const name of ['Conta financeira', 'Bandeira', 'Aumentar dia de vencimento', 'Salvar']) {
    expect(screen.getByRole('button', { name })).toBeDisabled();
  }
  for (const name of ['Nome do cartão', 'Limite', 'Dia de vencimento']) {
    expect(screen.getByLabelText(name)).toHaveProp('editable', false);
  }
  expect(screen.getByRole('switch', { name: 'Fechamento dinâmico' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  expect(mockMutate).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  await waitFor(() => expect(screen.getByText('Operação concluída.')).toBeOnTheScreen());
});
test('multiple account selection supports specific accounts and all', async () => {
  const changed = jest.fn();
  function Filter() {
    const [ids, setIds] = useState<string[]>([]);
    return <FinancialAccountSelector multiple value={ids} onChange={value => { setIds(value); changed(value); }} />;
  }
  await render(<ThemeProvider><Filter /></ThemeProvider>);
  const selector = screen.getByRole('button', { name: 'Filtrar contas' });
  expect(selector).toHaveProp('accessibilityValue', { text: 'Todas' });
  expect(screen.queryByRole('button', { name: 'Investimentos' })).toBeNull();
  await fireEvent.press(selector);
  await fireEvent.press(screen.getByRole('button', { name: 'Investimentos' }));
  expect(changed).toHaveBeenLastCalledWith(['invest']);
  expect(selector).toHaveProp('accessibilityValue', { text: 'Investimentos' });
  await fireEvent.press(screen.getByRole('button', { name: 'Conta Corrente' }));
  expect(changed).toHaveBeenLastCalledWith(['invest', 'current']);
  expect(selector).toHaveProp('accessibilityValue', { text: '2 selecionadas' });
  await fireEvent.press(screen.getByRole('button', { name: 'Investimentos' }));
  expect(changed).toHaveBeenLastCalledWith(['current']);
  await fireEvent.press(screen.getByRole('button', { name: 'Todas' }));
  expect(changed).toHaveBeenLastCalledWith([]);
  expect(selector).toHaveProp('accessibilityValue', { text: 'Todas' });
  await fireEvent.press(selector);
  expect(screen.queryByRole('button', { name: 'Investimentos' })).toBeNull();
});

test('single account selection shows the default and reveals other accounts on demand', async () => {
  const changed = jest.fn();
  function Account() {
    const [ids, setIds] = useState<string[]>([]);
    return <FinancialAccountSelector value={ids} onChange={value => { setIds(value); changed(value); }} />;
  }
  await render(<ThemeProvider><Account /></ThemeProvider>);
  const selector = screen.getByRole('button', { name: 'Conta financeira' });
  expect(selector).toHaveProp('accessibilityValue', { text: 'Conta Corrente' });
  expect(screen.queryByRole('button', { name: 'Investimentos' })).toBeNull();
  await fireEvent.press(selector);
  await fireEvent.press(screen.getByRole('button', { name: 'Investimentos' }));
  expect(changed).toHaveBeenLastCalledWith(['invest']);
  expect(selector).toHaveProp('accessibilityValue', { text: 'Investimentos' });
  expect(screen.queryByRole('button', { name: 'Conta Corrente' })).toBeNull();
});
