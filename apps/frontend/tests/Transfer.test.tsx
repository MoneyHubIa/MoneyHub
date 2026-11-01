import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { TransferModal } from '../src/components/TransferForm';
import { ThemeProvider } from '../src/theme/ThemeContext';

const mockMutate = jest.fn();
const mockRefetch = jest.fn();
const mockReload = jest.fn();
const accounts = [
  { id: 'current', name: 'Conta Corrente', isDefault: true, archived: false },
  { id: 'reserve', name: 'Reserva', isDefault: false, archived: false },
  { id: 'old', name: 'Arquivada', isDefault: true, archived: true }
].map(account => ({ ...account, type: 'CHECKING', accountNumber: null, additionalData: null, initialBalance: '0.00', balance: '100.00' }));
let mockAccounts = accounts;
let mockLoading = false;
let mockError: Error | undefined;
let mockSequence = 0;

jest.mock('expo-crypto', () => ({ randomUUID: () => `transfer-${++mockSequence}` }));
jest.mock('@apollo/client/react', () => ({
  useApolloClient: () => ({ mutate: mockMutate, refetchQueries: mockRefetch }),
  useQuery: () => ({ data: { myFinancialAccounts: mockAccounts }, loading: mockLoading, error: mockError, refetch: mockReload })
}));

beforeEach(() => {
  mockAccounts = accounts;
  mockLoading = false;
  mockError = undefined;
  mockSequence = 0;
  mockMutate.mockReset().mockResolvedValue({ data: { createTransfer: { id: 'transfer' } } });
  mockRefetch.mockReset().mockResolvedValue({});
  mockReload.mockReset().mockResolvedValue({});
});

async function fill() {
  expect(screen.getByRole('button', { name: 'Conta de origem' })).toHaveProp('accessibilityValue', { text: 'Conta Corrente' });
  await fireEvent.press(screen.getByRole('button', { name: 'Conta destino' }));
  expect(screen.queryByRole('button', { name: 'Arquivada' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Reserva' }));
  await fireEvent.changeText(screen.getByLabelText('Valor'), '25,50');
  await fireEvent.changeText(screen.getByLabelText('Data prevista'), '15/11/2026');
}

test.each([false, true])('creates a transfer between active accounts (effective=%s)', async effective => {
  const close = jest.fn();
  await render(<ThemeProvider><TransferModal onClose={close} /></ThemeProvider>);
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  expect(screen.getByRole('switch', { name: 'Já efetivada' })).toHaveProp('accessibilityState', { checked: false, disabled: false });
  await fill();
  if (effective) await fireEvent.press(screen.getByRole('switch', { name: 'Já efetivada' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  expect(mockMutate).toHaveBeenCalledTimes(1);
  const request = mockMutate.mock.calls[0]![0];
  expect(request.mutation.definitions[0].name.value).toBe('Transfer');
  expect(request.variables.input).toEqual({
    sourceId: 'current', destinationId: 'reserve', amount: '25.50', dueDate: '2026-11-15',
    operationId: expect.any(String), ...(effective ? { effectiveDate: '2026-11-15' } : {})
  });
  expect(mockRefetch).toHaveBeenCalledWith({ include: 'active' });
  expect(close).toHaveBeenCalledTimes(1);
});

test('blocks equal accounts, zero amounts and impossible dates', async () => {
  await render(<ThemeProvider><TransferModal onClose={jest.fn()} /></ThemeProvider>);
  await fill();
  await fireEvent.press(screen.getByRole('button', { name: 'Conta destino' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Conta Corrente' }));
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Conta destino' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Reserva' }));
  await fireEvent.changeText(screen.getByLabelText('Valor'), '0');
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  await fireEvent.changeText(screen.getByLabelText('Valor'), '25,50');
  await fireEvent.changeText(screen.getByLabelText('Data prevista'), '30/02/2026');
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  expect(mockMutate).not.toHaveBeenCalled();
});

test('retains input and operation identity on failure and uses a new identity after editing', async () => {
  mockMutate.mockRejectedValue(new Error('Falha de rede'));
  const close = jest.fn();
  await render(<ThemeProvider><TransferModal onClose={close} /></ThemeProvider>);
  await fill();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Falha de rede');
  expect(screen.getByLabelText('Valor')).toHaveDisplayValue('25,50');
  expect(screen.getByLabelText('Data prevista')).toHaveDisplayValue('15/11/2026');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  expect(mockMutate.mock.calls[1]![0].variables.input.operationId).toBe(mockMutate.mock.calls[0]![0].variables.input.operationId);
  await fireEvent.changeText(screen.getByLabelText('Valor'), '30');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  expect(mockMutate.mock.calls[2]![0].variables.input.operationId).not.toBe(mockMutate.mock.calls[0]![0].variables.input.operationId);
  expect(close).not.toHaveBeenCalled();
});

test('blocks repeated submissions, edits and dismissal while saving', async () => {
  let finish!: () => void;
  mockMutate.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  const close = jest.fn();
  await render(<ThemeProvider><TransferModal onClose={close} /></ThemeProvider>);
  await fill();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  for (const name of ['Conta de origem', 'Conta destino', 'Abrir calendário', 'Cancelar']) {
    expect(screen.getByRole('button', { name })).toBeDisabled();
  }
  expect(screen.getByLabelText('Valor')).toHaveProp('editable', false);
  expect(screen.getByLabelText('Data prevista')).toHaveProp('editable', false);
  expect(screen.getByRole('switch', { name: 'Já efetivada' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Fechar modal' }));
  expect(close).not.toHaveBeenCalled();
  expect(mockMutate).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
});

test('shows account query failures and allows retrying', async () => {
  mockError = new Error('offline');
  await render(<ThemeProvider><TransferModal onClose={jest.fn()} /></ThemeProvider>);
  expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar contas financeiras.');
  expect(screen.queryByLabelText('Valor')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(mockReload).toHaveBeenCalledTimes(1);
});

test('waits for account loading before displaying the form', async () => {
  mockLoading = true;
  await render(<ThemeProvider><TransferModal onClose={jest.fn()} /></ThemeProvider>);
  expect(screen.getByLabelText('Carregando contas financeiras')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Valor')).toBeNull();
});

test.each([0, 1])('blocks saving with %s active accounts', async count => {
  mockAccounts = accounts.slice(0, count);
  await render(<ThemeProvider><TransferModal onClose={jest.fn()} /></ThemeProvider>);
  expect(screen.getByText('Cadastre pelo menos duas contas financeiras ativas para transferir.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
  expect(mockMutate).not.toHaveBeenCalled();
});
