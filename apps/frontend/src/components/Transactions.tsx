import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  ArrowDownCircle,
  ArrowDownRight,
  ArrowUpCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Search,
  Tag,
  Trash2,
  WalletCards,
  X
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
import { useResponsive } from '../theme/useResponsive';
import { formatCurrency, formatDate, SupportedCurrency } from '../utils/formatters';
import { TransactionModal } from './TransactionModal';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';

export const MY_TRANSACTIONS_QUERY = gql`
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

export const DELETE_INCOME = gql`
  mutation DeleteIncome($id: ID!) {
    deleteIncome(id: $id)
  }
`;

export const DELETE_EXPENSE = gql`
  mutation DeleteExpense($id: ID!) {
    deleteExpense(id: $id)
  }
`;

export type TransactionItem = {
  id: string;
  categoryId: string;
  description: string;
  amount: string;
  occurredAt: string;
  __typename: 'Income' | 'Expense';
};

export type Category = {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE' | 'BOTH';
  color: string;
};

export type TransactionsQueryData = {
  myIncomes?: TransactionItem[];
  myExpenses?: TransactionItem[];
  myCategories?: Category[];
  myProfile?: {
    id: string;
    preferredCurrency: string;
  } | null;
};

type FilterType = 'ALL' | 'INCOME' | 'EXPENSE';

export interface TransactionsProps {
  initialModalOpen?: boolean | undefined;
  pageSize?: number | undefined;
}

export function Transactions({ initialModalOpen = false, pageSize: customPageSize }: TransactionsProps): React.JSX.Element {
  const { theme } = useTheme();
  const { isDesktop, height } = useResponsive();
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(initialModalOpen);

  const PAGE_SIZE =
    customPageSize ??
    (isDesktop
      ? height > 850
        ? 6
        : 5
      : height <= 850
      ? 4
      : 6);

  const { data, loading, refetch } = useQuery<TransactionsQueryData>(MY_TRANSACTIONS_QUERY);

  const [deleteIncome] = useMutation(DELETE_INCOME, {
    refetchQueries: ['DashboardSummary', 'MyTransactions'],
    onCompleted: () => refetch()
  });

  const [deleteExpense] = useMutation(DELETE_EXPENSE, {
    refetchQueries: ['DashboardSummary', 'MyTransactions'],
    onCompleted: () => refetch()
  });

  const handleDelete = async (id: string, typename: 'Income' | 'Expense') => {
    if (typename === 'Income') {
      await deleteIncome({ variables: { id } });
    } else {
      await deleteExpense({ variables: { id } });
    }
  };

  const handleFilterTypeChange = (ft: FilterType) => {
    setFilterType(ft);
    setPage(1);
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setPage(1);
  };

  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
    setPage(1);
  };

  const rawTransactions = useMemo<TransactionItem[]>(() => {
    if (!data) return [];
    const incomes = (data.myIncomes ?? []).map((t) => ({ ...t, __typename: 'Income' as const }));
    const expenses = (data.myExpenses ?? []).map((t) => ({ ...t, __typename: 'Expense' as const }));
    return [...incomes, ...expenses].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    );
  }, [data]);

  const currencyString = data?.myProfile?.preferredCurrency ?? 'BRL';
  const currency: SupportedCurrency =
    currencyString === 'USD' || currencyString === 'EUR' ? currencyString : 'BRL';

  // Compute summary totals for header
  const totalIncomes = useMemo(() => {
    return (data?.myIncomes ?? []).reduce((acc, curr) => acc + Number(curr.amount), 0);
  }, [data?.myIncomes]);

  const totalExpenses = useMemo(() => {
    return (data?.myExpenses ?? []).reduce((acc, curr) => acc + Number(curr.amount), 0);
  }, [data?.myExpenses]);

  const netBalance = totalIncomes - totalExpenses;

  const selectedCategory = useMemo(() => {
    return data?.myCategories?.find((c) => c.id === selectedCategoryId) ?? null;
  }, [data?.myCategories, selectedCategoryId]);

  // Filter by search & type & category
  const filteredTransactions = useMemo(() => {
    return rawTransactions.filter((t) => {
      if (filterType === 'INCOME' && t.__typename !== 'Income') return false;
      if (filterType === 'EXPENSE' && t.__typename !== 'Expense') return false;
      if (selectedCategoryId && t.categoryId !== selectedCategoryId) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const cat = data?.myCategories?.find((c) => c.id === t.categoryId);
        const matchDesc = t.description.toLowerCase().includes(query);
        const matchCat = cat?.name.toLowerCase().includes(query) ?? false;
        if (!matchDesc && !matchCat) return false;
      }

      return true;
    });
  }, [rawTransactions, filterType, selectedCategoryId, searchQuery, data?.myCategories]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, filteredTransactions.length);

  const paginatedTransactions = useMemo(() => {
    return filteredTransactions.slice(startIndex, endIndex);
  }, [filteredTransactions, startIndex, endIndex]);

  return (
    <View style={[styles.container, !isDesktop && styles.containerMobile]}>
      {/* Top Header */}
      <View style={[styles.header, !isDesktop && styles.headerMobile]}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.eyebrow, { color: theme.income }]}>FLUXO FINANCEIRO</Text>
            <Text
              accessibilityRole="header"
              style={[
                styles.title,
                { color: theme.textPrimary },
                !isDesktop && styles.titleMobile
              ]}
            >
              Transações
            </Text>
            {isDesktop && (
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Extrato completo de entradas e saídas efetivadas no período.
              </Text>
            )}
          </View>

          <Pressable
            accessibilityLabel="Nova Transação"
            accessibilityRole="button"
            onPress={() => setIsModalOpen(true)}
            style={({ pressed }) => [
              styles.newTxButton,
              { backgroundColor: theme.income, opacity: pressed ? 0.85 : 1 }
            ]}
          >
            <Plus color="#FFFFFF" size={18} strokeWidth={2.5} />
            <Text style={styles.newTxButtonText}>Nova Transação</Text>
          </Pressable>
        </View>

        {/* 3 Metric Mini Cards */}
        <View style={[styles.metricsRow, !isDesktop && styles.metricsRowMobile]}>
          <Card style={[styles.metricCard, !isDesktop && styles.metricCardMobile]} variant="surface">
            <View style={styles.metricHeader}>
              <Text
                style={[
                  styles.metricLabel,
                  { color: theme.textSecondary },
                  !isDesktop && styles.metricLabelMobile
                ]}
              >
                Entradas
              </Text>
              <ArrowUpRight color={theme.income} size={isDesktop ? 16 : 14} />
            </View>
            <Text
              style={[
                styles.metricValue,
                { color: theme.income },
                !isDesktop && styles.metricValueMobile
              ]}
            >
              {formatCurrency(totalIncomes.toString(), currency)}
            </Text>
            {isDesktop && (
              <Text style={[styles.metricSub, { color: theme.textMuted }]}>
                {data?.myIncomes?.length ?? 0} lançamentos
              </Text>
            )}
          </Card>

          <Card style={[styles.metricCard, !isDesktop && styles.metricCardMobile]} variant="surface">
            <View style={styles.metricHeader}>
              <Text
                style={[
                  styles.metricLabel,
                  { color: theme.textSecondary },
                  !isDesktop && styles.metricLabelMobile
                ]}
              >
                Saídas
              </Text>
              <ArrowDownRight color={theme.expense} size={isDesktop ? 16 : 14} />
            </View>
            <Text
              style={[
                styles.metricValue,
                { color: theme.expense },
                !isDesktop && styles.metricValueMobile
              ]}
            >
              {formatCurrency(totalExpenses.toString(), currency)}
            </Text>
            {isDesktop && (
              <Text style={[styles.metricSub, { color: theme.textMuted }]}>
                {data?.myExpenses?.length ?? 0} lançamentos
              </Text>
            )}
          </Card>

          <Card style={[styles.metricCard, !isDesktop && styles.metricCardMobile]} variant="surface">
            <View style={styles.metricHeader}>
              <Text
                style={[
                  styles.metricLabel,
                  { color: theme.textSecondary },
                  !isDesktop && styles.metricLabelMobile
                ]}
              >
                Balanço
              </Text>
              <WalletCards
                color={netBalance >= 0 ? theme.income : theme.expense}
                size={isDesktop ? 16 : 14}
              />
            </View>
            <Text
              style={[
                styles.metricValue,
                { color: netBalance >= 0 ? theme.income : theme.expense },
                !isDesktop && styles.metricValueMobile
              ]}
            >
              {formatCurrency(netBalance.toString(), currency)}
            </Text>
            {isDesktop && (
              <Text style={[styles.metricSub, { color: theme.textMuted }]}>
                Resultado líquido
              </Text>
            )}
          </Card>
        </View>
      </View>

      {/* Filter and Search Bar */}
      <Card style={styles.filterCard} variant="surface">
        <View style={styles.filterRow}>
          {/* Type Segmented Chips */}
          <View style={styles.filterChips}>
            {(['ALL', 'INCOME', 'EXPENSE'] as const).map((ft) => {
              const isActive = filterType === ft;
              const label = ft === 'ALL' ? 'Todas' : ft === 'INCOME' ? 'Receitas' : 'Despesas';
              const activeColor =
                ft === 'INCOME' ? theme.income : ft === 'EXPENSE' ? theme.expense : theme.brandAI;

              return (
                <Pressable
                  accessibilityLabel={`Filtrar ${label}`}
                  accessibilityRole="button"
                  key={ft}
                  onPress={() => handleFilterTypeChange(ft)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isActive ? activeColor : theme.bgElevated,
                      borderColor: isActive ? activeColor : theme.borderElevated
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: isActive ? '#FFFFFF' : theme.textSecondary, fontWeight: isActive ? '700' : '500' }
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Search Input */}
          <View
            style={[
              styles.searchBox,
              { backgroundColor: theme.bgElevated, borderColor: theme.borderElevated }
            ]}
          >
            <Search color={theme.textMuted} size={16} />
            <TextInput
              accessibilityLabel="Buscar transações"
              onChangeText={handleSearchChange}
              placeholder="Buscar por descrição..."
              placeholderTextColor={theme.textMuted}
              style={[styles.searchInput, { color: theme.textPrimary }]}
              value={searchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable
                accessibilityLabel="Limpar busca"
                accessibilityRole="button"
                onPress={() => handleSearchChange('')}
                style={{ padding: 4 }}
              >
                <X color={theme.textMuted} size={14} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Category Dropdown Filter */}
        {data?.myCategories && data.myCategories.length > 0 && (
          <View style={styles.dropdownContainer}>
            <Pressable
              accessibilityLabel="Selecionar filtro de categoria"
              accessibilityRole="button"
              onPress={() => setIsCategoryDropdownOpen((prev) => !prev)}
              style={({ pressed }) => [
                styles.categoryDropdownTrigger,
                {
                  backgroundColor: theme.bgElevated,
                  borderColor: isCategoryDropdownOpen ? theme.brandAI : theme.borderElevated,
                  opacity: pressed ? 0.85 : 1
                }
              ]}
            >
              <View style={styles.dropdownTriggerContent}>
                <Tag color={selectedCategory ? selectedCategory.color : theme.textMuted} size={15} />
                <Text
                  style={[
                    styles.dropdownTriggerText,
                    { color: selectedCategory ? theme.textPrimary : theme.textSecondary }
                  ]}
                  numberOfLines={1}
                >
                  {selectedCategory ? selectedCategory.name : 'Todas as Categorias'}
                </Text>
              </View>

              <View style={styles.dropdownTriggerActions}>
                {selectedCategoryId && (
                  <Pressable
                    accessibilityLabel="Limpar filtro de categoria"
                    accessibilityRole="button"
                    onPress={(e) => {
                      e.stopPropagation();
                      handleCategorySelect(null);
                    }}
                    style={styles.clearCatButton}
                  >
                    <X color={theme.textMuted} size={14} />
                  </Pressable>
                )}
                <ChevronDown
                  color={theme.textMuted}
                  size={16}
                  style={{
                    transform: [{ rotate: isCategoryDropdownOpen ? '180deg' : '0deg' }]
                  }}
                />
              </View>
            </Pressable>

            {/* Dropdown Options List */}
            {isCategoryDropdownOpen && (
              <View
                style={[
                  styles.dropdownMenu,
                  {
                    backgroundColor: theme.bgSurface,
                    borderColor: theme.borderElevated
                  }
                ]}
              >
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  style={styles.dropdownScroll}
                >
                  <Pressable
                    accessibilityLabel="Opção Todas as Categorias"
                    accessibilityRole="button"
                    onPress={() => {
                      handleCategorySelect(null);
                      setIsCategoryDropdownOpen(false);
                    }}
                    style={[
                      styles.dropdownItem,
                      selectedCategoryId === null && { backgroundColor: theme.bgElevated }
                    ]}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        {
                          color: selectedCategoryId === null ? theme.income : theme.textPrimary,
                          fontWeight: selectedCategoryId === null ? '700' : '500'
                        }
                      ]}
                    >
                      Todas as Categorias
                    </Text>
                    {selectedCategoryId === null && <Check color={theme.income} size={16} />}
                  </Pressable>

                  {data.myCategories.map((c) => {
                    const isSelected = selectedCategoryId === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        accessibilityLabel={`Opção categoria ${c.name}`}
                        accessibilityRole="button"
                        onPress={() => {
                          handleCategorySelect(c.id);
                          setIsCategoryDropdownOpen(false);
                        }}
                        style={[
                          styles.dropdownItem,
                          isSelected && { backgroundColor: theme.bgElevated }
                        ]}
                      >
                        <View style={styles.dropdownItemLeft}>
                          <View style={[styles.catDot, { backgroundColor: c.color }]} />
                          <Text
                            style={[
                              styles.dropdownItemText,
                              {
                                color: isSelected ? theme.income : theme.textPrimary,
                                fontWeight: isSelected ? '700' : '500'
                              }
                            ]}
                          >
                            {c.name}
                          </Text>
                        </View>
                        {isSelected && <Check color={theme.income} size={16} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </Card>

      {/* Extrato / Lista */}
      {loading && !data ? (
        <ActivityIndicator color={theme.income} size="large" style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.list}>
          {filteredTransactions.length === 0 ? (
            <Card style={styles.emptyCard} variant="surface">
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Nenhuma transação encontrada.
              </Text>
            </Card>
          ) : (
            <>
              {paginatedTransactions.map((t) => {
                const cat = data?.myCategories?.find((c) => c.id === t.categoryId);
                const isIncome = t.__typename === 'Income';

                return (
                  <Card
                    key={t.id}
                    style={[styles.transactionCard, !isDesktop && styles.transactionCardMobile]}
                    variant="surface"
                  >
                    {isDesktop ? (
                      <>
                        <View style={styles.tLeft}>
                          <View
                            style={[
                              styles.iconWrap,
                              {
                                backgroundColor: isIncome
                                  ? theme.incomeBadge
                                  : theme.expenseBadge
                              }
                            ]}
                          >
                            {isIncome ? (
                              <ArrowUpCircle color={theme.income} size={22} />
                            ) : (
                              <ArrowDownCircle color={theme.expense} size={22} />
                            )}
                          </View>

                          <View style={styles.tInfo}>
                            <Text style={[styles.tDesc, { color: theme.textPrimary }]}>
                              {t.description}
                            </Text>
                            <View style={styles.tMetaRow}>
                              {cat && (
                                <View
                                  style={[
                                    styles.catPill,
                                    { backgroundColor: `${cat.color}25`, borderColor: cat.color }
                                  ]}
                                >
                                  <Tag color={cat.color} size={11} style={{ marginRight: 3 }} />
                                  <Text style={[styles.tCat, { color: cat.color }]}>
                                    {cat.name}
                                  </Text>
                                </View>
                              )}
                              <Badge
                                icon={CheckCircle2}
                                label="Pago"
                                tone={isIncome ? 'income' : 'neutral'}
                              />
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
                            {`${isIncome ? '+' : '-'} ${formatCurrency(t.amount, currency)}`}
                          </Text>

                          <Pressable
                            accessibilityLabel={`Excluir transação ${t.description}`}
                            accessibilityRole="button"
                            onPress={() => void handleDelete(t.id, t.__typename)}
                            style={({ pressed }) => [
                              styles.deleteButton,
                              {
                                backgroundColor: theme.bgElevated,
                                borderColor: theme.borderElevated,
                                opacity: pressed ? 0.7 : 1
                              }
                            ]}
                          >
                            <Trash2 color={theme.expense} size={15} />
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <View style={styles.mobileCardContent}>
                        {/* Top Row: Icon + Description + Amount (matching Contas) */}
                        <View style={styles.mobileTopRow}>
                          <View style={styles.mobileTitleGroup}>
                            <View
                              style={[
                                styles.iconWrap,
                                {
                                  backgroundColor: isIncome
                                    ? theme.incomeBadge
                                    : theme.expenseBadge
                                }
                              ]}
                            >
                              {isIncome ? (
                                <ArrowUpCircle color={theme.income} size={20} />
                              ) : (
                                <ArrowDownCircle color={theme.expense} size={20} />
                              )}
                            </View>

                            <View style={styles.mobileDescWrap}>
                              <Text
                                numberOfLines={1}
                                style={[styles.tDesc, { color: theme.textPrimary }]}
                              >
                                {t.description}
                              </Text>
                              <Text style={[styles.tDate, { color: theme.textMuted }]}>
                                {formatDate(t.occurredAt, currency)}
                              </Text>
                            </View>
                          </View>

                          <Text
                            style={[
                              styles.tAmount,
                              styles.mobileAmount,
                              { color: isIncome ? theme.income : theme.expense }
                            ]}
                          >
                            {`${isIncome ? '+' : '-'} ${formatCurrency(t.amount, currency)}`}
                          </Text>
                        </View>

                        {/* Bottom Row: Badges on left + Delete action on right */}
                        <View style={styles.mobileBottomRow}>
                          <View style={styles.mobileBadgesRow}>
                            {cat && (
                              <View
                                style={[
                                  styles.catPill,
                                  { backgroundColor: `${cat.color}25`, borderColor: cat.color }
                                ]}
                              >
                                <Tag color={cat.color} size={11} style={{ marginRight: 3 }} />
                                <Text style={[styles.tCat, { color: cat.color }]}>
                                  {cat.name}
                                </Text>
                              </View>
                            )}
                            <Badge
                              icon={CheckCircle2}
                              label="Pago"
                              tone={isIncome ? 'income' : 'neutral'}
                            />
                          </View>

                          <Pressable
                            accessibilityLabel={`Excluir transação ${t.description}`}
                            accessibilityRole="button"
                            onPress={() => void handleDelete(t.id, t.__typename)}
                            style={({ pressed }) => [
                              styles.deleteButton,
                              styles.mobileDeleteButton,
                              {
                                backgroundColor: theme.bgElevated,
                                borderColor: theme.borderElevated,
                                opacity: pressed ? 0.7 : 1
                              }
                            ]}
                          >
                            <Trash2 color={theme.expense} size={14} />
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </Card>
                );
              })}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <Card
                  style={[styles.paginationCard, !isDesktop && styles.paginationCardMobile]}
                  variant="surface"
                >
                  <View style={styles.paginationRow}>
                    <Pressable
                      accessibilityLabel="Página anterior"
                      accessibilityRole="button"
                      disabled={currentPage <= 1}
                      onPress={() => setPage((p) => Math.max(1, p - 1))}
                      style={({ pressed }) => [
                        styles.pageButton,
                        !isDesktop && styles.pageButtonMobile,
                        {
                          backgroundColor: theme.bgElevated,
                          borderColor: theme.borderElevated,
                          opacity: currentPage <= 1 ? 0.4 : pressed ? 0.7 : 1
                        }
                      ]}
                    >
                      <ChevronLeft color={theme.textPrimary} size={15} />
                      <Text style={[styles.pageButtonText, { color: theme.textPrimary }]}>Anterior</Text>
                    </Pressable>

                    <View style={styles.pageInfoWrap}>
                      <Text style={[styles.pageIndicator, { color: theme.textPrimary }]}>
                        {`Página ${currentPage} de ${totalPages}`}
                      </Text>
                      {isDesktop ? (
                        <Text style={[styles.pageCounter, { color: theme.textMuted }]}>
                          {`Mostrando ${startIndex + 1} - ${endIndex} de ${filteredTransactions.length} transações`}
                        </Text>
                      ) : (
                        <Text style={[styles.pageCounter, { color: theme.textMuted }]}>
                          {`${startIndex + 1}-${endIndex} de ${filteredTransactions.length}`}
                        </Text>
                      )}
                    </View>

                    <Pressable
                      accessibilityLabel="Próxima página"
                      accessibilityRole="button"
                      disabled={currentPage >= totalPages}
                      onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                      style={({ pressed }) => [
                        styles.pageButton,
                        !isDesktop && styles.pageButtonMobile,
                        {
                          backgroundColor: theme.bgElevated,
                          borderColor: theme.borderElevated,
                          opacity: currentPage >= totalPages ? 0.4 : pressed ? 0.7 : 1
                        }
                      ]}
                    >
                      <Text style={[styles.pageButtonText, { color: theme.textPrimary }]}>Próxima</Text>
                      <ChevronRight color={theme.textPrimary} size={15} />
                    </Pressable>
                  </View>
                </Card>
              )}
            </>
          )}
        </View>
      )}

      {/* Floating Transaction Creation Modal */}
      <TransactionModal
        categories={data?.myCategories}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => void refetch()}
        preferredCurrency={currency}
        visible={isModalOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  catPill: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  container: {
    gap: 10
  },
  containerMobile: {
    gap: 8
  },
  deleteButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  emptyCard: {
    alignItems: 'center',
    padding: 36
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic'
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  filterCard: {
    padding: 8
  },
  filterChip: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 12
  },
  filterChipText: {
    fontSize: 13
  },
  filterChips: {
    flexDirection: 'row',
    gap: 8
  },
  filterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between'
  },
  header: {
    gap: 8
  },
  headerMobile: {
    gap: 6
  },
  headerTextWrap: {
    flex: 1,
    gap: 4
  },
  headerTitleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between'
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  list: {
    gap: 6
  },
  metricCard: {
    flexBasis: 180,
    flexGrow: 1,
    gap: 3,
    padding: 10
  },
  metricCardMobile: {
    flex: 1,
    flexBasis: 0,
    gap: 2,
    padding: 8
  },
  metricHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600'
  },
  metricLabelMobile: {
    fontSize: 11
  },
  metricSub: {
    fontSize: 11,
    marginTop: 2
  },
  metricValue: {
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    marginTop: 2
  },
  metricValueMobile: {
    fontSize: 13,
    marginTop: 0
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  metricsRowMobile: {
    flexWrap: 'nowrap',
    gap: 6
  },
  newTxButton: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 14
  },
  newTxButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  searchBox: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 240,
    flexDirection: 'row',
    flexGrow: 1,
    gap: 8,
    minHeight: 36,
    paddingHorizontal: 10
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 5
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18
  },
  tAmount: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '800'
  },
  tCat: {
    fontSize: 11,
    fontWeight: '700'
  },
  tDate: {
    fontSize: 11
  },
  tDesc: {
    fontSize: 14,
    fontWeight: '700'
  },
  tInfo: {
    flex: 1,
    gap: 3
  },
  tLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    marginRight: 10
  },
  tMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  tRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4
  },
  titleMobile: {
    fontSize: 20
  },
  transactionCard: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  transactionCardMobile: {
    flexDirection: 'column',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  mobileCardContent: {
    gap: 6,
    width: '100%'
  },
  mobileTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%'
  },
  mobileTitleGroup: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    marginRight: 8
  },
  mobileDescWrap: {
    flex: 1,
    gap: 2
  },
  mobileAmount: {
    flexShrink: 0,
    fontSize: 14,
    fontWeight: '800'
  },
  mobileBottomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 2,
    width: '100%'
  },
  mobileBadgesRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  mobileDeleteButton: {
    height: 30,
    width: 30
  },
  catDot: {
    borderRadius: 4,
    height: 8,
    width: 8
  },
  categoryChip: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600'
  },
  categoryFilterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10
  },
  pageButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexShrink: 0,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  pageButtonMobile: {
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  pageButtonText: {
    fontSize: 13,
    fontWeight: '600'
  },
  pageCounter: {
    fontSize: 11
  },
  pageIndicator: {
    fontSize: 13,
    fontWeight: '700'
  },
  pageInfoWrap: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  paginationCard: {
    padding: 8
  },
  paginationCardMobile: {
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  paginationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%'
  },
  dropdownContainer: {
    marginTop: 8,
    position: 'relative',
    width: '100%',
    zIndex: 50
  },
  categoryDropdownTrigger: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 38,
    paddingHorizontal: 12
  },
  dropdownTriggerContent: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8
  },
  dropdownTriggerText: {
    fontSize: 13,
    fontWeight: '600'
  },
  dropdownTriggerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6
  },
  clearCatButton: {
    padding: 2
  },
  dropdownMenu: {
    borderRadius: 10,
    borderWidth: 1,
    boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.2)',
    marginTop: 6,
    maxHeight: 240,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
    zIndex: 100
  },
  dropdownScroll: {
    maxHeight: 240
  },
  dropdownItem: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  dropdownItemLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  dropdownItemText: {
    fontSize: 13
  }
});
