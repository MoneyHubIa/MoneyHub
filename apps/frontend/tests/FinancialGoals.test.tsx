import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { FinancialGoals } from '../src/components/FinancialGoals';

const mockCreate = jest.fn(), mockUpdate = jest.fn(), mockRecord = jest.fn(), mockDelete = jest.fn();
const mockRefresh = jest.fn(), mockRefetch = jest.fn(), mockHistoryRefetch = jest.fn();
let mockLoading = false, mockError: Error | undefined;
const goal = { id: 'goal-1', name: 'Reserva', description: 'Emergências', targetAmount: '1000.00', accumulatedAmount: '250.00', remainingAmount: '750.00', progress: 25, status: 'ACTIVE', startDate: '2026-01-01', deadline: '2027-01-01' };
let mockGoals: typeof goal[] = [];
let mockHistory: { nodes: Array<{id: string; type: string; amount: string; occurredOn: string; notes: string | null}>; hasNextPage: boolean; endCursor: string | null };
jest.mock('@apollo/client/react', () => ({
  useApolloClient: () => ({ refetchQueries: mockRefresh }),
  useQuery: (document: { definitions: Array<{ name: { value: string } }> }) => document.definitions[0]!.name.value === 'FinancialGoal'
    ? { data: { financialGoal: { movements: mockHistory } }, loading: false, refetch: mockHistoryRefetch, error: undefined }
    : { data: { myFinancialGoals: mockGoals, financialGoalsSummary: { count: mockGoals.length, totalAccumulated: '250.00', totalTarget: '1000.00' } }, loading: mockLoading, error: mockError, refetch: mockRefetch },
  useMutation: (document: { definitions: Array<{ name: { value: string } }> }) => [{
    CreateFinancialGoal: mockCreate, UpdateFinancialGoal: mockUpdate,
    RecordFinancialGoalMovement: mockRecord, DeleteFinancialGoal: mockDelete
  }[document.definitions[0]!.name.value], { loading: false }]
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => '11111111-1111-4111-8111-111111111111' }));

describe('FinancialGoals', () => {
  beforeEach(() => {
    jest.clearAllMocks(); mockGoals = [{ ...goal }]; mockLoading = false; mockError = undefined;
    mockHistory = { nodes: [{ id: 'm1', type: 'CONTRIBUTION', amount: '250.00', occurredOn: '2026-02-01', notes: 'Primeiro' }], hasNextPage: true, endCursor: 'm1' };
    for (const fn of [mockCreate, mockUpdate, mockRecord, mockDelete, mockRefresh, mockRefetch, mockHistoryRefetch]) fn.mockResolvedValue({});
  });

  test('shows progress, filters and overfunding with visual bar capped at 100%', async () => {
    mockGoals.push({ ...goal, id: 'g2', name: 'Viagem', progress: 125, status: 'COMPLETED' });
    await render(<FinancialGoals preferredCurrency="BRL" />);
    expect(screen.getByText('25%')).toBeOnTheScreen();
    expect(screen.getByText('125%')).toBeOnTheScreen();
    expect(screen.getByLabelText('Progresso de Viagem').props.accessibilityValue.now).toBe(100);
    await fireEvent.press(screen.getByRole('button', { name: 'Concluídas' }));
    expect(screen.queryByText('Reserva')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Atrasadas' }));
    expect(screen.getByText('Nenhuma meta neste filtro.')).toBeOnTheScreen();
  });

  test('creates and edits validated decimal and regional date inputs', async () => {
    await render(<FinancialGoals preferredCurrency="BRL" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Nova meta' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar meta' }));
    expect(mockCreate).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Nome da meta'), '  Casa  ');
    await fireEvent.changeText(screen.getByLabelText('Valor-alvo'), '1000,00');
    await fireEvent.changeText(screen.getByLabelText('Início da meta'), '01/01/2026');
    await fireEvent.changeText(screen.getByLabelText('Prazo da meta'), '01/01/2027');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar meta' }));
    expect(mockCreate).toHaveBeenCalledWith({ variables: { input: { name: 'Casa', description: null, targetAmount: '1000.00', startDate: '2026-01-01', deadline: '2027-01-01' } } });
    expect(mockRefresh).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Editar meta Reserva'));
    await fireEvent.changeText(screen.getByLabelText('Nome da meta'), 'Reserva nova');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar meta' }));
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ variables: { input: expect.objectContaining({ id: 'goal-1', name: 'Reserva nova' }) } }));
  });

  test('records contribution, retains operation on retry, refreshes progress and history', async () => {
    mockRecord.mockRejectedValueOnce(new Error('Falha de rede'));
    await render(<FinancialGoals preferredCurrency="USD" />);
    await fireEvent.press(screen.getByLabelText('Aportar em Reserva'));
    await fireEvent.changeText(screen.getByLabelText('Valor do movimento'), '50.00');
    await fireEvent.changeText(screen.getByLabelText('Data do movimento'), '02/01/2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Registrar aporte' }));
    expect(screen.getByText('Falha de rede')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Registrar aporte' }));
    expect(mockRecord.mock.calls[0][0]).toEqual(mockRecord.mock.calls[1][0]);
    expect(mockRecord.mock.calls[0][0].variables.input.occurredOn).toBe('2026-02-01');
    await fireEvent.press(screen.getByLabelText('Histórico de Reserva'));
    expect(screen.getByText('Primeiro')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Próxima página' }));
    await waitFor(() => expect(mockHistoryRefetch).toHaveBeenCalledWith({ id: 'goal-1', after: 'm1' }));
  });

  test('withdraws, reports errors, confirms deletion and prevents duplicate submit', async () => {
    await render(<FinancialGoals preferredCurrency="BRL" />);
    await fireEvent.press(screen.getByLabelText('Retirar de Reserva'));
    await fireEvent.changeText(screen.getByLabelText('Valor do movimento'), '50');
    let resolve: (value: object) => void = () => {};
    mockRecord.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    await fireEvent.press(screen.getByRole('button', { name: 'Registrar retirada' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Registrar retirada' }));
    expect(mockRecord).toHaveBeenCalledTimes(1);
    await act(() => resolve({}));
    expect(mockRecord.mock.calls[0][0].variables.input.type).toBe('WITHDRAWAL');
    await fireEvent.press(screen.getByLabelText('Excluir meta Reserva'));
    expect(mockDelete).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar exclusão' }));
    expect(mockDelete).toHaveBeenCalledWith({ variables: { id: 'goal-1' } });
  });

  test('empty, loading and query errors with retry', async () => {
    mockGoals = []; mockLoading = true;
    const view = await render(<FinancialGoals />);
    expect(screen.getByLabelText('Carregando metas')).toBeOnTheScreen();
    mockLoading = false; mockError = new Error('Offline');
    await view.rerender(<FinancialGoals />);
    expect(screen.getByText('Não foi possível carregar metas.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(mockRefetch).toHaveBeenCalled();
    mockError = undefined;
    await view.rerender(<FinancialGoals />);
    expect(screen.getByText('Crie sua primeira meta financeira.')).toBeOnTheScreen();
  });

  test('rejects invalid values and dates, cancels forms and displays mutation errors', async () => {
    await render(<FinancialGoals />);
    await fireEvent.press(screen.getByLabelText('Editar meta Reserva'));
    await fireEvent.changeText(screen.getByLabelText('Valor-alvo'), '1.001');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar meta' }));
    expect(screen.getByText('Informe valor positivo com até duas casas decimais.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Valor-alvo'), '1000');
    await fireEvent.changeText(screen.getByLabelText('Prazo da meta'), '30/02/2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar meta' }));
    expect(screen.getByText('Informe data válida.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Prazo da meta'), '31/12/2025');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar meta' }));
    expect(screen.getByText('Prazo não pode anteceder início.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Prazo da meta'), '01/01/2027');
    mockUpdate.mockRejectedValueOnce(new Error('Meta indisponível'));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar meta' }));
    expect(screen.getByText('Meta indisponível')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Nome da meta')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Excluir meta Reserva'));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar exclusão' }));
    expect(mockDelete).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Retirar de Reserva'));
    await fireEvent.changeText(screen.getByLabelText('Valor do movimento'), '999');
    mockRecord.mockRejectedValueOnce(new Error('Insufficient goal balance.'));
    await fireEvent.press(screen.getByRole('button', { name: 'Registrar retirada' }));
    expect(screen.getByText('Insufficient goal balance.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Valor do movimento')).toBeNull();
  });

  test('reports refresh failure after successful save and retries history errors', async () => {
    mockRefresh.mockRejectedValueOnce(new Error('Offline'));
    await render(<FinancialGoals />);
    await fireEvent.press(screen.getByLabelText('Editar meta Reserva'));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar meta' }));
    expect(screen.queryByLabelText('Nome da meta')).toBeNull();
    expect(screen.getByText('Registro salvo. Atualização falhou; tente carregar novamente.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(mockRefetch).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Histórico de Reserva'));
    mockHistoryRefetch.mockRejectedValueOnce(new Error('Offline'));
    await fireEvent.press(screen.getByRole('button', { name: 'Próxima página' }));
    expect(screen.getByText('Não foi possível carregar histórico.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar histórico novamente' }));
    expect(mockHistoryRefetch).toHaveBeenLastCalledWith({ id: 'goal-1', after: 'm1' });
    await fireEvent.press(screen.getByRole('button', { name: 'Próxima página' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Primeira página' }));
    expect(mockHistoryRefetch).toHaveBeenLastCalledWith({ id: 'goal-1', after: null });
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar histórico' }));
    expect(screen.queryByText('Primeiro')).toBeNull();
  });

  test('refreshes only goals, history, dashboard and AI observed queries', async () => {
    await render(<FinancialGoals />);
    await fireEvent.press(screen.getByLabelText('Editar meta Reserva'));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar meta' }));
    const options = mockRefresh.mock.calls[0][0];
    const refresh = jest.fn().mockResolvedValue({});
    for (const queryName of ['MyFinancialGoals', 'FinancialGoal', 'DashboardSummary', 'AiFinancialContext']) {
      await options.onQueryUpdated({ queryName, refetch: refresh });
    }
    expect(refresh).toHaveBeenCalledTimes(4);
    expect(options.onQueryUpdated({ queryName: 'MyIncomes', refetch: refresh })).toBe(false);
  });
});
