import { Plus, Target, Wallet, Flag, ArrowUpRight, ArrowDownRight, History as HistoryIcon, Pencil, Trash2 } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import type { ColorTokens } from '../theme/tokens';
import { Button as UiButton, Card, Badge, KpiCard, ThemedModal } from './ui';
import { decimal as normalizeDecimal, validText } from '../utils/validation';
import { ValidatedInput as TextInput } from './ui/ValidatedInput';
import { gql } from '@apollo/client';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { DatePickerInput } from './DatePickerInput';
import { formatCurrency, formatISOToRegionalDate, parseRegionalDateToISO } from '../utils/formatters';

const GOAL_FIELDS = gql`
  fragment GoalFields on FinancialGoal {
    id name description targetAmount accumulatedAmount remainingAmount progress status startDate deadline
  }
`;
export const MY_FINANCIAL_GOALS = gql`
  query MyFinancialGoals {
    myFinancialGoals { ...GoalFields }
    financialGoalsSummary { count activeCount completedCount overdueCount totalAccumulated totalTarget }
  }
  ${GOAL_FIELDS}
`;
export const FINANCIAL_GOAL = gql`
  query FinancialGoal($id: ID!, $after: ID) {
    financialGoal(id: $id) {
      id
      movements(after: $after) { nodes { id type amount occurredOn notes operationId } hasNextPage endCursor }
    }
  }
`;
const CREATE_GOAL = gql`mutation CreateFinancialGoal($input: CreateFinancialGoalInput!) {
  createFinancialGoal(input: $input) { ...GoalFields }
} ${GOAL_FIELDS}`;
const UPDATE_GOAL = gql`mutation UpdateFinancialGoal($input: UpdateFinancialGoalInput!) {
  updateFinancialGoal(input: $input) { ...GoalFields }
} ${GOAL_FIELDS}`;
const DELETE_GOAL = gql`mutation DeleteFinancialGoal($id: ID!) { deleteFinancialGoal(id: $id) }`;
const RECORD_MOVEMENT = gql`mutation RecordFinancialGoalMovement($input: RecordFinancialGoalMovementInput!) {
  recordFinancialGoalMovement(input: $input) { ...GoalFields }
} ${GOAL_FIELDS}`;

export type Goal = {
  id: string; name: string; description: string | null; targetAmount: string;
  accumulatedAmount: string; remainingAmount: string; progress: number;
  status: 'ACTIVE' | 'COMPLETED' | 'OVERDUE'; startDate: string; deadline: string;
};
type Summary = { count: number; totalAccumulated: string; totalTarget: string };
type MovementPage = { nodes: Array<{ id: string; type: string; amount: string; occurredOn: string; notes: string | null }>; hasNextPage: boolean; endCursor: string | null };
const statusLabels = { ACTIVE: 'Ativa', COMPLETED: 'Concluída', OVERDUE: 'Atrasada' };
const filters = [{ label: 'Todas', status: null }, { label: 'Ativas', status: 'ACTIVE' }, { label: 'Concluídas', status: 'COMPLETED' }, { label: 'Atrasadas', status: 'OVERDUE' }] as const;
function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function decimal(raw: string): string {
  const value = raw.trim().replace(',', '.');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(value) || Number(value) <= 0) throw new Error('Informe valor positivo com até duas casas decimais.');
  const [whole, fraction = ''] = value.split('.');
  return `${whole!.replace(/^0+(?=\d)/, '')}.${fraction.padEnd(2, '0')}`;
}
function validDate(raw: string, currency: string): string {
  const iso = parseRegionalDateToISO(raw, currency);
  if (!iso || new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) !== iso) throw new Error('Informe data válida.');
  return iso;
}
function Button({ label, onPress, disabled = false, variant = 'secondary' }: { label: string; onPress(): void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'danger' }) {
  return <UiButton title={label} onPress={onPress} disabled={disabled} variant={variant} style={{ minHeight: 48 }} />;
}
function Field({ label, value, onChange, numeric = false, multiline = false }: { label: string; value: string; onChange(value: string): void; numeric?: boolean; multiline?: boolean }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput moneyDigits={numeric ? 12 : undefined} maxLength={numeric ? undefined : multiline ? 500 : 120} accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'} multiline={multiline} style={styles.input} /></View>;
}
function History({ goal, currency }: { goal: Goal; currency: string }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { data, loading, error, refetch } = useQuery<{ financialGoal: { movements: MovementPage } }>(FINANCIAL_GOAL, { variables: { id: goal.id }, fetchPolicy: 'network-only' });
  const [pageError, setPageError] = useState(false);
  const [paging, setPaging] = useState(false);
  const [after, setAfter] = useState<string | null>(null);
  const requestedCursor = useRef<string | null>(null);
  const busy = useRef(false);
  const page = data?.financialGoal.movements;
  const load = async (cursor: string | null) => {
    if (busy.current) return;
    busy.current = true; requestedCursor.current = cursor; setPaging(true); setPageError(false);
    try { await refetch({ id: goal.id, after: cursor }); setAfter(cursor); }
    catch { setPageError(true); }
    finally { busy.current = false; setPaging(false); }
  };
  return <View style={styles.card}>
    <Text style={styles.muted}>Movimentos preservados. Corrija valores com novo aporte ou retirada.</Text>
    {loading && <ActivityIndicator accessibilityLabel="Carregando histórico" />}
    {(error || pageError) && <><Text style={styles.error}>Não foi possível carregar histórico.</Text><Button label="Tentar histórico novamente" onPress={() => void load(requestedCursor.current)} disabled={paging} /></>}
    {!loading && !error && page?.nodes.length === 0 && <Text style={styles.muted}>Nenhum movimento registrado.</Text>}
    {page?.nodes.map(m => <View key={m.id} style={styles.historyRow}>
      <Text style={styles.label}>{m.type === 'CONTRIBUTION' ? 'Aporte' : 'Retirada'} · {formatCurrency(m.amount, currency)}</Text>
      <Text style={styles.muted}>{formatISOToRegionalDate(m.occurredOn, currency)}</Text>{m.notes && <Text style={styles.muted}>{m.notes}</Text>}
    </View>)}
    <View style={styles.row}>
      {after && <Button label="Primeira página" onPress={() => void load(null)} disabled={paging} />}
      {page?.hasNextPage && <Button label="Próxima página" onPress={() => void load(page.endCursor)} disabled={paging} />}
    </View>
  </View>;
}

export function FinancialGoals({ preferredCurrency = 'BRL' }: { preferredCurrency?: string }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const wide = useWindowDimensions().width >= 1200;
  const client = useApolloClient();
  const { data, loading, error, refetch } = useQuery<{ myFinancialGoals: Goal[]; financialGoalsSummary: Summary }>(MY_FINANCIAL_GOALS, { fetchPolicy: 'cache-and-network' });
  const [create] = useMutation(CREATE_GOAL), [update] = useMutation(UPDATE_GOAL);
  const [record] = useMutation(RECORD_MOVEMENT), [remove] = useMutation(DELETE_GOAL);
  const [filter, setFilter] = useState<string | null>(null);
  const [form, setForm] = useState<Goal | 'new' | null>(null);
  const [name, setName] = useState(''), [description, setDescription] = useState(''), [target, setTarget] = useState('');
  const [startDate, setStartDate] = useState(''), [deadline, setDeadline] = useState('');
  const [movement, setMovement] = useState<{ goal: Goal; type: 'CONTRIBUTION' | 'WITHDRAWAL' } | null>(null);
  const [movementAmount, setMovementAmount] = useState(''), [movementDate, setMovementDate] = useState(''), [movementNotes, setMovementNotes] = useState('');
  const [history, setHistory] = useState<Goal | null>(null), [deleting, setDeleting] = useState<Goal | null>(null);
  const [message, setMessage] = useState<string | null>(null), [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const refresh = async () => {
    try {
      await client.refetchQueries({ include: 'all', onQueryUpdated: query => {
        const watched = ['MyFinancialGoals', 'FinancialGoal', 'DashboardSummary', 'AiFinancialContext'];
        return watched.includes(query.queryName ?? '') ? query.refetch() : false;
      } });
    } catch { setMessage('Registro salvo. Atualização falhou; tente carregar novamente.'); }
  };
  const openForm = (goal: Goal | 'new') => {
    if (busy.current) return;
    setHistory(null); setForm(goal); setMovement(null); setDeleting(null); setMessage(null);
    setName(goal === 'new' ? '' : goal.name); setDescription(goal === 'new' ? '' : goal.description ?? '');
    setTarget(goal === 'new' ? '' : goal.targetAmount);
    setStartDate(formatISOToRegionalDate(goal === 'new' ? today() : goal.startDate, preferredCurrency));
    setDeadline(goal === 'new' ? '' : formatISOToRegionalDate(goal.deadline, preferredCurrency));
  };
  const openMovement = (goal: Goal, type: 'CONTRIBUTION' | 'WITHDRAWAL') => {
    if (busy.current) return;
    setHistory(null); setMovement({ goal, type }); setForm(null); setDeleting(null); setMessage(null);
    setMovementAmount(''); setMovementNotes(''); setMovementDate(formatISOToRegionalDate(today(), preferredCurrency)); operation.current = null;
  };
  const submit = async (work: () => Promise<unknown>, done: () => void) => {
    if (busy.current) return;
    busy.current = true; setSubmitting(true); setMessage(null);
    try { await work(); done(); await refresh(); }
    catch (err) { setMessage(err instanceof Error ? err.message : 'Não foi possível salvar. Tente novamente.'); }
    finally { busy.current = false; setSubmitting(false); }
  };
  const formValid = validText(name, 120) && description.length <= 500 && !!normalizeDecimal(target, 12) && !!parseRegionalDateToISO(startDate, preferredCurrency) && !!parseRegionalDateToISO(deadline, preferredCurrency) && parseRegionalDateToISO(deadline, preferredCurrency)! >= parseRegionalDateToISO(startDate, preferredCurrency)!;
  const movementValid = !!normalizeDecimal(movementAmount, 12) && movementNotes.length <= 500 && !!parseRegionalDateToISO(movementDate, preferredCurrency);
  const save = () => {
    if (!formValid) return;
    if (!form || busy.current) return;
    void submit(async () => {
      if (!name.trim() || name.trim().length > 120) throw new Error('Informe nome da meta com até 120 caracteres.');
      if (description.trim().length > 500) throw new Error('Descrição deve ter até 500 caracteres.');
      const input = { name: name.trim(), description: description.trim() || null, targetAmount: decimal(target), startDate: validDate(startDate, preferredCurrency), deadline: validDate(deadline, preferredCurrency) };
      if (input.deadline < input.startDate) throw new Error('Prazo não pode anteceder início.');
      return form === 'new' ? create({ variables: { input } }) : update({ variables: { input: { ...input, id: form.id } } });
    }, () => setForm(null));
  };
  const saveMovement = () => {
    if (!movementValid) return;
    if (!movement || busy.current) return;
    void submit(async () => {
      if (movementNotes.trim().length > 500) throw new Error('Observação deve ter até 500 caracteres.');
      const payload = { goalId: movement.goal.id, type: movement.type, amount: decimal(movementAmount), occurredOn: validDate(movementDate, preferredCurrency), notes: movementNotes.trim() || null };
      const signature = JSON.stringify(payload);
      if (operation.current?.signature !== signature) operation.current = { signature, id: randomUUID() };
      return record({ variables: { input: { ...payload, operationId: operation.current.id } } });
    }, () => { setMovement(null); operation.current = null; });
  };
  const goals = data?.myFinancialGoals ?? [];
  const visible = goals.filter(goal => !filter || goal.status === filter);
  const closeForm = () => { if (!busy.current) setForm(null); };
  const closeMovement = () => { if (!busy.current) setMovement(null); };
  const closeDelete = () => { if (!busy.current) setDeleting(null); };
  return <View style={styles.container}>
    <View style={styles.header}>
      <View style={styles.heading}><Text style={styles.eyebrow}>Planejamento financeiro</Text><Text accessibilityRole="header" style={styles.title}>Metas financeiras</Text><Text style={styles.muted}>Acompanhe suas reservas. Aportes e retiradas não alteram receitas, despesas ou fluxo de caixa.</Text></View>
      <UiButton title="Nova meta" icon={Plus} onPress={() => openForm('new')} disabled={submitting} style={{ minHeight: 48 }} />
    </View>
    {message && !form && !movement && !deleting && <Text accessibilityRole="alert" style={styles.error}>{message}</Text>}
    {loading && <ActivityIndicator accessibilityLabel="Carregando metas" color={theme.income} />}
    {error && <Text style={styles.error}>Não foi possível carregar metas.</Text>}
    {(error || (message && !form && !movement && !deleting)) && <Button label="Tentar novamente" onPress={() => { setMessage(null); void refetch().catch(() => setMessage('Não foi possível carregar metas.')); }} disabled={submitting} />}
    {data?.financialGoalsSummary && <View accessibilityLabel="Resumo das metas" style={styles.metrics}>
      <KpiCard title="Total acumulado" value={formatCurrency(data.financialGoalsSummary.totalAccumulated, preferredCurrency)} tone="income" icon={Wallet} subtext="Reservado para suas metas" style={styles.metric} />
      <KpiCard title="Alvo total" value={formatCurrency(data.financialGoalsSummary.totalTarget, preferredCurrency)} icon={Target} subtext={`${data.financialGoalsSummary.count} metas`} style={styles.metric} />
      <KpiCard title="Metas ativas" value={String(goals.filter(goal => goal.status === 'ACTIVE').length)} tone="brandAI" icon={Flag} subtext={`${goals.filter(goal => goal.status === 'COMPLETED').length} concluídas · ${goals.filter(goal => goal.status === 'OVERDUE').length} atrasadas`} style={styles.metric} />
    </View>}
    <Card style={styles.filters}>
      <View style={styles.row}>{filters.map(f => <Pressable key={f.label} accessibilityRole="button" accessibilityState={{ selected: filter === f.status }} aria-selected={filter === f.status} onPress={() => setFilter(f.status)} style={({ pressed }) => [styles.filter, { backgroundColor: filter === f.status ? theme.brandAI : theme.bgElevated, borderColor: filter === f.status ? theme.brandAI : theme.borderElevated, opacity: pressed ? 0.8 : 1 }]}><Text style={{ color: filter === f.status ? '#FFFFFF' : theme.textPrimary, fontWeight: '600' }}>{f.label}</Text></Pressable>)}</View>
      <Text style={styles.muted}>{visible.length} {visible.length === 1 ? 'meta encontrada' : 'metas encontradas'}</Text>
    </Card>
    {!loading && !error && goals.length === 0 && <Card style={styles.empty}><Target size={32} color={theme.income} /><Text style={styles.cardTitle}>Crie sua primeira meta financeira.</Text><Text style={styles.muted}>Defina um objetivo e acompanhe cada aporte até alcançá-lo.</Text></Card>}
    {!loading && goals.length > 0 && visible.length === 0 && <Card style={styles.empty}><Text style={styles.muted}>Nenhuma meta neste filtro.</Text></Card>}
    {!!visible.length && <Card style={styles.list}>
      {wide && <View style={styles.tableHeader}><Text style={[styles.label, styles.nameColumn]}>Meta</Text><Text style={[styles.label, styles.progressColumn]}>Progresso</Text><Text style={[styles.label, styles.dateColumn]}>Prazo</Text><Text style={[styles.label, styles.actionsColumn]}>Ações</Text></View>}
      {visible.map(goal => <View key={goal.id} style={[styles.goal, { flexDirection: wide ? 'row' : 'column' }]}>
        <View style={[wide && styles.nameColumn, { gap: 8 }]}><View style={styles.row}><View style={styles.goalIcon}><Target size={20} color={theme.income} /></View><Text accessibilityRole="header" style={[styles.cardTitle, { flexShrink: 1 }]}>{goal.name}</Text></View><View style={{ alignSelf: 'flex-start' }}><Badge label={statusLabels[goal.status]} tone={goal.status === 'OVERDUE' ? 'expense' : goal.status === 'COMPLETED' ? 'income' : 'brandAI'} /></View>{goal.description && <Text style={styles.muted}>{goal.description}</Text>}</View>
        <View style={[wide && styles.progressColumn, { gap: 8 }]}><Text style={styles.amount}>{formatCurrency(goal.accumulatedAmount, preferredCurrency)}</Text><Text style={styles.muted}>de {formatCurrency(goal.targetAmount, preferredCurrency)}</Text><View accessibilityRole="progressbar" accessibilityLabel={`Progresso de ${goal.name}`} accessibilityValue={{ min: 0, max: 100, now: Math.min(goal.progress, 100), text: `${goal.progress}%` }} style={styles.track}><View style={[styles.fill, { width: `${Math.min(goal.progress, 100)}%` }]} /></View><View style={styles.row}><Text style={styles.label}>{goal.progress}%</Text><Text style={styles.muted}>Restante: {formatCurrency(goal.remainingAmount, preferredCurrency)}</Text></View></View>
        <View style={wide && styles.dateColumn}><Text style={styles.muted}>{wide ? '' : 'Prazo: '}{formatISOToRegionalDate(goal.deadline, preferredCurrency)}</Text></View>
        <View style={[wide && styles.actionsColumn, { gap: 8 }]}>
          <View style={styles.row}><UiButton title="Aportar" accessibilityLabel={`Aportar em ${goal.name}`} icon={ArrowUpRight} onPress={() => openMovement(goal, 'CONTRIBUTION')} disabled={submitting} style={styles.action} /><UiButton title="Retirar" accessibilityLabel={`Retirar de ${goal.name}`} variant="secondary" icon={ArrowDownRight} onPress={() => openMovement(goal, 'WITHDRAWAL')} disabled={submitting} style={styles.action} /></View>
          <View style={styles.row}><UiButton accessibilityLabel={`Histórico de ${goal.name}`} icon={HistoryIcon} variant="secondary" onPress={() => { setHistory(goal); setForm(null); setMovement(null); setDeleting(null); }} disabled={submitting} style={styles.iconAction} /><UiButton accessibilityLabel={`Editar meta ${goal.name}`} icon={Pencil} variant="secondary" onPress={() => openForm(goal)} disabled={submitting} style={styles.iconAction} /><UiButton accessibilityLabel={`Excluir meta ${goal.name}`} icon={Trash2} variant="secondary" onPress={() => { setHistory(null); setDeleting(goal); setForm(null); setMovement(null); setMessage(null); }} disabled={submitting} style={styles.iconAction} /></View>
        </View>
      </View>)}
    </Card>}
    {form && <ThemedModal visible title={form === 'new' ? 'Nova meta' : 'Editar meta'} onClose={closeForm} dismissDisabled={submitting}><View style={styles.form}>
      {message && <Text accessibilityRole="alert" style={styles.error}>{message}</Text>}
      <Field label="Nome da meta" value={name} onChange={setName} />
      <Field label="Descrição da meta" value={description} onChange={setDescription} multiline />
      <Field label="Valor-alvo" value={target} onChange={setTarget} numeric />
      <DatePickerInput label="Início" accessibilityLabel="Início da meta" value={startDate} onChangeText={setStartDate} currency={preferredCurrency} />
      <DatePickerInput label="Prazo" accessibilityLabel="Prazo da meta" value={deadline} onChangeText={setDeadline} currency={preferredCurrency} />
      <Text style={styles.muted}>Saldo inicial zero. Valores já poupados entram como primeiro aporte.</Text>
      {!formValid && <Text style={styles.muted}>Confira nome, valor positivo, início e prazo da meta.</Text>}
      <View style={styles.row}><Button label="Salvar meta" variant="primary" onPress={save} disabled={submitting || !formValid} /><Button label="Cancelar" onPress={closeForm} disabled={submitting} /></View>
    </View></ThemedModal>}
    {movement && <ThemedModal visible title={`${movement.type === 'CONTRIBUTION' ? 'Aporte' : 'Retirada'} · ${movement.goal.name}`} onClose={closeMovement} dismissDisabled={submitting}><View style={styles.form}>
      {message && <Text accessibilityRole="alert" style={styles.error}>{message}</Text>}
      <Field label="Valor do movimento" value={movementAmount} onChange={setMovementAmount} numeric />
      <DatePickerInput label="Data" accessibilityLabel="Data do movimento" value={movementDate} onChangeText={setMovementDate} currency={preferredCurrency} />
      <Field label="Observação do movimento" value={movementNotes} onChange={setMovementNotes} multiline />
      {!movementValid && <Text style={styles.muted}>Informe valor positivo e data válida.</Text>}
      <View style={styles.row}><Button label={movement.type === 'CONTRIBUTION' ? 'Registrar aporte' : 'Registrar retirada'} variant="primary" onPress={saveMovement} disabled={submitting || !movementValid} /><Button label="Cancelar" onPress={closeMovement} disabled={submitting} /></View>
    </View></ThemedModal>}
    {deleting && <ThemedModal visible title="Excluir meta" onClose={closeDelete} dismissDisabled={submitting}><View style={styles.form}>{message && <Text accessibilityRole="alert" style={styles.error}>{message}</Text>}<Text style={styles.muted}>Excluir meta {deleting.name}? Histórico será preservado, mas meta deixará de aparecer.</Text><View style={styles.row}><Button label="Confirmar exclusão" variant="danger" onPress={() => void submit(() => remove({ variables: { id: deleting.id } }), () => { if (history?.id === deleting.id) setHistory(null); setDeleting(null); })} disabled={submitting} /><Button label="Cancelar exclusão" onPress={closeDelete} disabled={submitting} /></View></View></ThemedModal>}
    {history && <ThemedModal visible title={`Histórico de ${history.name}`} onClose={() => setHistory(null)}><History key={history.id} goal={history} currency={preferredCurrency} /><Button label="Fechar histórico" onPress={() => setHistory(null)} /></ThemedModal>}
  </View>;
}

const createStyles = (theme: ColorTokens) => StyleSheet.create({
  container: { gap: 18 }, header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }, heading: { flex: 1, minWidth: 200, gap: 4 },
  title: { fontSize: 28, fontWeight: '700', color: theme.textPrimary }, eyebrow: { fontSize: 12, fontWeight: '700', color: theme.income, letterSpacing: 0.5 }, muted: { color: theme.textSecondary, fontSize: 13, lineHeight: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, maxWidth: '100%' }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, metric: { flexBasis: 220, minWidth: 0 }, filters: { padding: 12, gap: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
  filter: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 8, borderWidth: 1, justifyContent: 'center' }, empty: { padding: 32, alignItems: 'center', gap: 12 },
  list: { padding: 0, overflow: 'hidden' }, tableHeader: { flexDirection: 'row', gap: 16, padding: 16, backgroundColor: theme.bgElevated },
  goal: { padding: 16, gap: 16, borderTopWidth: 1, borderColor: theme.border, alignItems: 'stretch' }, nameColumn: { flexGrow: 1, flexBasis: 150, minWidth: 0 }, progressColumn: { flexGrow: 1, flexBasis: 170, minWidth: 0 }, dateColumn: { flexBasis: 92, justifyContent: 'center' }, actionsColumn: { flexBasis: 234, justifyContent: 'center' },
  goalIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.incomeBadge },
  card: { gap: 12, paddingBottom: 16 }, cardTitle: { color: theme.textPrimary, fontSize: 17, fontWeight: '700' }, amount: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'], color: theme.income },
  action: { minHeight: 48, paddingHorizontal: 10 }, iconAction: { minHeight: 48, minWidth: 48, paddingHorizontal: 12 }, form: { gap: 16 }, field: { gap: 6 }, label: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  input: { minHeight: 48, borderWidth: 1, borderColor: theme.borderElevated, borderRadius: 8, padding: 12, color: theme.textPrimary, backgroundColor: theme.bgElevated },
  error: { color: theme.expense, lineHeight: 22, backgroundColor: theme.expenseBadge, padding: 12, borderRadius: 8 },
  track: { backgroundColor: theme.bgElevated, height: 8, borderRadius: 4, overflow: 'hidden' }, fill: { backgroundColor: theme.income, height: 8 }, historyRow: { gap: 4, borderBottomWidth: 1, borderBottomColor: theme.border, paddingVertical: 12 }
});
