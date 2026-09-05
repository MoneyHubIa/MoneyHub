import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  AlertCircle,
  Plus,
  RefreshCw,
  Repeat,
  Trash2,
  TrendingDown,
  TrendingUp
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
import { formatCurrency, formatDate, parseRegionalDateToISO } from '../utils/formatters';
import { DatePickerInput } from './DatePickerInput';

export const MY_RECURRING_TRANSACTIONS_QUERY = gql`
  query MyRecurringTransactions {
    myRecurringTransactions {
      id
      userId
      type
      categoryId
      costCenterId
      description
      amount
      recurrenceRule
      startDate
      endDate
      createdAt
      updatedAt
    }
    myCategories {
      id
      name
      type
      color
      icon
      createdAt
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

export const CREATE_RECURRING_TRANSACTION = gql`
  mutation CreateRecurringTransaction($input: CreateRecurringTransactionInput!) {
    createRecurringTransaction(input: $input) {
      id
      type
      description
      amount
      recurrenceRule
      startDate
    }
  }
`;

export const DELETE_RECURRING_TRANSACTION = gql`
  mutation DeleteRecurringTransaction($id: ID!) {
    deleteRecurringTransaction(id: $id)
  }
`;

export const PROCESS_RECURRING_TRANSACTIONS = gql`
  mutation ProcessRecurringTransactions {
    processRecurringTransactions {
      generatedPayables
      generatedReceivables
    }
  }
`;

export type RecurringTransactionItem = {
  id: string;
  userId: string;
  type: 'EXPENSE' | 'INCOME';
  categoryId: string;
  costCenterId?: string | null;
  description: string;
  amount: string;
  recurrenceRule: 'MONTHLY' | 'WEEKLY' | 'YEARLY';
  startDate: string;
  endDate?: string | null;
  createdAt: string;
  updatedAt: string;
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

type ProcessRecurringTransactionsData = {
  processRecurringTransactions: {
    generatedPayables: number;
    generatedReceivables: number;
  };
};

export function RecurringTransactions() {
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [recurrenceRule, setRecurrenceRule] = useState<'MONTHLY' | 'WEEKLY' | 'YEARLY'>('MONTHLY');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${d}/${m}/${y}`;
  });
  const [categoryId, setCategoryId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data, loading, refetch } = useQuery<{
    myRecurringTransactions: RecurringTransactionItem[];
    myCategories: Category[];
    myCostCenters: CostCenter[];
    myProfile?: { id: string; preferredCurrency: string };
  }>(MY_RECURRING_TRANSACTIONS_QUERY, {
    fetchPolicy: 'cache-and-network'
  });

  const [createRecurring, { loading: creating }] = useMutation(CREATE_RECURRING_TRANSACTION, {
    refetchQueries: ['MyRecurringTransactions', 'MyAccountsPayable', 'MyAccountsReceivable', 'DashboardSummary'],
    onCompleted: () => {
      resetForm();
      setSuccessMessage('Regra de recorrência cadastrada e conta agendada com sucesso!');
    },
    onError: (err) => setErrorMessage(err.message)
  });

  const [deleteRecurring] = useMutation(DELETE_RECURRING_TRANSACTION, {
    refetchQueries: ['MyRecurringTransactions'],
    onCompleted: () => {
      refetch();
      setSuccessMessage('Regra de recorrência excluída com sucesso.');
    },
    onError: (err) => setErrorMessage(err.message)
  });

  const [processRecurring, { loading: processing }] = useMutation<ProcessRecurringTransactionsData>(PROCESS_RECURRING_TRANSACTIONS, {
    refetchQueries: ['MyRecurringTransactions', 'MyAccountsPayable', 'MyAccountsReceivable', 'DashboardSummary'],
    onCompleted: (res) => {
      const p = res?.processRecurringTransactions?.generatedPayables ?? 0;
      const r = res?.processRecurringTransactions?.generatedReceivables ?? 0;
      setSuccessMessage(`Processamento concluído: ${p} conta(s) a pagar e ${r} conta(s) a receber geradas.`);
      refetch();
    },
    onError: (err) => setErrorMessage(err.message)
  });

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setErrorMessage(null);
    refetch();
  };

  const items = data?.myRecurringTransactions ?? [];
  const allCategories = data?.myCategories ?? [];
  const costCenters = data?.myCostCenters ?? [];
  const currency = data?.myProfile?.preferredCurrency ?? 'BRL';

  const filteredCategories = allCategories.filter((c) => {
    const t = String(c.type || '').toUpperCase();
    return type === 'EXPENSE'
      ? t === 'EXPENSE' || t === 'BOTH'
      : t === 'INCOME' || t === 'BOTH';
  });

  useEffect(() => {
    if (filteredCategories.length > 0) {
      const exists = filteredCategories.some((c) => c.id === categoryId);
      if (!exists) {
        setCategoryId(filteredCategories[0]!.id);
      }
    } else {
      setCategoryId('');
    }
  }, [type, allCategories, categoryId]);

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

    const isoStartDate = parseRegionalDateToISO(startDate, currency);
    if (!isoStartDate) {
      setErrorMessage('Informe uma data de início válida.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    await createRecurring({
      variables: {
        input: {
          type,
          categoryId,
          costCenterId: costCenterId || undefined,
          description: description.trim(),
          amount: Number(amount).toString(),
          recurrenceRule,
          startDate: new Date(isoStartDate).toISOString()
        }
      }
    });
  };

  const totalExpenseMonthly = items
    .filter((i) => i.type === 'EXPENSE')
    .reduce((acc, curr) => {
      const val = Number(curr.amount) || 0;
      if (curr.recurrenceRule === 'MONTHLY') return acc + val;
      if (curr.recurrenceRule === 'WEEKLY') return acc + val * 4.33;
      if (curr.recurrenceRule === 'YEARLY') return acc + val / 12;
      return acc + val;
    }, 0);

  const totalIncomeMonthly = items
    .filter((i) => i.type === 'INCOME')
    .reduce((acc, curr) => {
      const val = Number(curr.amount) || 0;
      if (curr.recurrenceRule === 'MONTHLY') return acc + val;
      if (curr.recurrenceRule === 'WEEKLY') return acc + val * 4.33;
      if (curr.recurrenceRule === 'YEARLY') return acc + val / 12;
      return acc + val;
    }, 0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.preTitle}>Planejamento</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Transações Recorrentes
          </Text>
          <Text style={styles.subtitle}>
            Cadastre receitas e despesas fixas com geração automática de contas a pagar e receber.
          </Text>
        </View>

        <Pressable
          accessibilityLabel="Sincronizar ciclos de recorrência"
          accessibilityRole="button"
          disabled={processing}
          onPress={() => processRecurring()}
          style={styles.syncButton}
        >
          {processing ? (
            <ActivityIndicator color="#0f766e" size="small" />
          ) : (
            <>
              <RefreshCw color="#0f766e" size={16} />
              <Text style={styles.syncButtonText}>Processar Ciclos</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconWrapper, { backgroundColor: '#fef2f2' }]}>
            <TrendingDown color="#dc2626" size={20} />
          </View>
          <Text style={styles.kpiLabel}>Despesas Fixas / Mês</Text>
          <Text style={[styles.kpiValue, { color: '#dc2626' }]}>
            {formatCurrency(totalExpenseMonthly, currency)}
          </Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconWrapper, { backgroundColor: '#f0fdf4' }]}>
            <TrendingUp color="#16a34a" size={20} />
          </View>
          <Text style={styles.kpiLabel}>Receitas Fixas / Mês</Text>
          <Text style={[styles.kpiValue, { color: '#16a34a' }]}>
            {formatCurrency(totalIncomeMonthly, currency)}
          </Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconWrapper, { backgroundColor: '#f8fafc' }]}>
            <Repeat color="#0f766e" size={20} />
          </View>
          <Text style={styles.kpiLabel}>Regras Ativas</Text>
          <Text style={styles.kpiValue}>{items.length}</Text>
        </View>
      </View>

      {errorMessage && (
        <View style={styles.errorBox}>
          <AlertCircle color="#dc2626" size={18} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {successMessage && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}

      {/* Creation Form */}
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Nova Regra de Recorrência</Text>

        <View style={styles.typeSelector}>
          <Pressable
            accessibilityLabel="Tipo Despesa"
            accessibilityRole="button"
            onPress={() => {
              setType('EXPENSE');
              setCategoryId('');
            }}
            style={[styles.typeOption, type === 'EXPENSE' && styles.typeOptionActiveExpense]}
          >
            <TrendingDown color={type === 'EXPENSE' ? '#ffffff' : '#64748b'} size={16} />
            <Text style={[styles.typeOptionText, type === 'EXPENSE' && styles.typeOptionTextActive]}>
              Despesa (Gera Conta a Pagar)
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Tipo Receita"
            accessibilityRole="button"
            onPress={() => {
              setType('INCOME');
              setCategoryId('');
            }}
            style={[styles.typeOption, type === 'INCOME' && styles.typeOptionActiveIncome]}
          >
            <TrendingUp color={type === 'INCOME' ? '#ffffff' : '#64748b'} size={16} />
            <Text style={[styles.typeOptionText, type === 'INCOME' && styles.typeOptionTextActive]}>
              Receita (Gera Conta a Receber)
            </Text>
          </Pressable>
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 2 }]}>
            <Text style={styles.label}>Descrição</Text>
            <TextInput
              accessibilityLabel="Descrição da recorrência"
              onChangeText={setDescription}
              placeholder={type === 'EXPENSE' ? 'Ex: Assinatura de Software' : 'Ex: Contrato de Prestação'}
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={description}
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Valor ({currency})</Text>
            <TextInput
              accessibilityLabel="Valor da recorrência"
              keyboardType="decimal-pad"
              onChangeText={setAmount}
              placeholder="0,00"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={amount}
            />
          </View>
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Frequência</Text>
            <View style={styles.frequencyRow}>
              {(['MONTHLY', 'WEEKLY', 'YEARLY'] as const).map((freq) => (
                <Pressable
                  key={freq}
                  onPress={() => setRecurrenceRule(freq)}
                  style={[
                    styles.frequencyButton,
                    recurrenceRule === freq && styles.frequencyButtonActive
                  ]}
                >
                  <Text
                    style={[
                      styles.frequencyButtonText,
                      recurrenceRule === freq && styles.frequencyButtonTextActive
                    ]}
                  >
                    {freq === 'MONTHLY' ? 'Mensal' : freq === 'WEEKLY' ? 'Semanal' : 'Anual'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.inputGroup, { flex: 1 }]}>
            <DatePickerInput
              accessibilityLabel="Data de Início"
              currency={currency}
              label="Data de Início"
              onChangeText={setStartDate}
              value={startDate}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Categoria</Text>
          {filteredCategories.length === 0 ? (
            <Text style={styles.emptyCategoriesText}>
              Nenhuma categoria encontrada para este tipo. Cadastre uma categoria na aba Categorias.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagSelector}>
              {filteredCategories.map((c) => (
                <Pressable
                  key={c.id}
                  accessibilityLabel={c.name}
                  accessibilityRole="button"
                  onPress={() => setCategoryId(c.id)}
                  style={[
                    styles.tagOption,
                    categoryId === c.id && { backgroundColor: c.color, borderColor: c.color }
                  ]}
                >
                  <Text
                    style={[
                      styles.tagOptionText,
                      categoryId === c.id && { color: '#ffffff', fontWeight: '700' }
                    ]}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {costCenters.length > 0 && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Centro de Custo (Opcional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagSelector}>
              <Pressable
                onPress={() => setCostCenterId('')}
                style={[styles.tagOption, costCenterId === '' && styles.tagOptionSelectedGeneric]}
              >
                <Text style={[styles.tagOptionText, costCenterId === '' && styles.typeOptionTextActive]}>
                  Nenhum
                </Text>
              </Pressable>
              {costCenters.map((cc) => (
                <Pressable
                  key={cc.id}
                  onPress={() => setCostCenterId(cc.id)}
                  style={[styles.tagOption, costCenterId === cc.id && styles.tagOptionSelectedGeneric]}
                >
                  <Text style={[styles.tagOptionText, costCenterId === cc.id && styles.typeOptionTextActive]}>
                    {cc.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <Pressable
          accessibilityLabel="Criar Regra de Recorrência"
          accessibilityRole="button"
          disabled={creating}
          onPress={handleCreate}
          style={styles.submitButton}
        >
          {creating ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Plus color="#ffffff" size={18} />
              <Text style={styles.submitButtonText}>Cadastrar Recorrência</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* List */}
      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Regras de Recorrência Ativas</Text>

        {loading ? (
          <ActivityIndicator color="#0f766e" style={{ padding: 24 }} />
        ) : items.length === 0 ? (
          <Text style={styles.emptyListText}>
            Nenhuma transação recorrente configurada. Cadastre sua primeira regra acima!
          </Text>
        ) : (
          <View style={styles.itemList}>
            {items.map((item) => {
              const category = allCategories.find((c) => c.id === item.categoryId);
              const isExpense = item.type === 'EXPENSE';
              const freqLabel =
                item.recurrenceRule === 'MONTHLY'
                  ? 'Mensal'
                  : item.recurrenceRule === 'WEEKLY'
                  ? 'Semanal'
                  : 'Anual';

              return (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemLeft}>
                    <View
                      style={[
                        styles.itemTypeBadge,
                        { backgroundColor: isExpense ? '#fef2f2' : '#f0fdf4' }
                      ]}
                    >
                      {isExpense ? (
                        <TrendingDown color="#dc2626" size={16} />
                      ) : (
                        <TrendingUp color="#16a34a" size={16} />
                      )}
                    </View>
                    <View>
                      <Text style={styles.itemDescription}>{item.description}</Text>
                      <View style={styles.itemMetaRow}>
                        <View
                          style={[
                            styles.categoryDot,
                            { backgroundColor: category?.color ?? '#94a3b8' }
                          ]}
                        />
                        <Text style={styles.itemCategory}>{category?.name ?? 'Sem categoria'}</Text>
                        <Text style={styles.itemMetaDot}>•</Text>
                        <Text style={styles.itemFrequency}>{freqLabel}</Text>
                        <Text style={styles.itemMetaDot}>•</Text>
                        <Text style={styles.itemDate}>Início: {formatDate(item.startDate, currency)}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.itemRight}>
                    <Text
                      style={[
                        styles.itemAmount,
                        { color: isExpense ? '#dc2626' : '#16a34a' }
                      ]}
                    >
                      {isExpense ? '- ' : '+ '}
                      {formatCurrency(item.amount, currency)}
                    </Text>

                    <Pressable
                      accessibilityLabel="Excluir regra de recorrência"
                      accessibilityRole="button"
                      onPress={() => deleteRecurring({ variables: { id: item.id } })}
                      style={styles.deleteButton}
                    >
                      <Trash2 color="#ef4444" size={16} />
                    </Pressable>
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
  container: {
    gap: 20,
    padding: 24
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  preTitle: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  title: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '800'
  },
  subtitle: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 2
  },
  syncButton: {
    alignItems: 'center',
    backgroundColor: '#f0fdfa',
    borderColor: '#ccfbf1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  syncButtonText: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '600'
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 16
  },
  kpiCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    padding: 16
  },
  kpiIconWrapper: {
    alignItems: 'center',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  kpiLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600'
  },
  kpiValue: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800'
  },
  errorBox: {
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 12
  },
  errorText: {
    color: '#dc2626',
    flex: 1,
    fontSize: 13,
    fontWeight: '500'
  },
  successBox: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  successText: {
    color: '#16a34a',
    fontSize: 13,
    fontWeight: '600'
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
    padding: 20
  },
  formTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700'
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12
  },
  typeOption: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 10
  },
  typeOptionActiveExpense: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626'
  },
  typeOptionActiveIncome: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a'
  },
  typeOptionText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600'
  },
  typeOptionTextActive: {
    color: '#ffffff'
  },
  inputRow: {
    flexDirection: 'row',
    gap: 16
  },
  inputGroup: {
    gap: 6
  },
  label: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600'
  },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 6,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 14,
    minHeight: 42,
    paddingHorizontal: 12
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 6
  },
  frequencyButton: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 10
  },
  frequencyButtonActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e'
  },
  frequencyButtonText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600'
  },
  frequencyButtonTextActive: {
    color: '#ffffff'
  },
  tagSelector: {
    flexDirection: 'row',
    paddingVertical: 2
  },
  tagOption: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  tagOptionSelectedGeneric: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e'
  },
  tagOptionText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '500'
  },
  emptyCategoriesText: {
    color: '#94a3b8',
    fontSize: 13
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
    paddingVertical: 12
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  listCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
    padding: 20
  },
  listTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700'
  },
  emptyListText: {
    color: '#94a3b8',
    fontSize: 14,
    paddingVertical: 12,
    textAlign: 'center'
  },
  itemList: {
    gap: 10
  },
  itemRow: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12
  },
  itemLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12
  },
  itemTypeBadge: {
    alignItems: 'center',
    borderRadius: 8,
    height: 32,
    justifyContent: 'center',
    width: 32
  },
  itemDescription: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700'
  },
  itemMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 2
  },
  categoryDot: {
    borderRadius: 4,
    height: 8,
    width: 8
  },
  itemCategory: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '500'
  },
  itemMetaDot: {
    color: '#cbd5e1',
    fontSize: 12
  },
  itemFrequency: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '600'
  },
  itemDate: {
    color: '#64748b',
    fontSize: 12
  },
  itemRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '700'
  },
  deleteButton: {
    padding: 6
  }
});
