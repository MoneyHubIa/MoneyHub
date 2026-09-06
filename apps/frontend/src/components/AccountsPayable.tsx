import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  AlertCircle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Pencil,
  PlusCircle,
  Tag,
  Trash2
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

const MY_ACCOUNTS_PAYABLE_QUERY = gql`
  query MyAccountsPayable($status: AccountPayableStatus) {
    myAccountsPayable(status: $status) {
      id
      categoryId
      costCenterId
      description
      amount
      dueDate
      status
      paidAt
      reminderOffsetDays
      createdAt
    }
    myCategories {
      id
      name
      type
      color
    }
    myCostCenters {
      id
      name
      description
    }
    myProfile {
      id
      preferredCurrency
    }
  }
`;

const CREATE_ACCOUNT_PAYABLE = gql`
  mutation CreateAccountPayable($input: CreateAccountPayableInput!) {
    createAccountPayable(input: $input) {
      id
      description
      amount
      dueDate
      status
    }
  }
`;

const UPDATE_ACCOUNT_PAYABLE = gql`
  mutation UpdateAccountPayable($input: UpdateAccountPayableInput!) {
    updateAccountPayable(input: $input) {
      id
      description
      amount
      dueDate
      status
      reminderOffsetDays
    }
  }
`;

const MARK_ACCOUNT_PAYABLE_PAID = gql`
  mutation MarkAccountPayablePaid($id: ID!, $paidAt: String) {
    markAccountPayablePaid(id: $id, paidAt: $paidAt) {
      id
      status
      paidAt
    }
  }
`;

const DELETE_ACCOUNT_PAYABLE = gql`
  mutation DeleteAccountPayable($id: ID!) {
    deleteAccountPayable(id: $id)
  }
`;

import { formatCurrency, formatDate, formatISOToRegionalDate, parseRegionalDateToISO } from '../utils/formatters';
import { DatePickerInput } from './DatePickerInput';

export type AccountPayableItem = {
  id: string;
  categoryId: string;
  costCenterId?: string | null;
  description: string;
  amount: string;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paidAt?: string | null;
  reminderOffsetDays?: number | null;
  createdAt: string;
};

const reminderOptions: Array<{ label: string; value: number | null }> = [
  { label: 'Sem lembrete', value: null },
  { label: 'No dia', value: 0 },
  { label: '1 dia antes', value: 1 },
  { label: '3 dias antes', value: 3 },
  { label: '7 dias antes', value: 7 }
];

type Category = {
  id: string;
  name: string;
  type: string;
  color: string;
};

type CostCenter = {
  id: string;
  name: string;
  description?: string | null;
};

export function AccountsPayable() {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${d}/${m}/${y}`;
  });
  const [categoryId, setCategoryId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [reminderOffsetDays, setReminderOffsetDays] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const queryStatus = activeStatusFilter === 'ALL' ? undefined : activeStatusFilter;

  const { data, loading, refetch } = useQuery<{
    myAccountsPayable: AccountPayableItem[];
    myCategories: Category[];
    myCostCenters: CostCenter[];
    myProfile?: { id: string; preferredCurrency: string };
  }>(MY_ACCOUNTS_PAYABLE_QUERY, {
    variables: { status: queryStatus },
    fetchPolicy: 'cache-and-network'
  });

  const [createPayable, { loading: creating }] = useMutation(CREATE_ACCOUNT_PAYABLE, {
    refetchQueries: ['MyAccountsPayable', 'DashboardSummary'],
    onCompleted: () => resetForm(),
    onError: (err) => setErrorMessage(err.message)
  });

  const [updatePayable, { loading: updating }] = useMutation(UPDATE_ACCOUNT_PAYABLE, {
    refetchQueries: ['MyAccountsPayable', 'DashboardSummary'],
    onCompleted: () => resetForm(),
    onError: (err) => setErrorMessage(err.message)
  });

  const [markPaid, { loading: markingPaid }] = useMutation(MARK_ACCOUNT_PAYABLE_PAID, {
    refetchQueries: ['MyAccountsPayable', 'DashboardSummary'],
    onCompleted: () => refetch(),
    onError: (err) => setErrorMessage(err.message)
  });

  const [deletePayable] = useMutation(DELETE_ACCOUNT_PAYABLE, {
    refetchQueries: ['MyAccountsPayable', 'DashboardSummary'],
    onCompleted: () => refetch(),
    onError: (err) => setErrorMessage(err.message)
  });

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategoryId('');
    setCostCenterId('');
    setReminderOffsetDays(null);
    setEditingId(null);
    setErrorMessage(null);
    refetch();
  };

  const handleSave = async () => {
    if (!description.trim()) {
      setErrorMessage('Informe uma descrição.');
      return;
    }
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      setErrorMessage('Informe um valor numérico positivo.');
      return;
    }
    if (!categoryId) {
      setErrorMessage('Selecione uma categoria.');
      return;
    }

    const isoDueDate = parseRegionalDateToISO(dueDate, currency);
    if (!isoDueDate) {
      setErrorMessage('Informe uma data de vencimento válida.');
      return;
    }

    setErrorMessage(null);

    const input = {
      description: description.trim(),
      amount: amount.trim(),
      dueDate: new Date(isoDueDate).toISOString(),
      categoryId,
      costCenterId: costCenterId || undefined,
      reminderOffsetDays
    };

    if (editingId) {
      await updatePayable({ variables: { input: { id: editingId, ...input } } });
      return;
    }

    await createPayable({ variables: { input: { ...input, status: 'PENDING' } } });
  };

  const handleEdit = (item: AccountPayableItem) => {
    setEditingId(item.id);
    setDescription(item.description);
    setAmount(item.amount);
    setDueDate(formatISOToRegionalDate(item.dueDate, currency));
    setCategoryId(item.categoryId);
    setCostCenterId(item.costCenterId ?? '');
    setReminderOffsetDays(item.reminderOffsetDays ?? null);
    setErrorMessage(null);
  };

  const items = data?.myAccountsPayable ?? [];
  const categories = (data?.myCategories ?? []).filter(
    (c) => c.type === 'EXPENSE' || c.type === 'BOTH'
  );
  const costCenters = data?.myCostCenters ?? [];
  const currency = data?.myProfile?.preferredCurrency ?? 'BRL';

  useEffect(() => {
    const firstCat = categories[0];
    if (firstCat && !categoryId) {
      setCategoryId(firstCat.id);
    }
  }, [categories, categoryId]);

  const totalPending = items
    .filter((i) => i.status === 'PENDING')
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  const countPending = items.filter((i) => i.status === 'PENDING').length;
  const countPaid = items.filter((i) => i.status === 'PAID').length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Obrigações Financeiras</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Contas a Pagar
        </Text>
        <Text style={styles.subtitle}>
          Gerencie compromissos financeiros, vencimentos e dê baixa em pagamentos efetuados.
        </Text>
      </View>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total a Pagar (Pendente)</Text>
          <Text style={[styles.kpiValue, styles.pendingAmount]}>
            {formatCurrency(totalPending.toString(), currency)}
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Contas Pendentes</Text>
          <Text style={styles.kpiValue}>{countPending}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Contas Pagas</Text>
          <Text style={[styles.kpiValue, styles.paidCount]}>{countPaid}</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>{editingId ? 'Editar Conta a Pagar' : 'Agendar Nova Conta a Pagar'}</Text>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <AlertCircle color="#dc2626" size={16} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Descrição</Text>
          <TextInput
            accessibilityLabel="Descrição da conta a pagar"
            onChangeText={setDescription}
            placeholder="Ex: Aluguel do escritório, Fornecedor X"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={description}
          />
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Valor ({currency})</Text>
            <TextInput
              accessibilityLabel="Valor da conta a pagar"
              keyboardType="decimal-pad"
              onChangeText={setAmount}
              placeholder="0,00"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={amount}
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1 }]}>
            <DatePickerInput
              accessibilityLabel="Data de vencimento"
              currency={currency}
              label="Data de Vencimento"
              onChangeText={setDueDate}
              value={dueDate}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Categoria de Despesa</Text>
          {categories.length === 0 ? (
            <Text style={styles.emptyCategoriesText}>
              Nenhuma categoria de despesa encontrada. Cadastre uma categoria na aba Categorias.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagSelector}>
              {categories.map((c) => (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  onPress={() => setCategoryId(c.id)}
                  style={[
                    styles.tagBadge,
                    categoryId === c.id && styles.tagBadgeSelected,
                    { borderColor: c.color || '#cbd5e1' }
                  ]}
                >
                  <Tag color={categoryId === c.id ? '#ffffff' : c.color || '#475569'} size={14} />
                  <Text style={[styles.tagText, categoryId === c.id && styles.tagTextSelected]}>
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {costCenters.length > 0 ? (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Centro de Custo (Opcional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagSelector}>
              <Pressable
                onPress={() => setCostCenterId('')}
                style={[styles.tagBadge, !costCenterId && styles.tagBadgeSelected]}
              >
                <Text style={[styles.tagText, !costCenterId && styles.tagTextSelected]}>
                  Nenhum
                </Text>
              </Pressable>
              {costCenters.map((cc) => (
                <Pressable
                  key={cc.id}
                  onPress={() => setCostCenterId(cc.id)}
                  style={[
                    styles.tagBadge,
                    costCenterId === cc.id && styles.tagBadgeSelected
                  ]}
                >
                  <Text style={[styles.tagText, costCenterId === cc.id && styles.tagTextSelected]}>
                    {cc.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Lembrete</Text>
          <View style={styles.optionRow}>
            {reminderOptions.map((option) => (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                accessibilityState={{ selected: reminderOffsetDays === option.value }}
                onPress={() => setReminderOffsetDays(option.value)}
                style={[styles.optionButton, reminderOffsetDays === option.value && styles.optionButtonSelected]}
              >
                <Text style={[styles.optionText, reminderOffsetDays === option.value && styles.optionTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={creating || updating}
          onPress={handleSave}
          style={[styles.submitButton, (creating || updating) && styles.submitButtonDisabled]}
        >
          {creating || updating ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <>
              <PlusCircle color="#ffffff" size={18} />
              <Text style={styles.submitButtonText}>{editingId ? 'Atualizar Conta a Pagar' : 'Agendar Conta a Pagar'}</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Contas Agendadas</Text>

          <View style={styles.filterTabs}>
            {(['ALL', 'PENDING', 'PAID'] as const).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveStatusFilter(tab)}
                style={[styles.filterTab, activeStatusFilter === tab && styles.filterTabActive]}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    activeStatusFilter === tab && styles.filterTabTextActive
                  ]}
                >
                  {tab === 'ALL' ? 'Todas' : tab === 'PENDING' ? 'Pendentes' : 'Pagas'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color="#0f766e" size="large" style={{ marginVertical: 32 }} />
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <CalendarClock color="#94a3b8" size={36} />
            <Text style={styles.emptyText}>Nenhuma conta a pagar encontrada.</Text>
          </View>
        ) : (
          <View style={styles.itemsList}>
            {items.map((item) => {
              const cat = categories.find((c) => c.id === item.categoryId);
              const isPaid = item.status === 'PAID';

              return (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemMain}>
                    <View style={styles.itemHeaderRow}>
                      <Text style={styles.itemDescription}>{item.description}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          isPaid ? styles.statusBadgePaid : styles.statusBadgePending
                        ]}
                      >
                        {isPaid ? (
                          <CheckCircle2 color="#059669" size={12} />
                        ) : (
                          <Clock color="#d97706" size={12} />
                        )}
                        <Text
                          style={[
                            styles.statusText,
                            isPaid ? styles.statusTextPaid : styles.statusTextPending
                          ]}
                        >
                          {isPaid ? 'Pago' : 'Pendente'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.itemMetaRow}>
                      <View style={styles.itemMeta}>
                        <Calendar color="#64748b" size={14} />
                        <Text style={styles.metaText}>Vencimento: {formatDate(item.dueDate, currency)}</Text>
                      </View>

                      {cat ? (
                        <View style={[styles.catBadge, { backgroundColor: cat.color + '18' }]}>
                          <Text style={[styles.catBadgeText, { color: cat.color }]}>{cat.name}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.itemActions}>
                    <Text style={styles.itemAmount}>
                      {formatCurrency(item.amount, currency)}
                    </Text>

                    <View style={styles.actionButtonsRow}>
                      <Pressable
                        accessibilityLabel={`Editar ${item.description}`}
                        accessibilityRole="button"
                        onPress={() => handleEdit(item)}
                        style={styles.editButton}
                      >
                        <Pencil color="#0f766e" size={16} />
                      </Pressable>
                      {!isPaid ? (
                        <Pressable
                          accessibilityRole="button"
                          disabled={markingPaid}
                          onPress={() => markPaid({ variables: { id: item.id } })}
                          style={styles.payButton}
                        >
                          <CheckCircle2 color="#ffffff" size={14} />
                          <Text style={styles.payButtonText}>Dar Baixa</Text>
                        </Pressable>
                      ) : null}

                      <Pressable
                        accessibilityRole="button"
                        onPress={() => deletePayable({ variables: { id: item.id } })}
                        style={styles.deleteButton}
                      >
                        <Trash2 color="#dc2626" size={16} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20, paddingBottom: 40 },
  header: { gap: 6 },
  eyebrow: { color: '#0f766e', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: '#0f172a', fontSize: 26, fontWeight: '700' },
  subtitle: { color: '#64748b', fontSize: 15, lineHeight: 22 },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: 8, borderWidth: 1, flex: 1, minWidth: 160, padding: 16 },
  kpiLabel: { color: '#64748b', fontSize: 13 },
  kpiValue: { color: '#0f172a', fontSize: 22, fontWeight: '700', marginTop: 4 },
  pendingAmount: { color: '#dc2626' },
  paidCount: { color: '#059669' },
  formCard: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: 8, borderWidth: 1, gap: 14, padding: 20 },
  formTitle: { color: '#0f172a', fontSize: 18, fontWeight: '700' },
  errorBox: { alignItems: 'center', backgroundColor: '#fef2f2', borderColor: '#fecaca', borderRadius: 6, borderWidth: 1, flexDirection: 'row', gap: 8, padding: 10 },
  errorText: { color: '#b91c1c', fontSize: 14, fontWeight: '500' },
  inputGroup: { gap: 6 },
  inputRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  label: { color: '#334155', fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1', borderRadius: 6, borderWidth: 1, color: '#0f172a', fontSize: 14, minHeight: 42, paddingHorizontal: 12 },
  tagSelector: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  tagBadge: { alignItems: 'center', backgroundColor: '#f8fafc', borderColor: '#cbd5e1', borderRadius: 6, borderWidth: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  tagBadgeSelected: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  tagText: { color: '#475569', fontSize: 13, fontWeight: '500' },
  tagTextSelected: { color: '#ffffff', fontWeight: '700' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionButton: { borderColor: '#cbd5e1', borderRadius: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  optionButtonSelected: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  optionText: { color: '#475569', fontSize: 12, fontWeight: '600' },
  optionTextSelected: { color: '#ffffff' },
  emptyCategoriesText: { color: '#b91c1c', fontSize: 13, paddingVertical: 4 },
  submitButton: { alignItems: 'center', backgroundColor: '#0f766e', borderRadius: 6, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 44, marginTop: 4, paddingHorizontal: 16 },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  listSection: { gap: 14 },
  listHeader: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  listTitle: { color: '#0f172a', fontSize: 20, fontWeight: '700' },
  filterTabs: { backgroundColor: '#f1f5f9', borderRadius: 6, flexDirection: 'row', padding: 3 },
  filterTab: { borderRadius: 4, paddingHorizontal: 12, paddingVertical: 6 },
  filterTabActive: { backgroundColor: '#ffffff', boxShadow: '0px 0px 2px rgba(0, 0, 0, 0.05)' },
  filterTabText: { color: '#64748b', fontSize: 13, fontWeight: '500' },
  filterTabTextActive: { color: '#0f172a', fontWeight: '700' },
  emptyCard: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: 8, borderWidth: 1, gap: 10, justifyContent: 'center', padding: 32 },
  emptyText: { color: '#94a3b8', fontSize: 14 },
  itemsList: { gap: 10 },
  itemCard: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: 8, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, padding: 16 },
  itemMain: { flex: 1, minWidth: 200, gap: 6 },
  itemHeaderRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  itemDescription: { color: '#0f172a', fontSize: 16, fontWeight: '600' },
  statusBadge: { alignItems: 'center', borderRadius: 4, flexDirection: 'row', gap: 4, paddingHorizontal: 6, paddingVertical: 2 },
  statusBadgePending: { backgroundColor: '#fef3c7' },
  statusBadgePaid: { backgroundColor: '#dcfce7' },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusTextPending: { color: '#b45309' },
  statusTextPaid: { color: '#15803d' },
  itemMetaRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  itemMeta: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  metaText: { color: '#64748b', fontSize: 12 },
  catBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  catBadgeText: { fontSize: 11, fontWeight: '600' },
  itemActions: { alignItems: 'flex-end', gap: 8 },
  itemAmount: { color: '#dc2626', fontSize: 17, fontWeight: '700' },
  actionButtonsRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  payButton: { alignItems: 'center', backgroundColor: '#059669', borderRadius: 4, flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  payButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  editButton: { padding: 4 },
  deleteButton: { padding: 4 }
});
