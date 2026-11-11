import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { BankStatementImport } from '../src/components/BankStatementImport';
import { defaultStatementDecision, limitStatementDescription, statementDecisionIssues, statementReviewTotals, validStatementDecision, type StatementBatch, type StatementRow } from '../src/services/bank-statement-imports';

const mockMutate = jest.fn();
const mockQuery = jest.fn();
const mockRefetchQueries = jest.fn();
const mockPickFile = jest.fn();
const mockClose = jest.fn();
jest.mock('../src/services/bank-statement-file', () => ({ pickStatementFile: () => mockPickFile() }));
jest.mock('@apollo/client/react', () => ({
  useApolloClient: () => ({ mutate: mockMutate, query: mockQuery, refetchQueries: mockRefetchQueries }),
  useQuery: () => ({ loading: false, data: {
    myProfile: { id: 'profile' },
    myFinancialAccounts: [{ id: 'bank', name: 'Banco', isDefault: true, archived: false }, { id: 'other', name: 'Poupança', archived: false }],
    myCategories: [{ id: 'expense', name: 'Despesas gerais', type: 'EXPENSE' }, { id: 'income', name: 'Receitas gerais', type: 'INCOME' }]
  } })
}));
const row = (overrides: Partial<StatementRow> = {}): StatementRow => ({
  rowNumber: 2, date: '2026-11-09', description: 'Mercado', amount: '10.25', direction: 'EXPENSE',
  error: null, warning: null, duplicate: false, possibleDuplicate: false, candidates: [], ...overrides
});
const batch = (rows = [row()]): StatementBatch => ({ id: 'batch', status: 'PENDING', fileName: 'extrato.ofx', financialAccountId: 'bank', currency: 'BRL', expiresAt: '2026-11-12T00:00:00.000Z', rows, result: null });
const result = { created: 1, linked: 0, ignored: 0, transfers: 0, cardPayments: 0, incomeTotal: '0.00', expenseTotal: '10.25', entries: [] };
const preview = (value: StatementBatch) => ({ data: { previewBankStatementImport: { mappingRequired: false, headers: [], samples: [], delimiter: '', sourceAccount: '001 / 123', batch: value } } });
const renderImport = () => render(<ThemeProvider><BankStatementImport onClose={mockClose} /></ThemeProvider>);
async function selectFile() { await fireEvent.press(screen.getByRole('button', { name: 'Selecionar OFX ou CSV' })); }
async function choose(label: string, option: string) {
  await fireEvent.press(screen.getByRole('button', { name: label }));
  await fireEvent.press(screen.getByRole('button', { name: option }));
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockPickFile.mockResolvedValue({ name: 'extrato.ofx', base64: 'data' });
  mockRefetchQueries.mockResolvedValue([]);
});

test('reviews categories and submits only after required fields are valid', async () => {
  mockMutate.mockResolvedValueOnce(preview(batch())).mockResolvedValueOnce({ data: { confirmBankStatementImport: result } });
  await renderImport(); await selectFile();
  expect(screen.getByText('Revisar extrato.ofx')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Confirmar importação (1)' })).toBeDisabled();
  await choose('Categoria padrão das saídas', 'Despesas gerais');
  await fireEvent.changeText(screen.getByLabelText('Descrição da linha 2'), 'Mercado corrigido');
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar importação (1)' }));
  await waitFor(() => expect(screen.getByText('Importação concluída')).toBeOnTheScreen());
  expect(mockMutate.mock.calls[1][0].variables.input).toMatchObject({ id: 'batch', decisions: [{ rowNumber: 2, action: 'CREATE', categoryId: 'expense', description: 'Mercado corrigido' }] });
  expect(mockRefetchQueries).toHaveBeenCalled();
});

test('duplicates start ignored and need explicit acknowledgement before import', async () => {
  mockMutate.mockResolvedValue(preview(batch([row({ possibleDuplicate: true })])));
  await renderImport(); await selectFile();
  expect(screen.getByRole('button', { name: 'Confirmar importação (0)' })).toBeDisabled();
  await choose('Categoria padrão das saídas', 'Despesas gerais');
  await choose('Ação da linha 2', 'Criar conta paga');
  expect(screen.getByRole('button', { name: 'Confirmar importação (1)' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('switch', { name: 'Confirmar revisão de duplicado na linha 2' }));
  expect(screen.getByRole('button', { name: 'Confirmar importação (1)' })).toBeEnabled();
});

test('transfer requires another account and shows impact before confirming', async () => {
  mockMutate.mockResolvedValueOnce(preview(batch())).mockResolvedValueOnce({ data: { confirmBankStatementImport: { ...result, created: 0, transfers: 1 } } });
  await renderImport(); await selectFile();
  await choose('Ação da linha 2', 'Transferência entre minhas contas');
  expect(screen.getByRole('button', { name: 'Confirmar importação (1)' })).toBeDisabled();
  await choose('Outra conta da transferência na linha 2', 'Poupança');
  expect(screen.getByText(/Nenhuma receita ou despesa será criada/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar importação (1)' }));
  expect(mockMutate.mock.calls[1][0].variables.input.decisions[0]).toMatchObject({ action: 'TRANSFER', otherAccountId: 'other' });
});

test('ambiguous network failure checks committed result without creating again', async () => {
  mockMutate.mockResolvedValueOnce(preview(batch())).mockRejectedValueOnce(new Error('Network error'));
  mockQuery.mockResolvedValue({ data: { bankStatementImport: { ...batch(), status: 'CONFIRMED', result } } });
  await renderImport(); await selectFile();
  await choose('Categoria padrão das saídas', 'Despesas gerais');
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar importação (1)' }));
  await waitFor(() => expect(screen.getByText('Importação concluída')).toBeOnTheScreen());
  expect(mockMutate).toHaveBeenCalledTimes(2);
  expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({ variables: { id: 'batch' }, fetchPolicy: 'no-cache' }));
});

test('CSV requires mapping and sends chosen formats to the server', async () => {
  mockPickFile.mockResolvedValue({ name: 'extrato.csv', base64: 'csvdata' });
  mockMutate.mockResolvedValueOnce({ data: { previewBankStatementImport: { mappingRequired: true, headers: ['Data', 'Histórico', 'Valor'], samples: [['09/11/2026', 'Mercado', '-10,25']], delimiter: ';', sourceAccount: null, batch: null } } }).mockResolvedValueOnce(preview(batch()));
  await renderImport(); await selectFile();
  expect(screen.getByText('Configurar CSV: extrato.csv')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Gerar prévia' }));
  expect(mockMutate.mock.calls[1][0].variables.input.csvMapping).toEqual({ delimiter: ';', dateColumn: 0, descriptionColumn: 1, amountColumn: 2, debitColumn: null, creditColumn: null, dateFormat: 'DMY', decimalSeparator: ',' });
});

test('cancelled picker does not send data; previous import can be resumed', async () => {
  mockPickFile.mockResolvedValue(null);
  await AsyncStorage.setItem('bank-statement-import:profile', 'saved');
  mockQuery.mockResolvedValue({ data: { bankStatementImport: batch() } });
  await renderImport();
  await selectFile(); expect(mockMutate).not.toHaveBeenCalled();
  await fireEvent.press(await screen.findByRole('button', { name: 'Retomar última importação' }));
  expect(screen.getByText('Revisar extrato.ofx')).toBeOnTheScreen();
});

test('review helpers preserve cents and reject invalid selections', () => {
  const rows = [row({ amount: '9999999999.99' }), row({ rowNumber: 3, amount: '0.01', direction: 'INCOME' })];
  const decisions = Object.fromEntries(rows.map(item => [item.rowNumber, { ...defaultStatementDecision(item), categoryId: 'category' }]));
  expect(statementReviewTotals(rows, decisions)).toEqual({ income: '0.01', expense: '9999999999.99' });
  expect(validStatementDecision(rows[0]!, decisions[2]!, 'bank')).toBe(true);
  expect(validStatementDecision(row({ duplicate: true }), decisions[2]!, 'bank')).toBe(false);
  expect(defaultStatementDecision(row({ error: 'Invalid' })).action).toBe('IGNORE');
});

test('last page identifies missing reconciliation targets on earlier pages and navigates to the affected row', async () => {
  const rows = Array.from({ length: 21 }, (_, index) => row({ rowNumber: index + 1, description: `Movimento ${index + 1}` }));
  mockMutate.mockResolvedValue(preview(batch(rows)));
  await renderImport(); await selectFile();
  await choose('Categoria padrão das saídas', 'Despesas gerais');
  await fireEvent.press(screen.getByRole('button', { name: 'Próximas linhas' }));
  await choose('Ação da linha 12', 'Vincular conta existente');
  await fireEvent.press(screen.getByRole('button', { name: 'Próximas linhas' }));
  expect(screen.getByText('Página 3 de 3')).toBeOnTheScreen();
  expect(screen.getByLabelText('Descrição da linha 21')).toBeOnTheScreen();
  expect(screen.getByText('Linha 12: Selecione uma conta compatível para vincular.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Confirmar importação (21)' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Revisar linha 12 (página 2)' }));
  expect(screen.getByText('Página 2 de 3')).toBeOnTheScreen();
  await choose('Ação da linha 12', 'Criar conta paga');
  expect(screen.getByRole('button', { name: 'Confirmar importação (21)' })).toBeEnabled();
  expect(screen.queryByText('Revise 1 lançamento para liberar a importação.')).toBeNull();
  expect(mockMutate).toHaveBeenCalledTimes(1);
});

test('descriptions start limited across pages, constrain edits and preserve source text', async () => {
  const original = 'Histórico do lançamento '.repeat(8).trim();
  const rows = Array.from({ length: 21 }, (_, index) => row({ rowNumber: index + 1, description: index === 0 || index === 19 ? original : `Movimento ${index + 1}`, warning: index === 0 ? 'Descrição excede 120 caracteres. Edite antes de criar a conta.' : null }));
  mockMutate.mockResolvedValueOnce(preview(batch(rows))).mockResolvedValueOnce({ data: { confirmBankStatementImport: { ...result, created: 21 } } });
  await renderImport(); await selectFile();
  await choose('Categoria padrão das saídas', 'Despesas gerais');
  expect(screen.queryByText('Revise 2 lançamentos para liberar a importação.')).toBeNull();
  expect(screen.queryByText('Descrição excede 120 caracteres. Edite antes de criar a conta.')).toBeNull();
  expect(screen.getByText(original)).toBeOnTheScreen();
  expect(screen.getByLabelText('Descrição da linha 1').props.value).toBe(original.slice(0, 120).trimEnd());
  expect(screen.getByLabelText('Descrição da linha 1').props.maxLength).toBe(120);
  await fireEvent.changeText(screen.getByLabelText('Descrição da linha 1'), 'Pix para ');
  expect(screen.getByLabelText('Descrição da linha 1').props.value).toBe('Pix para ');
  await fireEvent.changeText(screen.getByLabelText('Descrição da linha 1'), 'B'.repeat(140));
  expect(screen.getByLabelText('Descrição da linha 1').props.value).toBe('B'.repeat(120));
  expect(screen.getByRole('button', { name: 'Confirmar importação (21)' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar importação (21)' }));
  const decisions = mockMutate.mock.calls[1][0].variables.input.decisions;
  expect(decisions.find((decision: { rowNumber: number }) => decision.rowNumber === 1).description).toBe('B'.repeat(120));
  expect(decisions.find((decision: { rowNumber: number }) => decision.rowNumber === 20).description).toBe(original.slice(0, 120).trimEnd());
  expect(rows[0]!.description).toBe(original);
});

test('description limit preserves complete Unicode characters at the boundary', () => {
  expect(limitStatementDescription('A'.repeat(119) + '😀')).toBe('A'.repeat(119));
  expect(limitStatementDescription('A'.repeat(118) + '😀')).toBe('A'.repeat(118) + '😀');
  expect(defaultStatementDecision(row({ description: 'A'.repeat(150) })).description).toBe('A'.repeat(120));
});

test('decision diagnostics explain missing categories, duplicate review and invalid reconciliation targets', () => {
  const source = row();
  const decision = defaultStatementDecision(source);
  expect(statementDecisionIssues(source, decision, 'bank')).toEqual(['Selecione uma categoria.']);
  expect(statementDecisionIssues(source, { ...decision, description: '' }, 'bank')).toContain('Preencha a descrição.');
  expect(statementDecisionIssues(row({ possibleDuplicate: true }), { ...decision, categoryId: 'expense' }, 'bank')).toEqual(['Confirme que revisou o possível duplicado.']);
  expect(statementDecisionIssues(source, { ...decision, action: 'LINK_ACCOUNT' }, 'bank')).toEqual(['Selecione uma conta compatível para vincular.']);
  expect(statementDecisionIssues(source, { ...decision, action: 'TRANSFER', otherAccountId: 'bank' }, 'bank')).toEqual(['Selecione outra conta para a transferência.']);
  expect(statementDecisionIssues(source, { ...decision, action: 'CARD_PAYMENT' }, 'bank')).toEqual(['Selecione uma fatura ou pagamento compatível.']);
  expect(statementDecisionIssues(row({ duplicate: true }), { ...decision, action: 'IGNORE' }, 'bank')).toEqual([]);
});
