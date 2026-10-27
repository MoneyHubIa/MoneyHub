import { gql } from '@apollo/client';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useResponsive } from '../theme/useResponsive';
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

function Button({
  label,
  accessibilityLabel,
  onPress,
  disabled = false,
  variant = 'primary'
}: {
  label: string;
  accessibilityLabel?: string;
  onPress(): void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const { theme } = useTheme();
  const bg =
    variant === 'danger'
      ? theme.expenseBadge
      : variant === 'secondary'
      ? theme.bgElevated
      : theme.income;
  const textColor =
    variant === 'danger'
      ? theme.expense
      : variant === 'secondary'
      ? theme.textPrimary
      : '#FFFFFF';
  const borderColor =
    variant === 'danger'
      ? theme.expense
      : variant === 'secondary'
      ? theme.borderElevated
      : theme.income;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: bg, borderColor },
        disabled && styles.disabled
      ]}
    >
      <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChange,
  numeric = false,
  multiline = false
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  numeric?: boolean;
  multiline?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        multiline={multiline}
        onChangeText={onChange}
        placeholderTextColor={theme.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: theme.bgElevated,
            borderColor: theme.borderElevated,
            color: theme.textPrimary
          }
        ]}
        value={value}
      />
    </View>
  );
}

function History({ goal, currency }: { goal: Goal; currency: string }) {
  const { theme } = useTheme();
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
  return (
    <View style={[styles.card, { backgroundColor: theme.bgSurface, borderColor: theme.border }]}>
      <Text accessibilityRole="header" style={[styles.cardTitle, { color: theme.textPrimary }]}>Histórico de {goal.name}</Text>
      <Text style={[styles.muted, { color: theme.textSecondary }]}>Movimentos preservados. Corrija valores com novo aporte ou retirada.</Text>
      {loading && <ActivityIndicator accessibilityLabel="Carregando histórico" color={theme.income} />}
      {(error || pageError) && <><Text style={[styles.error, { color: theme.expense }]}>Não foi possível carregar histórico.</Text><Button label="Tentar histórico novamente" onPress={() => void load(requestedCursor.current)} disabled={paging} /></>}
      {!loading && !error && page?.nodes.length === 0 && <Text style={{ color: theme.textMuted }}>Nenhum movimento registrado.</Text>}
      {page?.nodes.map(m => (
        <View key={m.id} style={[styles.historyRow, { borderBottomColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textPrimary }]}>{m.type === 'CONTRIBUTION' ? 'Aporte' : 'Retirada'} · {formatCurrency(m.amount, currency)}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{formatISOToRegionalDate(m.occurredOn, currency)}</Text>
          {m.notes && <Text style={{ color: theme.textMuted, fontSize: 13 }}>{m.notes}</Text>}
        </View>
      ))}
      <View style={styles.row}>
        {after && <Button label="Primeira página" onPress={() => void load(null)} disabled={paging} variant="secondary" />}
        {page?.hasNextPage && <Button label="Próxima página" onPress={() => void load(page.endCursor)} disabled={paging} variant="secondary" />}
      </View>
    </View>
  );
}

export function FinancialGoals({ preferredCurrency = 'BRL' }: { preferredCurrency?: string }) {
  const { theme } = useTheme();
  const { isDesktop } = useResponsive();
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

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, !isDesktop && styles.headerRowMobile]}>
        <View style={styles.heading}>
          <Text style={[styles.eyebrow, { color: theme.income }]}>Finanças</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>Metas financeiras</Text>
          <Text style={[styles.muted, { color: theme.textSecondary }]}>
            Acompanhe suas reservas. Aportes e retiradas não alteram receitas, despesas ou fluxo de caixa.
          </Text>
        </View>
        <Button label="Nova meta" onPress={() => openForm('new')} disabled={submitting} />
      </View>

      {message && <Text accessibilityRole="alert" style={[styles.error, { color: theme.expense }]}>{message}</Text>}
      {loading && <ActivityIndicator accessibilityLabel="Carregando metas" color={theme.income} />}
      {error && <Text style={[styles.error, { color: theme.expense }]}>Não foi possível carregar metas.</Text>}
      {(error || message) && (
        <Button label="Tentar novamente" onPress={() => { setMessage(null); void refetch().catch(() => setMessage('Não foi possível carregar metas.')); }} disabled={submitting} variant="secondary" />
      )}

      {data?.financialGoalsSummary && (
        <View accessibilityLabel="Resumo das metas" style={[styles.card, { backgroundColor: theme.bgSurface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{data.financialGoalsSummary.count} metas cadastradas</Text>
          <Text style={{ color: theme.income, fontSize: 15, fontWeight: '700' }}>
            Acumulado: {formatCurrency(data.financialGoalsSummary.totalAccumulated, preferredCurrency)}
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
            Alvo total: {formatCurrency(data.financialGoalsSummary.totalTarget, preferredCurrency)}
          </Text>
        </View>
      )}

      {form && (
        <View style={[styles.card, { backgroundColor: theme.bgSurface, borderColor: theme.border }]}>
          <Text accessibilityRole="header" style={[styles.cardTitle, { color: theme.textPrimary }]}>{form === 'new' ? 'Nova meta' : 'Editar meta'}</Text>
          <Field label="Nome da meta" value={name} onChange={setName} />
          <Field label="Descrição da meta" value={description} onChange={setDescription} multiline />
          <Field label="Valor-alvo" value={target} onChange={setTarget} numeric />
          <DatePickerInput label="Início" accessibilityLabel="Início da meta" value={startDate} onChangeText={setStartDate} currency={preferredCurrency} />
          <DatePickerInput label="Prazo" accessibilityLabel="Prazo da meta" value={deadline} onChangeText={setDeadline} currency={preferredCurrency} />
          <Text style={[styles.muted, { color: theme.textMuted }]}>Saldo inicial zero. Valores já poupados entram como primeiro aporte.</Text>
          <View style={styles.actionRow}>
            <Button label="Salvar meta" onPress={save} disabled={submitting} />
            <Button label="Cancelar" onPress={() => setForm(null)} disabled={submitting} variant="secondary" />
          </View>
        </View>
      )}

      {movement && (
        <View style={[styles.card, { backgroundColor: theme.bgSurface, borderColor: theme.border }]}>
          <Text accessibilityRole="header" style={[styles.cardTitle, { color: theme.textPrimary }]}>
            {movement.type === 'CONTRIBUTION' ? 'Aporte' : 'Retirada'} · {movement.goal.name}
          </Text>
          <Field label="Valor do movimento" value={movementAmount} onChange={setMovementAmount} numeric />
          <DatePickerInput label="Data" accessibilityLabel="Data do movimento" value={movementDate} onChangeText={setMovementDate} currency={preferredCurrency} />
          <Field label="Observação do movimento" value={movementNotes} onChange={setMovementNotes} multiline />
          <View style={styles.actionRow}>
            <Button
              label={movement.type === 'CONTRIBUTION' ? 'Registrar aporte' : 'Registrar retirada'}
              onPress={saveMovement}
              disabled={submitting}
            />
            <Button label="Cancelar" onPress={() => setMovement(null)} disabled={submitting} variant="secondary" />
          </View>
        </View>
      )}

      {deleting && (
        <View style={[styles.card, { backgroundColor: theme.bgSurface, borderColor: theme.border }]}>
          <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '600' }}>
            Excluir meta {deleting.name}? O histórico será preservado, mas a meta deixará de aparecer.
          </Text>
          <View style={styles.actionRow}>
            <Button
              label="Confirmar exclusão"
              onPress={() => void submit(() => remove({ variables: { id: deleting.id } }), () => { if (history?.id === deleting.id) setHistory(null); setDeleting(null); })}
              disabled={submitting}
              variant="danger"
            />
            <Button label="Cancelar exclusão" onPress={() => setDeleting(null)} disabled={submitting} variant="secondary" />
          </View>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {filters.map(f => {
          const isSelected = filter === f.status;
          return (
            <Pressable
              key={f.label}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => setFilter(f.status)}
              style={[
                styles.filterTab,
                {
                  backgroundColor: isSelected ? theme.income : theme.bgElevated,
                  borderColor: isSelected ? theme.income : theme.borderElevated
                }
              ]}
            >
              <Text
                style={{
                  color: isSelected ? '#FFFFFF' : theme.textSecondary,
                  fontWeight: isSelected ? '700' : '500',
                  fontSize: 13
                }}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!loading && !error && goals.length === 0 && (
        <Text style={[styles.muted, { color: theme.textMuted }]}>Crie sua primeira meta financeira.</Text>
      )}
      {!loading && goals.length > 0 && visible.length === 0 && (
        <Text style={{ color: theme.textMuted }}>Nenhuma meta neste filtro.</Text>
      )}

      {/* Goal Cards Grid */}
      <View style={styles.grid}>
        {visible.map(goal => (
          <View
            key={goal.id}
            style={[
              styles.card,
              styles.goal,
              !isDesktop && styles.goalMobile,
              { backgroundColor: theme.bgSurface, borderColor: theme.border }
            ]}
          >
            <View style={styles.goalHeaderRow}>
              <Text accessibilityRole="header" numberOfLines={1} style={[styles.cardTitle, { color: theme.textPrimary, flex: 1 }]}>
                {goal.name}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      goal.status === 'OVERDUE'
                        ? theme.expenseBadge
                        : goal.status === 'COMPLETED'
                        ? theme.incomeBadge
                        : theme.bgElevated
                  }
                ]}
              >
                <Text
                  style={{
                    color:
                      goal.status === 'OVERDUE'
                        ? theme.expense
                        : goal.status === 'COMPLETED'
                        ? theme.income
                        : theme.textSecondary,
                    fontSize: 11,
                    fontWeight: '700'
                  }}
                >
                  {statusLabels[goal.status]}
                </Text>
              </View>
            </View>

            {goal.description && (
              <Text numberOfLines={2} style={[styles.muted, { color: theme.textSecondary }]}>
                {goal.description}
              </Text>
            )}

            <Text numberOfLines={1} style={[styles.amount, { color: theme.textPrimary }]}>
              {formatCurrency(goal.accumulatedAmount, preferredCurrency)} de {formatCurrency(goal.targetAmount, preferredCurrency)}
            </Text>

            <View
              accessibilityLabel={`Progresso de ${goal.name}`}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: Math.min(goal.progress, 100), text: `${goal.progress}%` }}
              style={[styles.track, { backgroundColor: theme.bgElevated }]}
            >
              <View style={[styles.fill, { backgroundColor: theme.income, width: `${Math.min(goal.progress, 100)}%` }]} />
            </View>

            <View style={styles.metaInfoRow}>
              <Text style={{ color: theme.income, fontWeight: '700', fontSize: 13 }}>{goal.progress}%</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                Restante: {formatCurrency(goal.remainingAmount, preferredCurrency)}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                Prazo: {formatISOToRegionalDate(goal.deadline, preferredCurrency)}
              </Text>
            </View>

            {/* Quick Actions */}
            <View style={styles.cardActionsRow}>
              <Button
                accessibilityLabel={`Aportar em ${goal.name}`}
                label="Aportar"
                onPress={() => openMovement(goal, 'CONTRIBUTION')}
                disabled={submitting}
              />
              <Button
                accessibilityLabel={`Retirar de ${goal.name}`}
                label="Retirar"
                onPress={() => openMovement(goal, 'WITHDRAWAL')}
                disabled={submitting}
                variant="secondary"
              />
              <Button
                accessibilityLabel={`Histórico de ${goal.name}`}
                label="Histórico"
                onPress={() => setHistory(goal)}
                disabled={submitting}
                variant="secondary"
              />
              <Button
                accessibilityLabel={`Editar meta ${goal.name}`}
                label="Editar"
                onPress={() => openForm(goal)}
                disabled={submitting}
                variant="secondary"
              />
              <Button
                accessibilityLabel={`Excluir meta ${goal.name}`}
                label="Excluir"
                onPress={() => { setDeleting(goal); setForm(null); setMovement(null); setMessage(null); }}
                disabled={submitting}
                variant="danger"
              />
            </View>
          </View>
        ))}
      </View>

      {history && (
        <View style={{ gap: 10 }}>
          <History key={history.id} goal={history} currency={preferredCurrency} />
          <Button label="Fechar histórico" onPress={() => setHistory(null)} variant="secondary" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  amount: {
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    fontWeight: '700'
  },
  button: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '700'
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  cardActionsRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 10
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700'
  },
  container: {
    gap: 18
  },
  disabled: {
    opacity: 0.5
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  field: {
    gap: 6
  },
  fill: {
    borderRadius: 4,
    height: 8
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  filterTab: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  goal: {
    flexBasis: 340,
    flexGrow: 1,
    minWidth: 0
  },
  goalHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between'
  },
  goalMobile: {
    flexBasis: '100%',
    width: '100%'
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between'
  },
  headerRowMobile: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: 12
  },
  heading: {
    flex: 1,
    gap: 6,
    minWidth: 220
  },
  historyRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
    paddingVertical: 8
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 12
  },
  label: {
    fontSize: 13,
    fontWeight: '600'
  },
  metaInfoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between'
  },
  muted: {
    fontSize: 13,
    lineHeight: 18
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4
  },
  track: {
    borderRadius: 4,
    height: 8,
    overflow: 'hidden'
  }
});

