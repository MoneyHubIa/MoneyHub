import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Upload } from 'lucide-react-native';
import { useApolloClient, useQuery } from '@apollo/client/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Select, ToggleButton } from './ui';
import { ThemedModal } from './ui/ThemedModal';
import { useTheme } from '../theme/ThemeContext';
import { formatCurrency } from '../utils/formatters';
import { pickStatementFile, type StatementFile } from '../services/bank-statement-file';
import {
  BANK_STATEMENT_CONTEXT, CONFIRM_BANK_STATEMENT, GET_BANK_STATEMENT_IMPORT, PREVIEW_BANK_STATEMENT,
  defaultStatementDecision, limitStatementDescription, STATEMENT_DESCRIPTION_MAX_LENGTH, statementDecisionIssues, statementReviewTotals,
  type CsvMapping, type StatementBatch, type StatementDecision, type StatementPreview, type StatementResult
} from '../services/bank-statement-imports';

type Context = {
  myProfile?: { id: string } | null;
  myFinancialAccounts: { id: string; name: string; isDefault: boolean; archived: boolean }[];
  myCategories: { id: string; name: string; type: string }[];
};
type Submitted = { id: string; decisions: StatementDecision[] };
const PAGE_SIZE = 10;
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a importação.';
const displayDate = (date: string | null) => date ? date.split('-').reverse().join('/') : 'Data inválida';
const initialMapping: CsvMapping = { delimiter: ';', dateColumn: 0, descriptionColumn: 1, amountColumn: 2, debitColumn: null, creditColumn: null, dateFormat: 'DMY', decimalSeparator: ',' };

export function BankStatementImportButton() {
  const [visible, setVisible] = useState(false);
  return <>
    <Button title="Importar extrato" icon={Upload} variant="secondary" onPress={() => setVisible(true)} />
    {visible && <BankStatementImport onClose={() => setVisible(false)} />}
  </>;
}

export function BankStatementImport({ onClose }: { onClose: () => void }) {
  const { theme } = useTheme();
  const client = useApolloClient();
  const { data, loading, error: contextError } = useQuery<Context>(BANK_STATEMENT_CONTEXT);
  const [accountId, setAccountId] = useState('');
  const [file, setFile] = useState<StatementFile | null>(null);
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [batch, setBatch] = useState<StatementBatch | null>(null);
  const [mapping, setMapping] = useState<CsvMapping>(initialMapping);
  const [separateAmounts, setSeparateAmounts] = useState(false);
  const [decisions, setDecisions] = useState<Record<number, StatementDecision>>({});
  const [result, setResult] = useState<StatementResult | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [uncertain, setUncertain] = useState(false);
  const [incomeCategory, setIncomeCategory] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const inFlight = useRef(false);
  const submitted = useRef<Submitted | null>(null);
  const scrollView = useRef<ScrollView>(null);
  const rowOffsets = useRef<Record<number, number>>({});
  const rowViews = useRef<Record<number, View | null>>({});
  const requestedRow = useRef<number | null>(null);
  const accounts = (data?.myFinancialAccounts ?? []).filter(item => !item.archived);
  const selectedAccount = accountId || accounts.find(item => item.isDefault)?.id || '';
  const categories = data?.myCategories ?? [];
  const storageKey = data?.myProfile?.id ? `bank-statement-import:${data.myProfile.id}` : null;
  const disabled = busy || uncertain;

  useEffect(() => {
    let active = true;
    if (storageKey) void AsyncStorage.getItem(storageKey).then(id => { if (active) setResumeId(id); }).catch(() => undefined);
    return () => { active = false; };
  }, [storageKey]);

  const acceptBatch = (next: StatementBatch) => {
    setBatch(next); setAccountId(next.financialAccountId); setPage(0);
    setDecisions(Object.fromEntries(next.rows.map(row => [row.rowNumber, defaultStatementDecision(row)])));
    setIncomeCategory(''); setExpenseCategory('');
    if (next.result) setResult(next.result);
  };
  const run = async (work: () => Promise<unknown>) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { await work(); } catch (caught) { setError(errorText(caught)); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const remember = async (id: string | null) => {
    setResumeId(id);
    if (!storageKey) return;
    try { if (id) await AsyncStorage.setItem(storageKey, id); else await AsyncStorage.removeItem(storageKey); }
    catch { setNotice('Armazenamento local indisponível. Mantenha esta revisão aberta até concluir.'); }
  };
  async function generate(selectedFile: StatementFile, csvMapping?: CsvMapping, csvDelimiter?: string) {
    const response = await client.mutate<{ previewBankStatementImport: StatementPreview }>({
      mutation: PREVIEW_BANK_STATEMENT,
      variables: { input: { financialAccountId: selectedAccount, fileName: selectedFile.name, base64: selectedFile.base64, ...(csvMapping ? { csvMapping } : {}), ...(csvDelimiter ? { csvDelimiter } : {}) } }
    });
    const next = response.data?.previewBankStatementImport;
    if (!next) throw new Error('Não foi possível gerar a prévia.');
    setPreview(next);
    if (next.mappingRequired) setMapping(previous => ({ ...previous, delimiter: next.delimiter }));
    if (next.batch) { acceptBatch(next.batch); setFile(null); await remember(next.batch.id); }
  }
  async function resume() {
    if (!resumeId) return;
    const response = await client.query<{ bankStatementImport: StatementBatch }>({ query: GET_BANK_STATEMENT_IMPORT, variables: { id: resumeId }, fetchPolicy: 'no-cache' });
    if (!response.data) throw new Error('Importação não encontrada.');
    acceptBatch(response.data.bankStatementImport);
    if (response.data.bankStatementImport.result) await complete(response.data.bankStatementImport.result);
  }
  async function complete(value: StatementResult) {
    setResult(value); setUncertain(false); submitted.current = null; await remember(null);
    try { await client.refetchQueries({ include: 'active' }); }
    catch { setNotice('Importação concluída. Atualize as telas financeiras para consultar os novos saldos.'); }
  }
  async function checkResult() {
    const pending = submitted.current;
    if (!pending) return;
    const response = await client.query<{ bankStatementImport: StatementBatch }>({ query: GET_BANK_STATEMENT_IMPORT, variables: { id: pending.id }, fetchPolicy: 'no-cache' });
    const next = response.data?.bankStatementImport;
    if (!next) throw new Error('Não foi possível verificar o resultado.');
    if (next.result) { await complete(next.result); return true; }
    setUncertain(false); submitted.current = null;
    setError('Importação ainda não confirmada. Revise e tente novamente.');
    return false;
  }
  async function confirm() {
    if (!batch) return;
    const input = { id: batch.id, decisions: batch.rows.map(row => decisions[row.rowNumber]!) };
    submitted.current = input;
    try {
      const response = await client.mutate<{ confirmBankStatementImport: StatementResult }>({ mutation: CONFIRM_BANK_STATEMENT, variables: { input } });
      if (!response.data?.confirmBankStatementImport) throw new Error('Resposta de confirmação indisponível.');
      await complete(response.data.confirmBankStatementImport);
    } catch (caught) {
      setUncertain(true);
      try { if (await checkResult() === false) setError(errorText(caught)); }
      catch { setError(`${errorText(caught)} Não foi possível verificar o resultado. Verifique antes de alterar a revisão.`); }
    }
  }
  const update = (number: number, change: Partial<StatementDecision>) => setDecisions(previous => ({ ...previous, [number]: { ...previous[number]!, ...change } }));
  const applyCategory = (direction: string, id: string) => {
    if (direction === 'INCOME') setIncomeCategory(id); else setExpenseCategory(id);
    setDecisions(previous => Object.fromEntries(Object.entries(previous).map(([key, decision]) => [key,
      batch?.rows.find(row => row.rowNumber === decision.rowNumber)?.direction === direction ? { ...decision, categoryId: id } : decision
    ])));
  };
  const rows = batch?.rows ?? [];
  const totals = statementReviewTotals(rows, decisions);
  const selectedCount = rows.filter(row => decisions[row.rowNumber]?.action !== 'IGNORE').length;
  const pendingRows = rows.map((row, index) => ({ row, index, issues: statementDecisionIssues(row, decisions[row.rowNumber], selectedAccount) })).filter(item => item.issues.length > 0);
  const valid = selectedCount > 0 && pendingRows.length === 0;
  const scrollToRow = (rowNumber: number, y: number) => {
    scrollView.current?.scrollTo({ y: Math.max(0, y), animated: false });
    rowViews.current[rowNumber]?.focus();
    requestedRow.current = null;
  };
  const reviewRow = (rowNumber: number, index: number) => {
    const targetPage = Math.floor(index / PAGE_SIZE);
    requestedRow.current = rowNumber;
    if (targetPage === page && rowOffsets.current[rowNumber] != null) scrollToRow(rowNumber, rowOffsets.current[rowNumber]!);
    else setPage(targetPage);
  };
  const categoryOptions = (direction: string) => categories.filter(item => item.type === direction || item.type === 'BOTH').map(item => ({ value: item.id, label: item.name }));
  const text = (value: string, alert = false, key?: string) => <Text key={key} accessibilityRole={alert ? 'alert' : undefined} style={{ color: alert ? theme.expense : theme.textSecondary, lineHeight: 21 }}>{value}</Text>;
  const columnOptions = (preview?.headers ?? []).map((header, index) => ({ value: String(index), label: `${index + 1}. ${header}` }));
  const column = (field: 'dateColumn' | 'descriptionColumn' | 'amountColumn' | 'debitColumn' | 'creditColumn', label: string) => <Select label={label} value={mapping[field] == null ? '' : String(mapping[field])} disabled={disabled} options={columnOptions} onChange={value => setMapping(previous => ({ ...previous, [field]: Number(value) }))} />;

  return <ThemedModal visible onClose={onClose} dismissDisabled={busy || uncertain} title="Importar extrato bancário" subtitle="OFX ou CSV · Até 2 MiB e 500 movimentações" maxWidth={900} scrollViewRef={scrollView}>
    <View style={styles.content}>
      {loading && <ActivityIndicator accessibilityLabel="Carregando contas e categorias" />}
      {contextError && text('Não foi possível carregar contas e categorias. Feche e tente novamente.', true)}
      {!!error && text(error, true)}
      {!!notice && text(notice)}
      {result ? <>
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.income }]}>Importação concluída</Text>
        {text(`${result.created} contas criadas · ${result.linked} vínculos · ${result.ignored} linhas ignoradas`)}
        {text(`${result.transfers} transferências · ${result.cardPayments} pagamentos de fatura`)}
        {text(`Entradas conciliadas: ${formatCurrency(result.incomeTotal, batch?.currency ?? 'BRL')} · Saídas conciliadas: ${formatCurrency(result.expenseTotal, batch?.currency ?? 'BRL')}`)}
        <Button title="Concluir" onPress={onClose} />
      </> : !batch ? <>
        {!preview?.mappingRequired && resumeId && <Button title="Retomar última importação" variant="secondary" disabled={busy} onPress={() => void run(resume)} />}
        <Select label="Conta financeira do extrato" value={selectedAccount} disabled={busy || !!file} options={accounts.map(item => ({ value: item.id, label: item.name }))} onChange={setAccountId} />
        {!preview?.mappingRequired ? <>
          {text('Débitos entram como contas pagas; créditos, como recebidas, na data do extrato. Você revisará tudo antes de confirmar.')}
          <Button title="Selecionar OFX ou CSV" icon={Upload} disabled={!selectedAccount || busy || !!contextError} loading={busy} onPress={() => void run(async () => {
            const selected = await pickStatementFile();
            if (!selected) return;
            setFile(selected); setResult(null); setNotice('');
            try { await generate(selected); } catch (caught) { setFile(null); throw caught; }
          })} />
        </> : <>
          <Text style={[styles.heading, { color: theme.textPrimary }]}>Configurar CSV: {file?.name}</Text>
          <Select label="Separador de colunas" value={mapping.delimiter} disabled={disabled} options={[{ value: ';', label: 'Ponto e vírgula (;)' }, { value: ',', label: 'Vírgula (,)' }, { value: '\t', label: 'Tabulação' }]} onChange={delimiter => {
            if (file) void run(() => generate(file, undefined, delimiter));
          }} />
          {text('Amostra do arquivo:')}
          {preview.samples.map((sample, index) => text(`${index + 1}: ${sample.join(' | ')}`, false, `sample-${index}`))}
          {column('dateColumn', 'Coluna de data')}
          {column('descriptionColumn', 'Coluna de descrição')}
          <ToggleButton label="Débito e crédito em colunas separadas" value={separateAmounts} disabled={disabled} onChange={value => {
            setSeparateAmounts(value); setMapping(previous => ({ ...previous, amountColumn: value ? null : 2, debitColumn: value ? 2 : null, creditColumn: value ? 3 : null }));
          }} />
          {separateAmounts ? <>{column('debitColumn', 'Coluna de débito')}{column('creditColumn', 'Coluna de crédito')}</> : column('amountColumn', 'Coluna de valor (saídas negativas)')}
          <Select label="Formato de data" value={mapping.dateFormat} disabled={disabled} options={[{ value: 'DMY', label: 'Dia/mês/ano' }, { value: 'MDY', label: 'Mês/dia/ano' }, { value: 'ISO', label: 'Ano-mês-dia' }]} onChange={dateFormat => setMapping(previous => ({ ...previous, dateFormat: dateFormat as CsvMapping['dateFormat'] }))} />
          <Select label="Separador decimal" value={mapping.decimalSeparator} disabled={disabled} options={[{ value: ',', label: 'Vírgula: 1.234,56' }, { value: '.', label: 'Ponto: 1,234.56' }]} onChange={decimalSeparator => setMapping(previous => ({ ...previous, decimalSeparator }))} />
          <Button title="Gerar prévia" disabled={busy || !file} loading={busy} onPress={() => void run(() => generate(file!, mapping))} />
          <Button title="Escolher outro arquivo" variant="secondary" disabled={busy} onPress={() => { setFile(null); setPreview(null); }} />
        </>}
      </> : <>
        <Text style={[styles.heading, { color: theme.textPrimary }]}>Revisar {batch.fileName}</Text>
        {text(`Conta: ${accounts.find(item => item.id === batch.financialAccountId)?.name ?? 'Conta selecionada'}${preview?.sourceAccount ? ` · Banco/conta no arquivo: ${preview.sourceAccount}` : ''}`)}
        {text('Categorias padrão aplicam-se às novas contas. Vínculos preservam classificação existente. Sugestões exigem sua escolha.')}
        <Select label="Categoria padrão das entradas" value={incomeCategory} disabled={disabled} options={categoryOptions('INCOME')} onChange={value => applyCategory('INCOME', value)} />
        <Select label="Categoria padrão das saídas" value={expenseCategory} disabled={disabled} options={categoryOptions('EXPENSE')} onChange={value => applyCategory('EXPENSE', value)} />
        <View style={styles.buttons}>
          <Button title="Ignorar todas" variant="secondary" disabled={disabled} onPress={() => setDecisions(previous => Object.fromEntries(Object.entries(previous).map(([key, decision]) => [key, { ...decision, action: 'IGNORE' }])))} />
          <Button title="Selecionar novas válidas" variant="secondary" disabled={disabled} onPress={() => setDecisions(previous => Object.fromEntries(rows.map(row => [row.rowNumber, { ...previous[row.rowNumber]!, action: row.error || row.duplicate || row.possibleDuplicate ? 'IGNORE' : 'CREATE' }])))} />
        </View>
        {rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(row => {
          const decision = decisions[row.rowNumber]!;
          const issues = statementDecisionIssues(row, decision, selectedAccount);
          const blocked = !!row.error || row.duplicate;
          const candidateKind = decision.action === 'LINK_ACCOUNT' ? (row.direction === 'EXPENSE' ? 'PAYABLE' : 'RECEIVABLE') : decision.action === 'TRANSFER' ? 'TRANSFER' : 'CARD_PAYMENT';
          const candidates = row.candidates.filter(item => item.kind === candidateKind || (decision.action === 'CARD_PAYMENT' && item.kind === 'CARD_STATEMENT'));
          return <View key={row.rowNumber} ref={value => { rowViews.current[row.rowNumber] = value; }} tabIndex={-1} onLayout={event => {
            const y = event.nativeEvent.layout.y;
            rowOffsets.current[row.rowNumber] = y;
            if (requestedRow.current === row.rowNumber) scrollToRow(row.rowNumber, y);
          }} style={[styles.row, { borderColor: theme.borderElevated, backgroundColor: theme.bgElevated }]}>
            <Text style={{ color: row.direction === 'INCOME' ? theme.income : theme.expense, fontWeight: '700' }}>Linha {row.rowNumber} · {displayDate(row.date)} · {row.direction === 'INCOME' ? '+' : '−'} {row.amount ? formatCurrency(row.amount, batch.currency) : 'Valor inválido'}</Text>
            <Text style={{ color: theme.textPrimary }}>{row.description || 'Movimentação inválida'}</Text>
            {!!row.error && text(row.error, true)}
            {row.duplicate && text('Já importada. Esta linha será ignorada.')}
            {row.description.length > STATEMENT_DESCRIPTION_MAX_LENGTH && text('Descrição da nova conta limitada automaticamente a 120 caracteres. O texto original foi preservado acima.')}
            {!!row.warning && row.warning !== 'Descrição excede 120 caracteres. Edite antes de criar a conta.' && text(row.warning)}
            {row.possibleDuplicate && !blocked && <ToggleButton label="Possível duplicado: confirme que revisou esta movimentação" accessibilityLabel={`Confirmar revisão de duplicado na linha ${row.rowNumber}`} value={decision.acknowledgeDuplicate} disabled={disabled} onChange={acknowledgeDuplicate => update(row.rowNumber, { acknowledgeDuplicate })} />}
            <Select label={`Ação da linha ${row.rowNumber}`} value={decision.action} disabled={disabled || blocked} options={[
              { value: 'IGNORE', label: 'Ignorar' }, { value: 'CREATE', label: row.direction === 'INCOME' ? 'Criar conta recebida' : 'Criar conta paga' },
              { value: 'LINK_ACCOUNT', label: 'Vincular conta existente' }, { value: 'TRANSFER', label: 'Transferência entre minhas contas' },
              ...(row.direction === 'EXPENSE' ? [{ value: 'CARD_PAYMENT', label: 'Pagamento de fatura de cartão' }] : [])
            ]} onChange={action => update(row.rowNumber, { action: action as StatementDecision['action'], targetId: null, otherAccountId: null, cardId: null, statementDueDate: null })} />
            {decision.action === 'CREATE' && <>
              <Text style={{ color: theme.textSecondary }}>Descrição (até 120 caracteres)</Text>
              <TextInput accessibilityLabel={`Descrição da linha ${row.rowNumber}`} value={decision.description} maxLength={STATEMENT_DESCRIPTION_MAX_LENGTH} editable={!disabled} onChangeText={description => update(row.rowNumber, { description: limitStatementDescription(description) })} style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderElevated }]} />
              <Select label={`Categoria da linha ${row.rowNumber}`} value={decision.categoryId ?? ''} disabled={disabled} options={categoryOptions(row.direction ?? '')} onChange={categoryId => update(row.rowNumber, { categoryId })} />
            </>}
            {decision.action !== 'CREATE' && decision.action !== 'IGNORE' && <Select label={`Vínculo da linha ${row.rowNumber}`} value={decision.targetId ?? (decision.cardId ? `${decision.cardId}:${decision.statementDueDate}` : '')} disabled={disabled} options={[
              ...(decision.action === 'TRANSFER' ? [{ value: '', label: 'Criar transferência para outra conta' }] : []),
              ...candidates.map(item => ({ value: item.id, label: `${item.label} · ${displayDate(item.date)} · ${formatCurrency(item.amount, batch.currency)} · ${item.status}` }))
            ]} placeholder="Selecione um vínculo compatível" onChange={value => {
              const candidate = candidates.find(item => item.id === value);
              update(row.rowNumber, { targetId: candidate?.kind === 'CARD_STATEMENT' ? null : value || null, cardId: candidate?.cardId ?? null, statementDueDate: candidate?.statementDueDate ?? null });
            }} />}
            {decision.action === 'TRANSFER' && !decision.targetId && <>
              <Select label={`Outra conta da transferência na linha ${row.rowNumber}`} value={decision.otherAccountId ?? ''} disabled={disabled} options={accounts.filter(item => item.id !== batch.financialAccountId).map(item => ({ value: item.id, label: item.name }))} onChange={otherAccountId => update(row.rowNumber, { otherAccountId })} />
              {text(`Esta operação ${row.direction === 'EXPENSE' ? 'retira' : 'adiciona'} ${formatCurrency(row.amount, batch.currency)} ${row.direction === 'EXPENSE' ? 'da' : 'à'} conta do extrato e ${row.direction === 'EXPENSE' ? 'adiciona à' : 'retira da'} outra conta. Nenhuma receita ou despesa será criada.`)}
            </>}
            {!blocked && row.candidates.length > 0 && decision.action === 'CREATE' && text(`${row.candidates.length} vínculo(s) compatível(is). Confira para evitar duplicação.`)}
            {!blocked && issues.map((issue, index) => text(issue, true, `issue-${row.rowNumber}-${index}`))}
          </View>;
        })}
        <View style={styles.buttons}>
          <Button title="Linhas anteriores" variant="secondary" disabled={disabled || page === 0} onPress={() => setPage(previous => previous - 1)} />
          {text(`Página ${page + 1} de ${Math.max(1, Math.ceil(rows.length / PAGE_SIZE))}`)}
          <Button title="Próximas linhas" variant="secondary" disabled={disabled || (page + 1) * PAGE_SIZE >= rows.length} onPress={() => setPage(previous => previous + 1)} />
        </View>
        {text(`${selectedCount} selecionadas · Entradas: ${formatCurrency(totals.income, batch.currency)} · Saídas: ${formatCurrency(totals.expense, batch.currency)}`)}
        {text('Totais incluem transferências e vínculos já efetivados; não representam variação adicional do saldo. Nada será salvo parcialmente.')}
        {!uncertain && pendingRows.length > 0 && <View style={[styles.row, { borderColor: theme.expense, backgroundColor: theme.bgElevated }]}>
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: theme.expense, fontWeight: '700' }}>
            {pendingRows.length === 1 ? 'Revise 1 lançamento para liberar a importação.' : `Revise ${pendingRows.length} lançamentos para liberar a importação.`}
          </Text>
          {text('A confirmação considera todas as páginas. Corrija as pendências abaixo ou escolha Ignorar na linha correspondente.')}
          {pendingRows.slice(0, 5).map(item => <View key={item.row.rowNumber} style={{ gap: 8 }}>
            {text(`Linha ${item.row.rowNumber}: ${item.issues.join(' ')}`)}
            <Button title={`Revisar linha ${item.row.rowNumber} (página ${Math.floor(item.index / PAGE_SIZE) + 1})`} variant="secondary" disabled={disabled} onPress={() => reviewRow(item.row.rowNumber, item.index)} />
          </View>)}
          {pendingRows.length > 5 && text(`Mais ${pendingRows.length - 5} lançamentos com pendências. A lista será atualizada conforme você corrigir as linhas.`)}
        </View>}
        {!uncertain && selectedCount === 0 && text('Selecione pelo menos uma movimentação válida para importar.')}
        {uncertain ? <Button title="Verificar resultado da importação" loading={busy} disabled={busy} onPress={() => void run(checkResult)} /> : <>
          <Button title={`Confirmar importação (${selectedCount})`} loading={busy} disabled={busy || !valid} onPress={() => void run(confirm)} />
          <Button title="Atualizar sugestões" variant="secondary" disabled={busy} onPress={() => void run(async () => {
            const response = await client.query<{ bankStatementImport: StatementBatch }>({ query: GET_BANK_STATEMENT_IMPORT, variables: { id: batch.id }, fetchPolicy: 'no-cache' });
            if (response.data) {
              if (response.data.bankStatementImport.result) await complete(response.data.bankStatementImport.result);
              else setBatch(response.data.bankStatementImport);
            }
          })} />
          <Button title="Escolher outro arquivo" variant="secondary" disabled={busy} onPress={() => { setBatch(null); setFile(null); setPreview(null); setDecisions({}); setPage(0); }} />
        </>}
      </>}
    </View>
  </ThemedModal>;
}

const styles = StyleSheet.create({
  content: { gap: 16 }, heading: { fontSize: 18, fontWeight: '700' },
  buttons: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  row: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 48, fontSize: 16 }
});
