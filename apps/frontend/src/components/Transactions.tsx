import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { ArrowDownCircle, ArrowUpCircle, Plus, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

const MY_TRANSACTIONS_QUERY = gql`
  query MyTransactions {
    myIncomes {
      id
      categoryId
      description
      amount
      occurredAt
    }
    myExpenses {
      id
      categoryId
      description
      amount
      occurredAt
    }
    myCategories {
      id
      name
      type
      color
    }
    myProfile {
      id
      preferredCurrency
    }
  }
`;

import { formatCurrency, formatDate } from '../utils/formatters';

const CREATE_INCOME = gql`
  mutation CreateIncome($input: CreateIncomeInput!) {
    createIncome(input: $input) {
      id
    }
  }
`;

const CREATE_EXPENSE = gql`
  mutation CreateExpense($input: CreateExpenseInput!) {
    createExpense(input: $input) {
      id
    }
  }
`;

const DELETE_INCOME = gql`
  mutation DeleteIncome($id: ID!) {
    deleteIncome(id: $id)
  }
`;

const DELETE_EXPENSE = gql`
  mutation DeleteExpense($id: ID!) {
    deleteExpense(id: $id)
  }
`;

type TransactionItem = {
  id: string;
  categoryId: string;
  description: string;
  amount: string;
  occurredAt: string;
  __typename: 'Income' | 'Expense';
};

type Category = {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE' | 'BOTH';
  color: string;
};

export function Transactions() {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, loading, refetch } = useQuery<{
    myIncomes: TransactionItem[];
    myExpenses: TransactionItem[];
    myCategories: Category[];
    myProfile?: { id: string; preferredCurrency: string };
  }>(MY_TRANSACTIONS_QUERY);

  const [createIncome, { loading: creatingI }] = useMutation(CREATE_INCOME, {
    refetchQueries: ['DashboardSummary', 'MyTransactions'],
    onCompleted: () => resetForm(),
    onError: (err) => setErrorMessage(err.message)
  });
  const [createExpense, { loading: creatingE }] = useMutation(CREATE_EXPENSE, {
    refetchQueries: ['DashboardSummary', 'MyTransactions'],
    onCompleted: () => resetForm(),
    onError: (err) => setErrorMessage(err.message)
  });
  const [deleteIncome] = useMutation(DELETE_INCOME, {
    refetchQueries: ['DashboardSummary', 'MyTransactions'],
    onCompleted: () => refetch()
  });
  const [deleteExpense] = useMutation(DELETE_EXPENSE, {
    refetchQueries: ['DashboardSummary', 'MyTransactions'],
    onCompleted: () => refetch()
  });

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategoryId('');
    setErrorMessage(null);
    refetch();
  };

  const handleCreate = async () => {
    if (!description.trim()) return setErrorMessage('Informe a descrição.');
    if (!amount || isNaN(Number(amount))) return setErrorMessage('Informe um valor válido.');
    if (!categoryId) return setErrorMessage('Selecione uma categoria.');

    const variables = {
      input: {
        description: description.trim(),
        amount: Number(amount).toString(),
        categoryId,
        occurredAt: new Date().toISOString()
      }
    };

    if (type === 'INCOME') await createIncome({ variables });
    else await createExpense({ variables });
  };

  const handleDelete = async (id: string, typename: 'Income' | 'Expense') => {
    if (typename === 'Income') await deleteIncome({ variables: { id } });
    else await deleteExpense({ variables: { id } });
  };

  const transactions = useMemo(() => {
    if (!data) return [];
    const all = [
      ...(data.myIncomes || []).map((t) => ({ ...t, __typename: 'Income' as const })),
      ...(data.myExpenses || []).map((t) => ({ ...t, __typename: 'Expense' as const }))
    ];
    return all.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [data]);

  const availableCategories = (data?.myCategories || []).filter(
    (c) => c.type === type || c.type === 'BOTH'
  );

  const currency = data?.myProfile?.preferredCurrency ?? 'BRL';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Finanças</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Transações
        </Text>
        <Text style={styles.subtitle}>Gerencie suas receitas e despesas.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nova Transação</Text>
        {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        <View style={styles.typeSelector}>
          <Pressable
            onPress={() => { setType('EXPENSE'); setCategoryId(''); }}
            style={[styles.typeOption, type === 'EXPENSE' && styles.expenseOptionActive]}
          >
            <Text style={[styles.typeOptionText, type === 'EXPENSE' && styles.typeOptionTextActive]}>
              Despesa
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { setType('INCOME'); setCategoryId(''); }}
            style={[styles.typeOption, type === 'INCOME' && styles.incomeOptionActive]}
          >
            <Text style={[styles.typeOptionText, type === 'INCOME' && styles.typeOptionTextActive]}>
              Receita
            </Text>
          </Pressable>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Descrição</Text>
          <TextInput
            accessibilityLabel="Descrição da transação"
            onChangeText={setDescription}
            placeholder="Ex: Supermercado"
            style={styles.input}
            value={description}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Valor ({currency})</Text>
          <TextInput
            accessibilityLabel="Valor da transação"
            keyboardType="numeric"
            onChangeText={setAmount}
            placeholder="Ex: 150.00"
            style={styles.input}
            value={amount}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Categoria</Text>
          <View style={styles.catGrid}>
            {availableCategories.length === 0 && (
              <Text style={styles.emptyText}>Crie categorias primeiro.</Text>
            )}
            {availableCategories.map((c) => (
              <Pressable
                accessibilityLabel={c.name}
                accessibilityRole="button"
                key={c.id}
                onPress={() => setCategoryId(c.id)}
                style={[
                  styles.catOption,
                  categoryId === c.id && { borderColor: c.color, backgroundColor: c.color + '10' }
                ]}
              >
                <Text style={{ color: c.color, fontSize: 13, fontWeight: '600' }}>{c.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          accessibilityLabel="Adicionar transação"
          accessibilityRole="button"
          disabled={creatingI || creatingE}
          onPress={handleCreate}
          style={styles.createButton}
        >
          {creatingI || creatingE ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <>
              <Plus color="#ffffff" size={18} />
              <Text style={styles.createButtonText}>Adicionar</Text>
            </>
          )}
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color="#0f766e" size="large" style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.list}>
          {transactions.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma transação encontrada.</Text>
          ) : (
            transactions.map((t) => {
              const cat = data?.myCategories.find((c) => c.id === t.categoryId);
              const isIncome = t.__typename === 'Income';
              return (
                <View key={t.id} style={styles.transactionCard}>
                  <View style={styles.tLeft}>
                    {isIncome ? (
                      <ArrowUpCircle color="#059669" size={24} />
                    ) : (
                      <ArrowDownCircle color="#ef4444" size={24} />
                    )}
                    <View>
                      <Text style={styles.tDesc}>{t.description}</Text>
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <Text style={[styles.tCat, { color: cat?.color || '#64748b' }]}>
                          {cat?.name || 'Sem categoria'}
                        </Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12 }}>• {formatDate(t.occurredAt, currency)}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.tRight}>
                    <Text style={[styles.tAmount, isIncome ? styles.amountIn : styles.amountOut]}>
                      {isIncome ? '+' : '-'} {formatCurrency(t.amount, currency)}
                    </Text>
                    <Pressable onPress={() => handleDelete(t.id, t.__typename)}>
                      <Trash2 color="#ef4444" size={16} />
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20 },
  header: { gap: 8 },
  eyebrow: { color: '#0f766e', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: '#0f172a', fontSize: 26, fontWeight: '700' },
  subtitle: { color: '#64748b', fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: 8, borderWidth: 1, gap: 14, padding: 20 },
  cardTitle: { color: '#0f172a', fontSize: 18, fontWeight: '700' },
  errorText: { color: '#dc2626', fontSize: 13, backgroundColor: '#fef2f2', padding: 8, borderRadius: 4 },
  typeSelector: { flexDirection: 'row', gap: 10 },
  typeOption: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
  expenseOptionActive: { backgroundColor: '#fef2f2', borderColor: '#ef4444' },
  incomeOptionActive: { backgroundColor: '#ecfdf5', borderColor: '#059669' },
  typeOptionText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  typeOptionTextActive: { color: '#0f172a' },
  formGroup: { gap: 6 },
  label: { color: '#334155', fontSize: 14, fontWeight: '600' },
  input: { borderColor: '#cbd5e1', borderRadius: 6, borderWidth: 1, fontSize: 14, minHeight: 42, paddingHorizontal: 12, color: '#0f172a' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catOption: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  createButton: { alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 6, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 42, paddingHorizontal: 16 },
  createButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  list: { gap: 10 },
  emptyText: { color: '#64748b', fontSize: 14, fontStyle: 'italic' },
  transactionCard: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: 6, borderWidth: 1, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tDesc: { color: '#0f172a', fontSize: 15, fontWeight: '600' },
  tCat: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  tRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  tAmount: { fontSize: 16, fontWeight: '700' },
  amountIn: { color: '#059669' },
  amountOut: { color: '#ef4444' }
});
