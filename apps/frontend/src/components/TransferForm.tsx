import { gql } from '@apollo/client';
import { useApolloClient, useQuery } from '@apollo/client/react';
import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { formatISOToRegionalDate, parseRegionalDateToISO } from '../utils/formatters';
import { decimal } from '../utils/validation';
import { DatePickerInput } from './DatePickerInput';
import { FINANCIAL_ACCOUNTS_QUERY, type FinancialAccountItem } from './FinancialAccountSelector';
import { Button, Select, ThemedModal, ToggleButton } from './ui';
import { ValidatedInput } from './ui/ValidatedInput';

const TRANSFER = gql`mutation Transfer($input: TransferInput!) { createTransfer(input:$input) { id } }`;
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function TransferForm({ accounts, onSuccess, onBusyChange, disabled = false }: {
  accounts: FinancialAccountItem[];
  onSuccess(): void;
  onBusyChange(busy: boolean): void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const client = useApolloClient();
  const [selectedSourceId, setSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => formatISOToRegionalDate(today()));
  const [immediate, setImmediate] = useState(false);
  const [busy, setBusy] = useState(false);
  const unavailable = busy || disabled;
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const operation = useRef<{ key: string; id: string } | null>(null);
  const activeAccounts = accounts.filter(account => !account.archived);
  const sourceId = selectedSourceId || activeAccounts.find(account => account.isDefault)?.id || '';
  const dueDate = parseRegionalDateToISO(date);
  const parsedAmount = decimal(amount);
  const valid = !!parsedAmount && !!dueDate && sourceId !== destinationId
    && activeAccounts.some(account => account.id === sourceId)
    && activeAccounts.some(account => account.id === destinationId);
  const options = activeAccounts.map(account => ({ value: account.id, label: account.name }));

  async function save() {
    if (!valid || inFlight.current || disabled) return;
    const input = { sourceId, destinationId, amount: parsedAmount!, dueDate: dueDate!, ...(immediate ? { effectiveDate: dueDate! } : {}) };
    const key = JSON.stringify(input);
    if (operation.current?.key !== key) operation.current = { key, id: randomUUID() };
    inFlight.current = true;
    setBusy(true);
    onBusyChange(true);
    setMessage('');
    try {
      await client.mutate({ mutation: TRANSFER, variables: { input: { ...input, operationId: operation.current.id } } });
      await client.refetchQueries({ include: 'active' });
      operation.current = null;
      onSuccess();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível registrar a transferência. Tente novamente.');
    } finally {
      inFlight.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  return <View style={styles.form}>
    <Select label="Conta de origem" value={sourceId} onChange={setSourceId} disabled={unavailable} options={options} placeholder={options.length ? 'Selecione a conta de origem' : 'Nenhuma conta disponível'} />
    <Select label="Conta destino" value={destinationId} onChange={setDestinationId} disabled={unavailable} options={options} placeholder={options.length ? 'Selecione a conta de destino' : 'Nenhuma conta disponível'} />
    <View style={styles.amountDateRow}>
      <View style={styles.amountField}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Valor</Text>
        <ValidatedInput
          accessibilityLabel="Valor"
          moneyDigits={10}
          editable={!unavailable}
          value={amount}
          onChangeText={setAmount}
          style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.bgElevated, borderColor: theme.borderElevated }]}
        />
      </View>
      <View style={styles.dateField}>
        <DatePickerInput label="Data prevista" value={date} onChangeText={setDate} disabled={unavailable} />
      </View>
    </View>
    <ToggleButton compact singleLineLabel label="Já efetivada" value={immediate} onChange={setImmediate} disabled={unavailable} />
    {activeAccounts.length < 2 && <Text style={{ color: theme.textSecondary }}>Cadastre pelo menos duas contas financeiras ativas para transferir.</Text>}
    {!valid && <Text style={{ color: theme.textSecondary }}>Escolha contas diferentes, valor positivo e data válida.</Text>}
    {!!message && <Text accessibilityRole="alert" style={{ color: theme.expense }}>{message}</Text>}
    <Button title="Salvar" loading={busy} disabled={!valid || disabled} onPress={() => void save()} style={{ minHeight: 48 }} />
  </View>;
}

export function TransferModal({ onClose }: { onClose(): void }) {
  const { theme } = useTheme();
  const { data, loading, error, refetch } = useQuery<{ myFinancialAccounts: FinancialAccountItem[] }>(FINANCIAL_ACCOUNTS_QUERY);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const close = () => { if (!busyRef.current) onClose(); };

  return <ThemedModal visible title="Transferência" subtitle="Transfira ou agende valores entre suas contas financeiras" onClose={close} dismissDisabled={busy}>
    {loading ? <ActivityIndicator accessibilityLabel="Carregando contas financeiras" color={theme.income} /> : error ? <View style={styles.form}>
      <Text accessibilityRole="alert" style={{ color: theme.expense }}>Não foi possível carregar contas financeiras.</Text>
      <Button title="Tentar novamente" onPress={() => void refetch().catch(() => undefined)} />
    </View> : <TransferForm
      accounts={data?.myFinancialAccounts ?? []}
      onSuccess={onClose}
      onBusyChange={value => { busyRef.current = value; setBusy(value); }}
    />}
    <Button title="Cancelar" variant="secondary" disabled={busy} onPress={close} style={{ marginTop: 12, minHeight: 48 }} />
  </ThemedModal>;
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  label: { fontSize: 13, fontWeight: '600' },
  amountDateRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 },
  amountField: { width: 96, maxWidth: '100%', gap: 6 },
  dateField: { flex: 1, minWidth: 160 },
  input: { minHeight: 44, paddingHorizontal: 12, fontSize: 14, borderWidth: 1, borderRadius: 8 }
});
