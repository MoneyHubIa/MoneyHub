import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  AlertCircle,
  Bell,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Pencil,
  PlusCircle,
  Tag,
  Trash2,
  X
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import {
  formatCurrency,
  formatDate,
  formatISOToRegionalDate,
  parseRegionalDateToISO
} from '../utils/formatters';
import { DatePickerInput } from './DatePickerInput';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';

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

export function AccountsPayable(): React.JSX.Element {
  const { theme } = useTheme();
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

  const categories = (data?.myCategories ?? []).filter(
    (c) => c.type === 'EXPENSE' || c.type === 'BOTH'
  );
  const costCenters = data?.myCostCenters ?? [];
  const currency = (data?.myProfile?.preferredCurrency ?? 'BRL') as 'BRL' | 'USD' | 'EUR';

  useEffect(() => {
    const firstCat = categories[0];
    if (firstCat && !categoryId) {
      setCategoryId(firstCat.id);
    }
  }, [categories, categoryId]);

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

  const totalPending = items
    .filter((i) => i.status === 'PENDING')
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  const countPending = items.filter((i) => i.status === 'PENDING').length;
  const countPaid = items.filter((i) => i.status === 'PAID').length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: theme.expense }]}>OBRIGAÇÕES FINANCEIRAS</Text>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: theme.textPrimary }]}
        >
          Contas a Pagar
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Gerencie compromissos financeiros, vencimentos e dê baixa em pagamentos efetuados.
        </Text>
      </View>

      {/* 3 KPIs */}
      <View style={styles.kpiRow}>
        <Card style={styles.kpiCard} variant="surface">
          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
            Total a Pagar (Pendente)
          </Text>
          <Text style={[styles.kpiValue, { color: theme.expense }]}>
            {formatCurrency(totalPending.toString(), currency)}
          </Text>
        </Card>

        <Card style={styles.kpiCard} variant="surface">
          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
            Contas Pendentes
          </Text>
          <Text style={[styles.kpiValue, { color: theme.warning }]}>
            {countPending}
          </Text>
        </Card>

        <Card style={styles.kpiCard} variant="surface">
          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
            Contas Pagas
          </Text>
          <Text style={[styles.kpiValue, { color: theme.income }]}>
            {countPaid}
          </Text>
        </Card>
      </View>

      {/* Form Criar / Editar */}
      <Card
        style={[
          styles.formCard,
          editingId ? { borderColor: theme.expense } : {}
        ]}
        variant={editingId ? 'elevated' : 'surface'}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.formTitle, { color: theme.textPrimary }]}>
            {editingId ? 'Editar Conta a Pagar' : 'Agendar Nova Conta a Pagar'}
          </Text>
          {editingId && (
            <Pressable onPress={resetForm} style={styles.cancelLink}>
              <X color={theme.textSecondary} size={16} />
              <Text style={[styles.cancelLinkText, { color: theme.textSecondary }]}>
                Cancelar edição
              </Text>
            </Pressable>
          )}
        </View>

        {errorMessage && (
          <View style={[styles.errorBox, { backgroundColor: theme.expenseBadge }]}>
            <AlertCircle color={theme.expense} size={16} />
            <Text style={[styles.errorText, { color: theme.expense }]}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Descrição</Text>
          <TextInput
            accessibilityLabel="Descrição da conta a pagar"
            onChangeText={setDescription}
            placeholder="Ex: Aluguel do escritório, Fornecedor X"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: theme.bgElevated,
                borderColor: theme.borderElevated,
                color: theme.textPrimary
              }
            ]}
            value={description}
          />
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Valor ({currency})</Text>
            <TextInput
              accessibilityLabel="Valor da conta a pagar"
              keyboardType="decimal-pad"
              onChangeText={setAmount}
              placeholder="0,00"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                {
                  backgroundColor: theme.bgElevated,
                  borderColor: theme.borderElevated,
                  color: theme.textPrimary
                }
              ]}
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

        {/* Categorias de Despesa */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Categoria de Despesa</Text>
          {categories.length === 0 ? (
            <Text style={[styles.emptyCategoriesText, { color: theme.expense }]}>
              Nenhuma categoria de despesa encontrada. Cadastre uma categoria na aba Categorias.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagSelector}>
              {categories.map((c) => {
                const isSelected = categoryId === c.id;
                return (
                  <Pressable
                    accessibilityLabel={c.name}
                    accessibilityRole="button"
                    key={c.id}
                    onPress={() => setCategoryId(c.id)}
                    style={[
                      styles.tagBadge,
                      {
                        backgroundColor: isSelected ? c.color || theme.expense : theme.bgElevated,
                        borderColor: c.color || theme.borderElevated
                      }
                    ]}
                  >
                    <Tag color={isSelected ? '#FFFFFF' : c.color || theme.textSecondary} size={14} />
                    <Text
                      style={[
                        styles.tagText,
                        { color: isSelected ? '#FFFFFF' : theme.textPrimary },
                        isSelected && styles.tagTextSelected
                      ]}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Centros de Custo */}
        {costCenters.length > 0 && (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Centro de Custo (Opcional)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagSelector}>
              <Pressable
                onPress={() => setCostCenterId('')}
                style={[
                  styles.tagBadge,
                  {
                    backgroundColor: !costCenterId ? theme.income : theme.bgElevated,
                    borderColor: !costCenterId ? theme.income : theme.borderElevated
                  }
                ]}
              >
                <Text
                  style={[
                    styles.tagText,
                    { color: !costCenterId ? '#FFFFFF' : theme.textSecondary },
                    !costCenterId && styles.tagTextSelected
                  ]}
                >
                  Nenhum
                </Text>
              </Pressable>
              {costCenters.map((cc) => {
                const isSelected = costCenterId === cc.id;
                return (
                  <Pressable
                    key={cc.id}
                    onPress={() => setCostCenterId(cc.id)}
                    style={[
                      styles.tagBadge,
                      {
                        backgroundColor: isSelected ? theme.income : theme.bgElevated,
                        borderColor: isSelected ? theme.income : theme.borderElevated
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        { color: isSelected ? '#FFFFFF' : theme.textPrimary },
                        isSelected && styles.tagTextSelected
                      ]}
                    >
                      {cc.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Lembrete */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Lembrete de Vencimento</Text>
          <View style={styles.optionRow}>
            {reminderOptions.map((option) => {
              const isSelected = reminderOffsetDays === option.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={option.label}
                  onPress={() => setReminderOffsetDays(option.value)}
                  style={[
                    styles.optionButton,
                    {
                      backgroundColor: isSelected ? theme.expense : theme.bgElevated,
                      borderColor: isSelected ? theme.expense : theme.borderElevated
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: isSelected ? '#FFFFFF' : theme.textSecondary },
                      isSelected && styles.optionTextSelected
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Botão Salvar / Atualizar */}
        <Pressable
          accessibilityRole="button"
          disabled={creating || updating}
          onPress={handleSave}
          style={[
            styles.submitButton,
            { backgroundColor: editingId ? theme.income : theme.expense },
            (creating || updating) && styles.submitButtonDisabled
          ]}
        >
          {creating || updating ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              {editingId ? (
                <Check color="#FFFFFF" size={18} />
              ) : (
                <PlusCircle color="#FFFFFF" size={18} />
              )}
              <Text style={styles.submitButtonText}>
                {editingId ? 'Atualizar Conta a Pagar' : 'Agendar Conta a Pagar'}
              </Text>
            </>
          )}
        </Pressable>
      </Card>

      {/* Lista de Contas */}
      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: theme.textPrimary }]}>
            Contas Agendadas
          </Text>

          <View style={[styles.filterTabs, { backgroundColor: theme.bgElevated }]}>
            {(['ALL', 'PENDING', 'PAID'] as const).map((tab) => {
              const isActive = activeStatusFilter === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => setActiveStatusFilter(tab)}
                  style={[
                    styles.filterTab,
                    isActive && [styles.filterTabActive, { backgroundColor: theme.bgSurface }]
                  ]}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      { color: isActive ? theme.textPrimary : theme.textSecondary },
                      isActive && styles.filterTabTextActive
                    ]}
                  >
                    {tab === 'ALL' ? 'Todas' : tab === 'PENDING' ? 'Pendentes' : 'Pagas'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.income} size="large" style={{ marginVertical: 32 }} />
        ) : items.length === 0 ? (
          <Card style={styles.emptyCard} variant="surface">
            <CalendarClock color={theme.textMuted} size={36} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Nenhuma conta a pagar encontrada.
            </Text>
          </Card>
        ) : (
          <View style={styles.itemsList}>
            {items.map((item) => {
              const cat = categories.find((c) => c.id === item.categoryId);
              const isPaid = item.status === 'PAID';

              return (
                <Card key={item.id} style={styles.itemCard} variant="surface">
                  <View style={styles.itemMain}>
                    <View style={styles.itemHeaderRow}>
                      <Text style={[styles.itemDescription, { color: theme.textPrimary }]}>
                        {item.description}
                      </Text>
                      <Badge
                        icon={isPaid ? CheckCircle2 : Clock}
                        label={isPaid ? 'Pago' : 'Pendente'}
                        tone={isPaid ? 'income' : 'warning'}
                      />
                    </View>

                    <View style={styles.itemMetaRow}>
                      <View style={styles.itemMeta}>
                        <Calendar color={theme.textSecondary} size={13} />
                        <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                          Vencimento: {formatDate(item.dueDate, currency)}
                        </Text>
                      </View>

                      {cat && (
                        <View style={[styles.catBadge, { backgroundColor: cat.color + '22' }]}>
                          <Text style={[styles.catBadgeText, { color: cat.color }]}>
                            {cat.name}
                          </Text>
                        </View>
                      )}

                      {item.reminderOffsetDays !== null && item.reminderOffsetDays !== undefined && (
                        <View style={[styles.reminderBadge, { backgroundColor: theme.bgElevated }]}>
                          <Bell color={theme.textSecondary} size={11} />
                          <Text style={[styles.reminderText, { color: theme.textSecondary }]}>
                            {item.reminderOffsetDays === 0
                              ? 'Lembrete no dia'
                              : `${item.reminderOffsetDays}d antes`}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.itemActions}>
                    <Text
                      style={[
                        styles.itemAmount,
                        { color: isPaid ? theme.textSecondary : theme.expense }
                      ]}
                    >
                      {formatCurrency(item.amount, currency)}
                    </Text>

                    <View style={styles.actionButtonsRow}>
                      <Pressable
                        accessibilityLabel={`Editar ${item.description}`}
                        accessibilityRole="button"
                        onPress={() => handleEdit(item)}
                        style={[styles.editButton, { backgroundColor: theme.bgElevated }]}
                      >
                        <Pencil color={theme.textSecondary} size={15} />
                      </Pressable>

                      {!isPaid && (
                        <Pressable
                          accessibilityRole="button"
                          disabled={markingPaid}
                          onPress={() => markPaid({ variables: { id: item.id } })}
                          style={[styles.payButton, { backgroundColor: theme.income }]}
                        >
                          <CheckCircle2 color="#FFFFFF" size={13} />
                          <Text style={styles.payButtonText}>Dar Baixa</Text>
                        </Pressable>
                      )}

                      <Pressable
                        accessibilityRole="button"
                        onPress={() => deletePayable({ variables: { id: item.id } })}
                        style={[styles.deleteButton, { backgroundColor: theme.bgElevated }]}
                      >
                        <Trash2 color={theme.expense} size={15} />
                      </Pressable>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actionButtonsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  cancelLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4
  },
  cancelLinkText: {
    fontSize: 13
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  catBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  container: {
    gap: 20,
    paddingBottom: 40
  },
  deleteButton: {
    alignItems: 'center',
    borderRadius: 6,
    height: 32,
    justifyContent: 'center',
    width: 32
  },
  editButton: {
    alignItems: 'center',
    borderRadius: 6,
    height: 32,
    justifyContent: 'center',
    width: 32
  },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    padding: 32
  },
  emptyCategoriesText: {
    fontSize: 13,
    paddingVertical: 4
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic'
  },
  errorBox: {
    alignItems: 'center',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 8,
    padding: 10
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600'
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  filterTab: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  filterTabActive: {
    elevation: 1
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500'
  },
  filterTabTextActive: {
    fontWeight: '700'
  },
  filterTabs: {
    borderRadius: 8,
    flexDirection: 'row',
    padding: 3
  },
  formCard: {
    gap: 14,
    padding: 20
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700'
  },
  header: {
    gap: 6
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 12
  },
  inputGroup: {
    gap: 6
  },
  inputRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  itemActions: {
    alignItems: 'flex-end',
    gap: 8
  },
  itemAmount: {
    fontSize: 17,
    fontWeight: '700'
  },
  itemCard: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    padding: 16
  },
  itemDescription: {
    fontSize: 16,
    fontWeight: '700'
  },
  itemHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  itemMain: {
    flex: 1,
    gap: 6,
    minWidth: 200
  },
  itemMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4
  },
  itemMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  itemsList: {
    gap: 10
  },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    padding: 16
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: '500'
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4
  },
  label: {
    fontSize: 13,
    fontWeight: '600'
  },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between'
  },
  listSection: {
    gap: 14
  },
  listTitle: {
    fontSize: 20,
    fontWeight: '700'
  },
  metaText: {
    fontSize: 12
  },
  optionButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600'
  },
  optionTextSelected: {
    fontWeight: '700'
  },
  payButton: {
    alignItems: 'center',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 4,
    height: 32,
    paddingHorizontal: 10
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  reminderBadge: {
    alignItems: 'center',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  reminderText: {
    fontSize: 11,
    fontWeight: '500'
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700'
  },
  submitButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 4,
    paddingHorizontal: 16
  },
  submitButtonDisabled: {
    opacity: 0.7
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20
  },
  tagBadge: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  tagSelector: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500'
  },
  tagTextSelected: {
    fontWeight: '700'
  },
  title: {
    fontSize: 26,
    fontWeight: '700'
  }
});
