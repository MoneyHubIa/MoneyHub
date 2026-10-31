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
  await fireEvent.press(screen.getByRole('button', { name: 'Principal • Visa' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Alimentação' }));
  await fireEvent.changeText(screen.getByLabelText('Descrição da compra'), 'Mercado');
  await fireEvent.changeText(screen.getByLabelText('Valor total da compra'), '100,50');
  await fireEvent.changeText(screen.getByLabelText('Data da compra (YYYY-MM-DD)'), '2026-10-31');
}
test('sends a card purchase with normalized amount, never an immediate expense', async () => {
  const handlers = props();
  await render(<ThemeProvider><CardPurchaseModal {...handlers} /></ThemeProvider>);
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
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
  for (const [label, value] of [['Data da compra (YYYY-MM-DD)', '2026-02-30'], ['Parcela inicial', '2'], ['Total de parcelas', '1201']]) {
    await fireEvent.changeText(screen.getByLabelText(label!), value!);
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  }
  expect(mockMutate).not.toHaveBeenCalled();
});
test('blocks dismissal and double submissions while saving', async () => {
  let finish!: () => void;
  mockMutate.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  const handlers = props();
  await render(<ThemeProvider><CardPurchaseModal {...handlers} /></ThemeProvider>);
  await fill();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
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
