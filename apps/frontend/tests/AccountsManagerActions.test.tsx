import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { AccountsManager } from '../src/components/AccountsManager';
import { ThemeProvider } from '../src/theme/ThemeContext';

const mockSettle = jest.fn();
const mockDelete = jest.fn();
let mockDesktop = false;
let mockMutationLoading = false;

jest.mock('../src/theme/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: mockDesktop, isMobile: !mockDesktop, width: mockDesktop ? 1280 : 390, height: 900 })
}));

jest.mock('@apollo/client/react', () => ({
  useQuery: () => ({
    data: {
      myAccountsPayable: [{ id: 'payable-1', description: 'Conta pendente', amount: '100', dueDate: '2026-10-30', status: 'PENDING' }],
      myAccountsReceivable: [{ id: 'receivable-1', description: 'Conta pendente', amount: '100', dueDate: '2026-10-30', status: 'PENDING' }],
      myCategories: [], myCostCenters: []
    },
    loading: false, refetch: jest.fn()
  }),
  useMutation: (document: { definitions: Array<{ name?: { value: string } }> }) => {
    const name = document.definitions[0]?.name?.value ?? '';
    if (name.startsWith('MarkAccount')) return [mockSettle, { loading: mockMutationLoading }];
    if (name.startsWith('DeleteAccount')) return [mockDelete, { loading: false }];
    return [jest.fn(), { loading: false }];
  }
}));

function Wrapper({ children }: PropsWithChildren) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe.each([
  { tab: 'PAYABLE' as const, verb: 'pago', field: 'paidAt', id: 'payable-1', newLabel: 'Nova Conta a Pagar', saveLabel: 'Agendar Conta a Pagar' },
  { tab: 'RECEIVABLE' as const, verb: 'recebida', field: 'receivedAt', id: 'receivable-1', newLabel: 'Nova Conta a Receber', saveLabel: 'Agendar Conta a Receber' }
])('$tab actions', ({ tab, verb, field, id, newLabel, saveLabel }) => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockDesktop = false;
    mockMutationLoading = false;
  });

  test.each([false, true])('blocks repeated settlement and unlocks after success (desktop=%s)', async (desktop) => {
    mockDesktop = desktop;
    let resolveSettlement!: () => void;
    mockSettle.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveSettlement = resolve; }));
    await render(<AccountsManager initialTab={tab} />, { wrapper: Wrapper });
    const label = `Marcar Conta pendente como ${verb}`;
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(screen.getByRole('button', { name: label })).toBeDisabled();
    expect(screen.getByRole('button', { name: label }).props.accessibilityState.busy).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(mockSettle).toHaveBeenCalledTimes(1);
    expect(mockSettle).toHaveBeenCalledWith({ variables: { id, [field]: expect.any(String) } });
    await act(async () => { resolveSettlement(); });
    expect(screen.getByRole('button', { name: label })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(mockSettle).toHaveBeenCalledTimes(2);
  });

  test.each([false, true])('shows settlement failure outside modal and allows retry (desktop=%s)', async (desktop) => {
    mockDesktop = desktop;
    mockSettle.mockRejectedValueOnce(new Error('Falha ao dar baixa'));
    await render(<AccountsManager initialTab={tab} />, { wrapper: Wrapper });
    const label = `Marcar Conta pendente como ${verb}`;
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao dar baixa');
    expect(screen.queryByRole('button', { name: saveLabel })).toBeNull();
    expect(screen.getByRole('button', { name: label })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(mockSettle).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Falha ao dar baixa')).toBeNull();
  });

  test('honors mutation loading before a local action starts', async () => {
    mockMutationLoading = true;
    await render(<AccountsManager initialTab={tab} />, { wrapper: Wrapper });
    const button = screen.getByRole('button', { name: `Marcar Conta pendente como ${verb}` });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(mockSettle).not.toHaveBeenCalled();
  });

  test('keeps deletion failure separate from form errors', async () => {
    mockDelete.mockRejectedValueOnce(new Error('Falha ao excluir'));
    await render(<AccountsManager initialTab={tab} />, { wrapper: Wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir Conta pendente' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao excluir');
    await fireEvent.press(screen.getByRole('button', { name: newLabel }));
    await fireEvent.press(screen.getByRole('switch', { name: 'Já efetivada' }));
    await fireEvent.press(screen.getByRole('button', { name: saveLabel }));
    expect(screen.getByRole('button', { name: saveLabel })).toBeDisabled();
    expect(screen.getByText('Falha ao excluir')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir Conta pendente' }));
    expect(screen.queryByText('Falha ao excluir')).toBeNull();
  });
});
