import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  AlertCircle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
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

const MY_ACCOUNTS_RECEIVABLE_QUERY = gql`
  query MyAccountsReceivable($status: AccountReceivableStatus) {
    myAccountsReceivable(status: $status) {
      id
      categoryId
      costCenterId
      description
      amount
      dueDate
      status
      receivedAt
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

const CREATE_ACCOUNT_RECEIVABLE = gql`
  mutation CreateAccountReceivable($input: CreateAccountReceivableInput!) {
    createAccountReceivable(input: $input) {
      id
      description
      amount
      dueDate
      status
    }
  }
`;

const MARK_ACCOUNT_RECEIVABLE_RECEIVED = gql`
  mutation MarkAccountReceivableReceived($id: ID!, $receivedAt: String) {
    markAccountReceivableReceived(id: $id, receivedAt: $receivedAt) {
      id
      status
      receivedAt
    }
  }
`;

const DELETE_ACCOUNT_RECEIVABLE = gql`
  mutation DeleteAccountReceivable($id: ID!) {
    deleteAccountReceivable(id: $id)
  }
`;

import { formatCurrency, formatDate, getDatePlaceholder, parseRegionalDateToISO } from '../utils/formatters';
import { DatePickerInput } from './DatePickerInput';

export type AccountReceivableItem = {
  id: string;
  categoryId: string;
  costCenterId?: string | null;
  description: string;
  amount: string;
  dueDate: string;
  status: 'PENDING' | 'RECEIVED' | 'OVERDUE' | 'CANCELLED';
  receivedAt?: string | null;
  createdAt: string;
};

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

export function AccountsReceivable() {
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
  const [activeStatusFilter, setActiveStatusFilter] = useState<'ALL' | 'PENDING' | 'RECEIVED'>('ALL');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const queryStatus = activeStatusFilter === 'ALL' ? undefined : activeStatusFilter;

  const { data, loading, refetch } = useQuery<{
    myAccountsReceivable: AccountReceivableItem[];
    myCategories: Category[];
    myCostCenters: CostCenter[];
    myProfile?: { id: string; preferredCurrency: string };
  }>(MY_ACCOUNTS_RECEIVABLE_QUERY, {
    variables: { status: queryStatus },
    fetchPolicy: 'cache-and-network'
  });

  const [createReceivable, { loading: creating }] = useMutation(CREATE_ACCOUNT_RECEIVABLE, {
    refetchQueries: ['MyAccountsReceivable', 'DashboardSummary', 'MyIncomes'],
    onCompleted: () => resetForm(),
    onError: (err) => setErrorMessage(err.message)
  });

  const [markReceived, { loading: markingReceived }] = useMutation(MARK_ACCOUNT_RECEIVABLE_RECEIVED, {
    refetchQueries: ['MyAccountsReceivable', 'DashboardSummary', 'MyIncomes'],
    onCompleted: () => refetch(),
    onError: (err) => setErrorMessage(err.message)
  });

  const [deleteReceivable] = useMutation(DELETE_ACCOUNT_RECEIVABLE, {
    refetchQueries: ['MyAccountsReceivable', 'DashboardSummary', 'MyIncomes'],
    onCompleted: () => refetch(),
    onError: (err) => setErrorMessage(err.message)
  });

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategoryId('');
    setCostCenterId('');
    setErrorMessage(null);
    refetch();
  };

  const handleCreate = async () => {
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

    await createReceivable({
      variables: {
        input: {
          description: description.trim(),
          amount: Number(amount).toString(),
          dueDate: new Date(isoDueDate).toISOString(),
          categoryId,
          costCenterId: costCenterId || undefined,
          status: 'PENDING'
        }
      }
    });
  };

  const items = data?.myAccountsReceivable ?? [];
  const categories = (data?.myCategories ?? []).filter(
    (c) => c.type === 'INCOME' || c.type === 'BOTH'
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
  const countReceived = items.filter((i) => i.status === 'RECEIVED').length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Receitas Previstas</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Contas a Receber
        </Text>
        <Text style={styles.subtitle}>
          Gerencie previsões de recebimento, prazos e confirme a baixa dos valores recebidos.
        </Text>
      </View>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total a Receber (Pendente)</Text>
          <Text style={[styles.kpiValue, styles.pendingAmount]}>
            {formatCurrency(totalPending.toString(), currency)}
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Contas Pendentes</Text>
          <Text style={styles.kpiValue}>{countPending}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Contas Recebidas</Text>
          <Text style={[styles.kpiValue, styles.receivedCount]}>{countReceived}</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Agendar Nova Conta a Receber</Text>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <AlertCircle color="#dc2626" size={16} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Descrição</Text>
          <TextInput
            accessibilityLabel="Descrição da conta a receber"
            onChangeText={setDescription}
            placeholder="Ex: Fatura Cliente Y, Consultoria mensal"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={description}
          />
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Valor ({currency})</Text>
            <TextInput
              accessibilityLabel="Valor da conta a receber"
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
          <Text style={styles.label}>Categoria de Receita</Text>
          {categories.length === 0 ? (
            <Text style={styles.emptyCategoriesText}>
              Nenhuma categoria de receita encontrada. Cadastre uma categoria na aba Categorias.
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

        <Pressable
          accessibilityRole="button"
          disabled={creating}
          onPress={handleCreate}
          style={[styles.submitButton, creating && styles.submitButtonDisabled]}
        >
          {creating ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <>
              <PlusCircle color="#ffffff" size={18} />
              <Text style={styles.submitButtonText}>Agendar Conta a Receber</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Contas Agendadas</Text>

          <View style={styles.filterTabs}>
            {(['ALL', 'PENDING', 'RECEIVED'] as const).map((tab) => (
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
                  {tab === 'ALL' ? 'Todas' : tab === 'PENDING' ? 'Pendentes' : 'Recebidas'}
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
            <Text style={styles.emptyText}>Nenhuma conta a receber encontrada.</Text>
          </View>
        ) : (
          <View style={styles.itemsList}>
            {items.map((item) => {
              const cat = categories.find((c) => c.id === item.categoryId);
              const isReceived = item.status === 'RECEIVED';

              return (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemMain}>
                    <View style={styles.itemHeaderRow}>
                      <Text style={styles.itemDescription}>{item.description}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          isReceived ? styles.statusBadgeReceived : styles.statusBadgePending
                        ]}
                      >
                        {isReceived ? (
                          <CheckCircle2 color="#059669" size={12} />
                        ) : (
                          <Clock color="#d97706" size={12} />
                        )}
                        <Text
                          style={[
                            styles.statusText,
                            isReceived ? styles.statusTextReceived : styles.statusTextPending
                          ]}
                        >
                          {isReceived ? 'Recebido' : 'Pendente'}
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
                      {!isReceived ? (
                        <Pressable
                          accessibilityRole="button"
                          disabled={markingReceived}
                          onPress={() => markReceived({ variables: { id: item.id } })}
                          style={styles.receiveButton}
                        >
                          <CheckCircle2 color="#ffffff" size={14} />
                          <Text style={styles.receiveButtonText}>Dar Baixa</Text>
                        </Pressable>
                      ) : null}

                      <Pressable
                        accessibilityRole="button"
                        onPress={() => deleteReceivable({ variables: { id: item.id } })}
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
  pendingAmount: { color: '#059669' },
  receivedCount: { color: '#059669' },
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
  emptyCategoriesText: { color: '#b91c1c', fontSize: 13, paddingVertical: 4 },
  submitButton: { alignItems: 'center', backgroundColor: '#0f766e', borderRadius: 6, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 44, marginTop: 4, paddingHorizontal: 16 },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  listSection: { gap: 14 },
  listHeader: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  listTitle: { color: '#0f172a', fontSize: 20, fontWeight: '700' },
  filterTabs: { backgroundColor: '#f1f5f9', borderRadius: 6, flexDirection: 'row', padding: 3 },
  filterTab: { borderRadius: 4, paddingHorizontal: 12, paddingVertical: 6 },
  filterTabActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
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
  statusBadgeReceived: { backgroundColor: '#dcfce7' },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusTextPending: { color: '#b45309' },
  statusTextReceived: { color: '#15803d' },
  itemMetaRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  itemMeta: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  metaText: { color: '#64748b', fontSize: 12 },
  catBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  catBadgeText: { fontSize: 11, fontWeight: '600' },
  itemActions: { alignItems: 'flex-end', gap: 8 },
  itemAmount: { color: '#059669', fontSize: 17, fontWeight: '700' },
  actionButtonsRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  receiveButton: { alignItems: 'center', backgroundColor: '#059669', borderRadius: 4, flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  receiveButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  deleteButton: { padding: 4 }
});
