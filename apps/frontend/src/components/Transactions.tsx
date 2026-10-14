import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  Plus,
  Tag,
  Trash2
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
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
import { formatCurrency, formatDate } from '../utils/formatters';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';

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

export function Transactions(): React.JSX.Element {
  const { theme } = useTheme();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, loading, refetch } = useQuery<{
    myIncomes: TransactionItem[];
    myExpenses: TransactionItem[];
    myCategories: Category[];
    myProfile: {
      id: string;
      preferredCurrency: string;
    };
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

  const currency = (data?.myProfile?.preferredCurrency ?? 'BRL') as 'BRL' | 'USD' | 'EUR';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: theme.income }]}>FLUXO FINANCEIRO</Text>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: theme.textPrimary }]}
        >
          Transações
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Gerencie e acompanhe o extrato de todas as suas receitas e despesas realizadas.
        </Text>
      </View>

      {/* Form Nova Transação */}
      <Card style={styles.card} variant="surface">
        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
          Nova Transação
        </Text>

        {errorMessage && (
          <View style={[styles.errorBox, { backgroundColor: theme.expenseBadge }]}>
            <Text style={[styles.errorText, { color: theme.expense }]}>{errorMessage}</Text>
          </View>
        )}

        {/* Tipo: Despesa ou Receita */}
        <View style={styles.typeSelector}>
          <Pressable
            onPress={() => {
              setType('EXPENSE');
              setCategoryId('');
            }}
            style={[
              styles.typeOption,
              {
                backgroundColor: type === 'EXPENSE' ? theme.expenseBadge : theme.bgElevated,
                borderColor: type === 'EXPENSE' ? theme.expense : theme.borderElevated
              }
            ]}
          >
            <Text
              style={[
                styles.typeOptionText,
                { color: type === 'EXPENSE' ? theme.expense : theme.textSecondary }
              ]}
            >
              Despesa
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setType('INCOME');
              setCategoryId('');
            }}
            style={[
              styles.typeOption,
              {
                backgroundColor: type === 'INCOME' ? theme.incomeBadge : theme.bgElevated,
                borderColor: type === 'INCOME' ? theme.income : theme.borderElevated
              }
            ]}
          >
            <Text
              style={[
                styles.typeOptionText,
                { color: type === 'INCOME' ? theme.income : theme.textSecondary }
              ]}
            >
              Receita
            </Text>
          </Pressable>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Descrição</Text>
          <TextInput
            accessibilityLabel="Descrição da transação"
            onChangeText={setDescription}
            placeholder="Ex: Supermercado"
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

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Valor ({currency})</Text>
          <TextInput
            accessibilityLabel="Valor da transação"
            keyboardType="numeric"
            onChangeText={setAmount}
            placeholder="Ex: 150.00"
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

        {/* Categoria */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Categoria</Text>
          <View style={styles.catGrid}>
            {availableCategories.length === 0 && (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Crie categorias primeiro.
              </Text>
            )}
            {availableCategories.map((c) => {
              const isSelected = categoryId === c.id;
              return (
                <Pressable
                  accessibilityLabel={c.name}
                  accessibilityRole="button"
                  key={c.id}
                  onPress={() => setCategoryId(c.id)}
                  style={[
                    styles.catOption,
                    {
                      backgroundColor: isSelected ? c.color : theme.bgElevated,
                      borderColor: c.color
                    }
                  ]}
                >
                  <Tag color={isSelected ? '#FFFFFF' : c.color} size={13} style={{ marginRight: 4 }} />
                  <Text
                    style={{
                      color: isSelected ? '#FFFFFF' : c.color,
                      fontSize: 13,
                      fontWeight: '600'
                    }}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Botão Adicionar */}
        <Pressable
          accessibilityLabel="Adicionar transação"
          accessibilityRole="button"
          disabled={creatingI || creatingE}
          onPress={handleCreate}
          style={[
            styles.createButton,
            { backgroundColor: type === 'INCOME' ? theme.income : theme.expense },
            (creatingI || creatingE) && { opacity: 0.7 }
          ]}
        >
          {creatingI || creatingE ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Plus color="#FFFFFF" size={18} />
              <Text style={styles.createButtonText}>Adicionar</Text>
            </>
          )}
        </Pressable>
      </Card>

      {/* Extrato / Lista */}
      {loading ? (
        <ActivityIndicator color={theme.income} size="large" style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.list}>
          {transactions.length === 0 ? (
            <Card style={styles.emptyCard} variant="surface">
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Nenhuma transação encontrada.
              </Text>
            </Card>
          ) : (
            transactions.map((t) => {
              const cat = data?.myCategories.find((c) => c.id === t.categoryId);
              const isIncome = t.__typename === 'Income';

              return (
                <Card key={t.id} style={styles.transactionCard} variant="surface">
                  <View style={styles.tLeft}>
                    {isIncome ? (
                      <ArrowUpCircle color={theme.income} size={28} />
                    ) : (
                      <ArrowDownCircle color={theme.expense} size={28} />
                    )}
                    <View style={styles.tInfo}>
                      <Text style={[styles.tDesc, { color: theme.textPrimary }]}>
                        {t.description}
                      </Text>
                      <View style={styles.tMetaRow}>
                        {cat && (
                          <View
                            style={[
                              styles.catPill,
                              { backgroundColor: cat.color + '20' }
                            ]}
                          >
                            <Text style={[styles.tCat, { color: cat.color }]}>
                              {cat.name}
                            </Text>
                          </View>
                        )}
                        <Text style={[styles.tDate, { color: theme.textMuted }]}>
                          • {formatDate(t.occurredAt, currency)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.tRight}>
                    <Text
                      style={[
                        styles.tAmount,
                        { color: isIncome ? theme.income : theme.expense }
                      ]}
                    >
                      {isIncome ? '+' : '-'} {formatCurrency(t.amount, currency)}
                    </Text>

                    <Pressable
                      accessibilityLabel={`Excluir transação ${t.description}`}
                      accessibilityRole="button"
                      onPress={() => handleDelete(t.id, t.__typename)}
                      style={[styles.deleteButton, { backgroundColor: theme.bgElevated }]}
                    >
                      <Trash2 color={theme.expense} size={15} />
                    </Pressable>
                  </View>
                </Card>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  catOption: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  catPill: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  container: {
    gap: 20
  },
  createButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  deleteButton: {
    alignItems: 'center',
    borderRadius: 6,
    height: 32,
    justifyContent: 'center',
    width: 32
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic'
  },
  errorBox: {
    borderRadius: 6,
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
  formGroup: {
    gap: 6
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
  label: {
    fontSize: 13,
    fontWeight: '600'
  },
  list: {
    gap: 10
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20
  },
  tAmount: {
    fontSize: 16,
    fontWeight: '700'
  },
  tCat: {
    fontSize: 11,
    fontWeight: '700'
  },
  tDate: {
    fontSize: 12
  },
  tDesc: {
    fontSize: 15,
    fontWeight: '700'
  },
  tInfo: {
    gap: 4
  },
  tLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12
  },
  tMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  tRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16
  },
  title: {
    fontSize: 26,
    fontWeight: '700'
  },
  transactionCard: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14
  },
  typeOption: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: '700'
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 10
  },
  card: {
    gap: 14,
    padding: 20
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700'
  }
});
