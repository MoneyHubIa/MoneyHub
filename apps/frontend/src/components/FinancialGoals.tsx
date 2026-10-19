import { gql } from '@apollo/client';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
function Button({ label, onPress, disabled = false }: { label: string; onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}
function Field({ label, value, onChange, numeric = false, multiline = false }: { label: string; value: string; onChange(value: string): void; numeric?: boolean; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'} multiline={multiline} style={styles.input} /></View>;
}
function History({ goal, currency }: { goal: Goal; currency: string }) {
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
    <Text accessibilityRole="header" style={styles.cardTitle}>Histórico de {goal.name}</Text>
    <Text style={styles.muted}>Movimentos preservados. Corrija valores com novo aporte ou retirada.</Text>
    {loading && <ActivityIndicator accessibilityLabel="Carregando histórico" />}
    {(error || pageError) && <><Text style={styles.error}>Não foi possível carregar histórico.</Text><Button label="Tentar histórico novamente" onPress={() => void load(requestedCursor.current)} disabled={paging} /></>}
    {!loading && !error && page?.nodes.length === 0 && <Text>Nenhum movimento registrado.</Text>}
    {page?.nodes.map(m => <View key={m.id} style={styles.historyRow}>
      <Text style={styles.label}>{m.type === 'CONTRIBUTION' ? 'Aporte' : 'Retirada'} · {formatCurrency(m.amount, currency)}</Text>
      <Text>{formatISOToRegionalDate(m.occurredOn, currency)}</Text>{m.notes && <Text>{m.notes}</Text>}
    </View>)}
    <View style={styles.row}>
      {after && <Button label="Primeira página" onPress={() => void load(null)} disabled={paging} />}
      {page?.hasNextPage && <Button label="Próxima página" onPress={() => void load(page.endCursor)} disabled={paging} />}
    </View>
  </View>;
}

export function FinancialGoals({ preferredCurrency = 'BRL' }: { preferredCurrency?: string }) {
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
    setForm(goal); setMovement(null); setDeleting(null); setMessage(null);
    setName(goal === 'new' ? '' : goal.name); setDescription(goal === 'new' ? '' : goal.description ?? '');
    setTarget(goal === 'new' ? '' : goal.targetAmount);
    setStartDate(formatISOToRegionalDate(goal === 'new' ? today() : goal.startDate, preferredCurrency));
    setDeadline(goal === 'new' ? '' : formatISOToRegionalDate(goal.deadline, preferredCurrency));
  };
  const openMovement = (goal: Goal, type: 'CONTRIBUTION' | 'WITHDRAWAL') => {
    if (busy.current) return;
    setMovement({ goal, type }); setForm(null); setDeleting(null); setMessage(null);
    setMovementAmount(''); setMovementNotes(''); setMovementDate(formatISOToRegionalDate(today(), preferredCurrency)); operation.current = null;
  };
  const submit = async (work: () => Promise<unknown>, done: () => void) => {
    if (busy.current) return;
    busy.current = true; setSubmitting(true); setMessage(null);
    try { await work(); done(); await refresh(); }
    catch (err) { setMessage(err instanceof Error ? err.message : 'Não foi possível salvar. Tente novamente.'); }
    finally { busy.current = false; setSubmitting(false); }
  };
  const save = () => {
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
  return <View style={styles.container}>
    <View style={styles.row}><View style={styles.heading}><Text style={styles.eyebrow}>Finanças</Text><Text accessibilityRole="header" style={styles.title}>Metas financeiras</Text><Text style={styles.muted}>Acompanhe suas reservas. Aportes e retiradas não alteram receitas, despesas ou fluxo de caixa.</Text></View><Button label="Nova meta" onPress={() => openForm('new')} disabled={submitting} /></View>
    {message && <Text accessibilityRole="alert" style={styles.error}>{message}</Text>}
    {loading && <ActivityIndicator accessibilityLabel="Carregando metas" color="#0f766e" />}
    {error && <Text style={styles.error}>Não foi possível carregar metas.</Text>}
    {(error || message) && <Button label="Tentar novamente" onPress={() => { setMessage(null); void refetch().catch(() => setMessage('Não foi possível carregar metas.')); }} disabled={submitting} />}
    {data?.financialGoalsSummary && <View accessibilityLabel="Resumo das metas" style={styles.card}>
      <Text style={styles.cardTitle}>{data.financialGoalsSummary.count} metas</Text>
      <Text>Acumulado: {formatCurrency(data.financialGoalsSummary.totalAccumulated, preferredCurrency)}</Text>
      <Text>Alvo total: {formatCurrency(data.financialGoalsSummary.totalTarget, preferredCurrency)}</Text>
    </View>}
    {form && <View style={styles.card}><Text accessibilityRole="header" style={styles.cardTitle}>{form === 'new' ? 'Nova meta' : 'Editar meta'}</Text>
      <Field label="Nome da meta" value={name} onChange={setName} />
      <Field label="Descrição da meta" value={description} onChange={setDescription} multiline />
      <Field label="Valor-alvo" value={target} onChange={setTarget} numeric />
      <DatePickerInput label="Início" accessibilityLabel="Início da meta" value={startDate} onChangeText={setStartDate} currency={preferredCurrency} />
      <DatePickerInput label="Prazo" accessibilityLabel="Prazo da meta" value={deadline} onChangeText={setDeadline} currency={preferredCurrency} />
      <Text style={styles.muted}>Saldo inicial zero. Valores já poupados entram como primeiro aporte.</Text>
      <View style={styles.row}><Button label="Salvar meta" onPress={save} disabled={submitting} /><Button label="Cancelar" onPress={() => setForm(null)} disabled={submitting} /></View>
    </View>}
    {movement && <View style={styles.card}><Text accessibilityRole="header" style={styles.cardTitle}>{movement.type === 'CONTRIBUTION' ? 'Aporte' : 'Retirada'} · {movement.goal.name}</Text>
      <Field label="Valor do movimento" value={movementAmount} onChange={setMovementAmount} numeric />
      <DatePickerInput label="Data" accessibilityLabel="Data do movimento" value={movementDate} onChangeText={setMovementDate} currency={preferredCurrency} />
      <Field label="Observação do movimento" value={movementNotes} onChange={setMovementNotes} multiline />
      <View style={styles.row}><Button label={movement.type === 'CONTRIBUTION' ? 'Registrar aporte' : 'Registrar retirada'} onPress={saveMovement} disabled={submitting} /><Button label="Cancelar" onPress={() => setMovement(null)} disabled={submitting} /></View>
    </View>}
    {deleting && <View style={styles.card}><Text>Excluir meta {deleting.name}? Histórico será preservado, mas meta deixará de aparecer.</Text><View style={styles.row}><Button label="Confirmar exclusão" onPress={() => void submit(() => remove({ variables: { id: deleting.id } }), () => { if (history?.id === deleting.id) setHistory(null); setDeleting(null); })} disabled={submitting} /><Button label="Cancelar exclusão" onPress={() => setDeleting(null)} disabled={submitting} /></View></View>}
    <View style={styles.row}>{filters.map(f => <Pressable key={f.label} accessibilityRole="button" accessibilityState={{ selected: filter === f.status }} onPress={() => setFilter(f.status)} style={[styles.filter, filter === f.status && styles.selected]}><Text>{f.label}</Text></Pressable>)}</View>
    {!loading && !error && goals.length === 0 && <Text style={styles.muted}>Crie sua primeira meta financeira.</Text>}
    {!loading && goals.length > 0 && visible.length === 0 && <Text>Nenhuma meta neste filtro.</Text>}
    <View style={styles.grid}>{visible.map(goal => <View key={goal.id} style={[styles.card, styles.goal]}>
      <View style={styles.row}><Text accessibilityRole="header" style={styles.cardTitle}>{goal.name}</Text><Text style={goal.status === 'OVERDUE' ? styles.error : styles.eyebrow}>{statusLabels[goal.status]}</Text></View>
      {goal.description && <Text style={styles.muted}>{goal.description}</Text>}
      <Text style={styles.amount}>{formatCurrency(goal.accumulatedAmount, preferredCurrency)} de {formatCurrency(goal.targetAmount, preferredCurrency)}</Text>
      <View accessibilityRole="progressbar" accessibilityLabel={`Progresso de ${goal.name}`} accessibilityValue={{ min: 0, max: 100, now: Math.min(goal.progress, 100), text: `${goal.progress}%` }} style={styles.track}><View style={[styles.fill, { width: `${Math.min(goal.progress, 100)}%` }]} /></View>
      <Text>{goal.progress}%</Text><Text>Restante: {formatCurrency(goal.remainingAmount, preferredCurrency)}</Text><Text>Prazo: {formatISOToRegionalDate(goal.deadline, preferredCurrency)}</Text>
      <View style={styles.row}><Button label={`Aportar em ${goal.name}`} onPress={() => openMovement(goal, 'CONTRIBUTION')} disabled={submitting} /><Button label={`Retirar de ${goal.name}`} onPress={() => openMovement(goal, 'WITHDRAWAL')} disabled={submitting} /></View>
      <View style={styles.row}><Button label={`Histórico de ${goal.name}`} onPress={() => setHistory(goal)} disabled={submitting} /><Button label={`Editar meta ${goal.name}`} onPress={() => openForm(goal)} disabled={submitting} /><Button label={`Excluir meta ${goal.name}`} onPress={() => { setDeleting(goal); setForm(null); setMovement(null); setMessage(null); }} disabled={submitting} /></View>
    </View>)}</View>
    {history && <><History key={history.id} goal={history} currency={preferredCurrency} /><Button label="Fechar histórico" onPress={() => setHistory(null)} /></>}
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: 18 }, heading: { flex: 1, minWidth: 220, gap: 8 },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  eyebrow: { color: '#0f766e', fontWeight: '700' }, muted: { color: '#64748b', lineHeight: 22 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 18, gap: 12 },
  goal: { flexGrow: 1, flexBasis: 340, minWidth: 0 },
  cardTitle: { color: '#0f172a', fontSize: 18, fontWeight: '700' }, amount: { fontSize: 18, color: '#0f172a' },
  button: { backgroundColor: '#0f766e', borderRadius: 6, paddingHorizontal: 14, paddingVertical: 12, minHeight: 44 },
  buttonText: { color: '#fff', fontWeight: '600' }, disabled: { opacity: 0.5 },
  field: { gap: 6 }, label: { fontWeight: '600', color: '#334155' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 12, color: '#0f172a', backgroundColor: '#fff' },
  error: { color: '#b91c1c', lineHeight: 22 }, filter: { padding: 12, borderRadius: 6, backgroundColor: '#f1f5f9' },
  selected: { backgroundColor: '#ccfbf1' }, track: { backgroundColor: '#e2e8f0', height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { backgroundColor: '#0f766e', height: 10 }, historyRow: { gap: 4, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 8 }
});
