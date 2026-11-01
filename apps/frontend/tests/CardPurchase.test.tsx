import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { CardPurchaseModal } from '../src/components/CardPurchaseForm';
import { ThemeProvider } from '../src/theme/ThemeContext';

const mockMutate = jest.fn();
const mockRefetch = jest.fn();
const mockReload = jest.fn();
const cards = [{ id: 'card', name: 'Principal', brand: 'Visa', archived: false }, { id: 'old', name: 'Arquivado', brand: 'Visa', archived: true }];
const categories = [{ id: 'food', name: 'Alimentação', type: 'EXPENSE' }, { id: 'income', name: 'Salário', type: 'INCOME' }];
let mockData = { myCreditCards: cards, myCategories: categories };
let mockLoading = false;
let mockError: Error | undefined;
let mockSequence = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `operation-${++mockSequence}` }));
jest.mock('@apollo/client/react', () => ({
  useApolloClient: () => ({ mutate: mockMutate, refetchQueries: mockRefetch }),
  useQuery: () => ({ data: mockData, loading: mockLoading, error: mockError, refetch: mockReload })
}));
beforeEach(() => {
  mockData = { myCreditCards: cards, myCategories: categories }; mockLoading = false; mockError = undefined;
  mockMutate.mockReset().mockResolvedValue({ data: { recordCardPurchase: true } });
  mockRefetch.mockReset().mockResolvedValue({}); mockReload.mockReset().mockResolvedValue({});
});
const props = () => ({ onClose: jest.fn(), onRegisterCard: jest.fn(), onCreateCategory: jest.fn() });
async function fill() {
  await fireEvent.press(screen.getByRole('button', { name: 'Cartão' }));
  expect(screen.queryByRole('button', { name: 'Arquivado • Visa' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Principal • Visa' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Categoria' }));
  expect(screen.queryByRole('button', { name: 'Salário' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Alimentação' }));
  await fireEvent.changeText(screen.getByLabelText('Descrição da compra'), 'Mercado');
  await fireEvent.changeText(screen.getByLabelText('Valor total da compra'), '100,50');
  await fireEvent.changeText(screen.getByLabelText('Data da compra'), '31/10/2026');
  await fireEvent.press(screen.getByRole('button', { name: 'Parcelamento' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Parcelar' }));
}
test('sends a card purchase with normalized amount, never an immediate expense', async () => {
  const handlers = props();
  await render(<ThemeProvider><CardPurchaseModal {...handlers} /></ThemeProvider>);
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  expect(screen.queryByLabelText('Total de parcelas')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Arquivado • Visa' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Salário' })).toBeNull();
  await fill();
  await fireEvent.changeText(screen.getByLabelText('Total de parcelas'), '3');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ variables: { input: { cardId: 'card', categoryId: 'food', description: 'Mercado', amount: '100.50', purchasedOn: '2026-10-31', first: 1, total: 3, operationId: expect.any(String) } } }));
  expect(mockRefetch).toHaveBeenCalledWith({ include: 'active' });
  expect(handlers.onClose).toHaveBeenCalledTimes(1);
});
test('preserves data and operation identity on retry, and changes identity for a new payload', async () => {
  mockMutate.mockRejectedValue(new Error('Falha de rede'));
  await render(<ThemeProvider><CardPurchaseModal {...props()} /></ThemeProvider>);
  await fill();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  expect(screen.getByText('Falha de rede')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  expect(mockMutate.mock.calls[0][0].variables.input.operationId).toBe(mockMutate.mock.calls[1][0].variables.input.operationId);
  expect(screen.getByLabelText('Descrição da compra')).toHaveDisplayValue('Mercado');
  await fireEvent.changeText(screen.getByLabelText('Valor total da compra'), '110');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  expect(mockMutate.mock.calls[2][0].variables.input.operationId).not.toBe(mockMutate.mock.calls[0][0].variables.input.operationId);
});
test('rejects impossible dates and inconsistent installment ranges before sending', async () => {
  await render(<ThemeProvider><CardPurchaseModal {...props()} /></ThemeProvider>);
  await fill();
  for (const [label, value, restored] of [['Data da compra', '30/02/2026', '31/10/2026'], ['Parcela inicial', '2', '1'], ['Total de parcelas', '1201', '1']]) {
    await fireEvent.changeText(screen.getByLabelText(label!), value!);
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText(label!), restored!);
  }
  expect(mockMutate).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
});

test('adjusts installments with arrows and returns to a one-time purchase', async () => {
  await render(<ThemeProvider><CardPurchaseModal {...props()} /></ThemeProvider>);
  await fill();
  expect(screen.getByRole('button', { name: 'Cartão' })).toHaveProp('accessibilityValue', { text: 'Principal • Visa' });
  expect(screen.getByRole('button', { name: 'Categoria' })).toHaveProp('accessibilityValue', { text: 'Alimentação' });
  expect(screen.getByRole('button', { name: 'Diminuir parcela inicial' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Aumentar parcela inicial' }));
  expect(screen.getByLabelText('Parcela inicial')).toHaveDisplayValue('2');
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Aumentar total de parcelas' }));
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Diminuir total de parcelas' }));
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Parcelamento' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Não recorrente' }));
  expect(screen.queryByLabelText('Parcela inicial')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ variables: { input: expect.objectContaining({ first: 1, total: 1, purchasedOn: '2026-10-31' }) } }));
});
test('blocks dismissal and double submissions while saving', async () => {
  let finish!: () => void;
  mockMutate.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  const handlers = props();
  await render(<ThemeProvider><CardPurchaseModal {...handlers} /></ThemeProvider>);
  await fill();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  for (const label of ['Cartão', 'Categoria', 'Parcelamento', 'Aumentar total de parcelas']) {
    expect(screen.getByRole('button', { name: label })).toBeDisabled();
  }
  expect(screen.getByLabelText('Data da compra')).toHaveProp('editable', false);
  expect(screen.getByLabelText('Parcela inicial')).toHaveProp('editable', false);
  expect(screen.getByRole('button', { name: 'Abrir calendário' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Fechar modal' }));
  expect(handlers.onClose).not.toHaveBeenCalled();
  expect(mockMutate).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  await waitFor(() => expect(handlers.onClose).toHaveBeenCalledTimes(1));
});
test('offers setup routes when no usable cards or categories exist', async () => {
  mockData = { myCreditCards: [cards[1]!], myCategories: [] };
  const handlers = props();
  await render(<ThemeProvider><CardPurchaseModal {...handlers} /></ThemeProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Cadastrar cartão' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Criar categoria' }));
  expect(handlers.onRegisterCard).toHaveBeenCalledTimes(1);
  expect(handlers.onCreateCategory).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
  expect(mockMutate).not.toHaveBeenCalled();
});
test('shows query errors and allows reloading context', async () => {
  mockError = new Error('offline');
  await render(<ThemeProvider><CardPurchaseModal {...props()} /></ThemeProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(mockReload).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText('Descrição da compra')).toBeNull();
});
