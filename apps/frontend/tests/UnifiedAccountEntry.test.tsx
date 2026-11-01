import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccountsManager, type AccountsTab } from '../src/components/AccountsManager';
import { ThemeProvider } from '../src/theme/ThemeContext';

const mockSave = jest.fn();
const mockClose = jest.fn();
const mockRefetch = jest.fn();
let mockCurrency = 'BRL';
jest.mock('expo-crypto', () => ({ randomUUID: () => '11111111-1111-4111-8111-111111111111' }));
jest.mock('@apollo/client/react', () => ({
  useQuery: () => ({ data: {
    myAccountsPayable: [], myAccountsReceivable: [], myCostCenters: [{ id: 'center', name: 'Centro financeiro' }],
    myProfile: { id: 'profile', preferredCurrency: mockCurrency },
    myCategories: [
      { id: 'common', name: 'Categoria comum', type: 'BOTH', color: '#008866' },
      { id: 'income', name: 'Categoria receita', type: 'INCOME', color: '#008866' },
      { id: 'expense', name: 'Categoria despesa', type: 'EXPENSE', color: '#008866' }
    ],
    myFinancialAccounts: [{ id: 'bank', name: 'Banco', isDefault: true, archived: false }]
  }, loading: false, refetch: mockRefetch }),
  useMutation: (document: { definitions: Array<{ name: { value: string } }> }, options?: { onCompleted?: () => void; onError?: (error: Error) => void }) => [
    async (variables: unknown) => {
      try {
        const result = await mockSave(document.definitions[0]!.name.value, variables);
        options?.onCompleted?.();
        return result;
      } catch (error) {
        options?.onError?.(error as Error);
        throw error;
      }
    }, { loading: false }
  ]
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockResolvedValue({ data: {} });
  mockCurrency = 'BRL';
});

async function open(tab: AccountsTab) {
  await render(<ThemeProvider><AccountsManager initialTab={tab} modalOnly onClose={mockClose} /></ThemeProvider>);
  const kind = tab === 'PAYABLE' ? 'pagar' : 'receber';
  await fireEvent.changeText(screen.getByLabelText(`Descrição da conta a ${kind}`), 'Lançamento unificado');
  await fireEvent.changeText(screen.getByLabelText(`Valor da conta a ${kind}`), '100,01');
  await fireEvent.changeText(screen.getByLabelText('Data do lançamento'), '15/11/2026');
  const category = screen.getByRole('button', { name: 'Categoria' });
  expect(screen.queryByRole('button', { name: 'Categoria comum' })).toBeNull();
  await fireEvent.press(category);
  expect(screen.queryByRole('button', { name: tab === 'PAYABLE' ? 'Categoria receita' : 'Categoria despesa' })).toBeNull();
  expect(screen.getByRole('button', { name: tab === 'PAYABLE' ? 'Categoria despesa' : 'Categoria receita' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Categoria comum' }));
  expect(category).toHaveProp('accessibilityValue', { text: 'Categoria comum' });
  expect(category).toHaveProp('accessibilityState', expect.objectContaining({ expanded: false }));
  expect(screen.queryByRole('button', { name: 'Categoria comum' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Banco' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Centro financeiro' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Parcelar ou Repetir' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Conta financeira' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Banco' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Centro de Custo' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Centro financeiro' }));
}

describe.each(['PAYABLE', 'RECEIVABLE'] as const)('unified %s entry', tab => {
  const payable = tab === 'PAYABLE';
  const directLabel = payable ? 'Registrar pagamento' : 'Registrar recebimento';
  const pendingLabel = payable ? 'Agendar Conta a Pagar' : 'Agendar Conta a Receber';

  test('preserves the default calendar day when profile currency loads in USD', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-01T12:00:00.000Z'));
    try {
      mockCurrency = 'USD';
      await render(<ThemeProvider><AccountsManager initialTab={tab} modalOnly /></ThemeProvider>);
      expect(screen.getByLabelText('Data do lançamento')).toHaveProp('value', '11/01/2026');
    } finally {
      jest.useRealTimers();
    }
  });

  test('defaults to a direct movement with the entered date and no account or series', async () => {
    await open(tab);
    expect(screen.getByRole('switch', { name: 'Já efetivada' })).toHaveProp('accessibilityState', { checked: true, disabled: false });
    expect(screen.queryByLabelText('Data de efetivação (YYYY-MM-DD)')).toBeNull();
    expect(screen.queryByText('Lembrete de Vencimento')).toBeNull();
    expect(screen.queryByRole('button', { name: payable ? 'Categoria receita' : 'Categoria despesa' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: directLabel }));
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith(payable ? 'CreateExpense' : 'CreateIncome', { variables: { input: {
      description: 'Lançamento unificado', amount: '100.01', occurredAt: '2026-11-15T00:00:00.000Z',
      categoryId: 'common', financialAccountId: 'bank', costCenterId: 'center'
    } } });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  test('can change the category from the selector before saving', async () => {
    await open(tab);
    await fireEvent.press(screen.getByRole('button', { name: 'Categoria' }));
    expect(screen.getByRole('button', { name: 'Categoria comum' })).toHaveProp('accessibilityState', { selected: true });
    const label = payable ? 'Categoria despesa' : 'Categoria receita';
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(screen.getByRole('button', { name: 'Categoria' })).toHaveProp('accessibilityValue', { text: label });
    await fireEvent.press(screen.getByRole('button', { name: directLabel }));
    expect(mockSave.mock.calls[0]![1].variables.input.categoryId).toBe(payable ? 'expense' : 'income');
  });

  test('can keep a single entry pending without creating a movement', async () => {
    await open(tab);
    await fireEvent.press(screen.getByRole('switch', { name: 'Já efetivada' }));
    expect(screen.getByLabelText('Vencimento')).toHaveProp('value', '15/11/2026');
    await fireEvent.press(screen.getByRole('button', { name: '3 dias antes' }));
    await fireEvent.press(screen.getByRole('button', { name: pendingLabel }));
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith(payable ? 'CreateAccountPayable' : 'CreateAccountReceivable', expect.objectContaining({ variables: { input: expect.objectContaining({ dueDate: '2026-11-15T00:00:00.000Z', reminderOffsetDays: 3 }) } }));
  });

  test.each([['Parcelar ou Repetir', 'INSTALLMENTS', false], ['Fixa mensal', 'FIXED', false], ['Parcelar ou Repetir', 'INSTALLMENTS', true], ['Fixa mensal', 'FIXED', true]] as const)('creates %s as commitments (effective=%s)', async (label, mode, effective) => {
    await open(tab);
    await fireEvent.press(screen.getByRole('button', { name: 'Parcelamento' }));
    expect(screen.queryByRole('button', { name: 'Repetir' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(screen.getByRole('switch', { name: 'Já efetivada' })).toHaveProp('accessibilityState', { checked: false, disabled: false });
    if (effective) await fireEvent.press(screen.getByRole('switch', { name: 'Já efetivada' }));
    if (mode !== 'FIXED') await fireEvent.changeText(screen.getByLabelText('Total de parcelas'), '3');
    await fireEvent.press(screen.getByRole('button', { name: pendingLabel }));
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith('CreateCommitmentSeries', { variables: { input: expect.objectContaining({
      type: payable ? 'EXPENSE' : 'INCOME', schedule: expect.objectContaining({ mode, total: mode === 'FIXED' ? 12 : 3 })
    }) } });
    if (effective) expect(mockSave.mock.calls[0]![1].variables.input.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    else expect(mockSave.mock.calls[0]![1].variables.input).not.toHaveProperty('effectiveDate');
  });

  test('allows typing and stepping installment counts without changing the other field', async () => {
    await open(tab);
    await fireEvent.press(screen.getByRole('button', { name: 'Parcelamento' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Parcelar ou Repetir' }));

    for (const label of ['Parcela inicial', 'Total de parcelas']) {
      const field = screen.getByLabelText(label);
      const increase = screen.getByRole('button', { name: `Aumentar ${label.toLowerCase()}` });
      const decrease = screen.getByRole('button', { name: `Diminuir ${label.toLowerCase()}` });
      expect(field).toHaveProp('keyboardType', 'number-pad');
      expect(decrease).toBeDisabled();
      await fireEvent.press(decrease);
      expect(field).toHaveDisplayValue('1');
      await fireEvent.press(increase);
      expect(field).toHaveDisplayValue('2');
      await fireEvent.press(decrease);
      expect(field).toHaveDisplayValue('1');
      await fireEvent.changeText(field, '12');
      await fireEvent.changeText(field, '1.5');
      expect(field).toHaveDisplayValue('12');
      await fireEvent.changeText(field, '1200');
      expect(increase).toBeDisabled();
      await fireEvent.press(increase);
      expect(field).toHaveDisplayValue('1200');
      await fireEvent.press(decrease);
      expect(field).toHaveDisplayValue('1199');
      await fireEvent.changeText(field, '1201');
      expect(screen.getByRole('button', { name: pendingLabel })).toBeDisabled();
      for (const button of [increase, decrease]) {
        await fireEvent.changeText(field, '');
        expect(field).toHaveDisplayValue('');
        await fireEvent.press(button);
        expect(field).toHaveDisplayValue('1');
      }
    }

    await fireEvent.press(screen.getByRole('button', { name: 'Aumentar parcela inicial' }));
    expect(screen.getByLabelText('Total de parcelas')).toHaveDisplayValue('1');
    expect(screen.getByRole('button', { name: pendingLabel })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: pendingLabel }));
    expect(mockSave).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Aumentar total de parcelas' }));
    expect(screen.getByLabelText('Parcela inicial')).toHaveDisplayValue('2');
    expect(screen.getByRole('button', { name: pendingLabel })).toBeEnabled();
  });

  test.each([
    ['Diário', 'DAILY'], ['Semanal', 'WEEKLY'], ['Mensal', 'MONTHLY'],
    ['Trimestral', 'QUARTERLY'], ['Anual', 'YEARLY'], ['Personalizar', 'CUSTOM']
  ])('saves the %s frequency selected from the box', async (label, frequency) => {
    await open(tab);
    await fireEvent.press(screen.getByRole('button', { name: 'Parcelamento' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Parcelar ou Repetir' }));
    await fireEvent.changeText(screen.getByLabelText('Total de parcelas'), '3');
    const selector = screen.getByRole('button', { name: 'Frequência' });
    expect(selector).toHaveProp('accessibilityValue', { text: 'Mensal' });
    expect(selector).toHaveProp('accessibilityState', expect.objectContaining({ expanded: false }));
    expect(screen.queryByRole('button', { name: label })).toBeNull();
    await fireEvent.press(selector);
    expect(selector).toHaveProp('accessibilityState', expect.objectContaining({ expanded: true }));
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(selector).toHaveProp('accessibilityValue', { text: label });
    expect(selector).toHaveProp('accessibilityState', expect.objectContaining({ expanded: false }));
    expect(screen.queryByRole('button', { name: label })).toBeNull();
    if (frequency === 'CUSTOM') {
      await fireEvent.changeText(screen.getByLabelText('Intervalo'), '2');
      await fireEvent.press(screen.getByRole('button', { name: 'Semanas' }));
    } else {
      expect(screen.queryByLabelText('Intervalo')).toBeNull();
    }
    await fireEvent.press(screen.getByRole('button', { name: pendingLabel }));
    expect(mockSave).toHaveBeenCalledWith('CreateCommitmentSeries', { variables: { input: expect.objectContaining({
      type: payable ? 'EXPENSE' : 'INCOME',
      schedule: { mode: 'INSTALLMENTS', first: 1, total: 3, frequency, interval: frequency === 'CUSTOM' ? 2 : 1, unit: frequency === 'CUSTOM' ? 'WEEKS' : 'MONTHS' }
    }) } });
  });

  test('switching back to nonrecurring restores direct entry and discards installment overrides', async () => {
    await open(tab);
    await fireEvent.press(screen.getByRole('button', { name: 'Parcelamento' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Parcelar ou Repetir' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Parcelamento' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Não recorrente' }));
    expect(screen.getByRole('button', { name: directLabel })).toBeEnabled();
    expect(screen.queryByText('Lembrete de Vencimento')).toBeNull();
  });

  test('can clear an optional cost center before saving', async () => {
    await open(tab);
    expect(screen.getByRole('button', { name: 'Centro de Custo' })).toHaveProp('accessibilityValue', { text: 'Centro financeiro' });
    await fireEvent.press(screen.getByRole('button', { name: 'Centro de Custo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Nenhum' }));
    expect(screen.queryByRole('button', { name: 'Centro financeiro' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: directLabel }));
    expect(mockSave.mock.calls[0]![1].variables.input.costCenterId).toBeUndefined();
  });

  test('retains fields on failure and prevents duplicate submissions while saving', async () => {
    await open(tab);
    mockSave.mockRejectedValueOnce(new Error('Falha simulada'));
    await fireEvent.press(screen.getByRole('button', { name: directLabel }));
    expect(mockClose).not.toHaveBeenCalled();
    expect(screen.getByText('Falha simulada')).toBeOnTheScreen();
    expect(screen.getByLabelText(`Descrição da conta a ${payable ? 'pagar' : 'receber'}`)).toHaveProp('value', 'Lançamento unificado');
    let finish!: () => void;
    mockSave.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({ data: {} }); }));
    await fireEvent.press(screen.getByRole('button', { name: directLabel }));
    expect(screen.getByRole('button', { name: directLabel })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: directLabel }));
    expect(mockSave).toHaveBeenCalledTimes(2);
    await act(async () => finish());
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
