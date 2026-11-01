import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  PieChart,
  Wallet
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { formatCurrency } from '../utils/formatters';

export const CATEGORY_ANALYSIS_QUERY = gql`
  query CategoryAnalysis($input: CategoryAnalysisInput) {
    categoryAnalysis(input: $input) {
      type
      month
      year
      totalAmount
      items {
        categoryId
        categoryName
        categoryColor
        categoryIcon
        totalAmount
        percentage
        transactionCount
      }
    }
  }
`;

export type CategoryAnalysisItem = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  totalAmount: string;
  percentage: number;
  transactionCount: number;
};

export type CategoryAnalysisData = {
  categoryAnalysis: {
    type: 'EXPENSE' | 'INCOME';
    month: number;
    year: number;
    totalAmount: string;
    items: CategoryAnalysisItem[];
  };
};

type CategoryAnalysisProps = Readonly<{
  financialAccountIds?: string[];
  preferredCurrency?: string;
  month?: number;
  year?: number;
}>;

export function CategoryAnalysis({
  financialAccountIds,
  preferredCurrency = 'BRL',
  month,
  year
}: CategoryAnalysisProps): React.JSX.Element {
  const { theme } = useTheme();
  const [analysisType, setAnalysisType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');

  const { data, loading, error, refetch } = useQuery<CategoryAnalysisData>(
    CATEGORY_ANALYSIS_QUERY,
    {
      variables: {
        input: {
          financialAccountIds: financialAccountIds?.length ? financialAccountIds : undefined,
          type: analysisType,
          month,
          year
        }
      },
      fetchPolicy: 'cache-and-network'
    }
  );

  const result = data?.categoryAnalysis;
  const items = result?.items ?? [];
  const totalAmount = result?.totalAmount ?? '0.00';
  const hasItems = items.length > 0;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.bgSurface,
          borderColor: theme.border
        }
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={[styles.iconBadge, { backgroundColor: theme.incomeBadge }]}>
            <PieChart color={theme.income} size={20} />
          </View>
          <View style={styles.titleCopy}>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>
              Análise por Categoria
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Distribuição e ranking de {analysisType === 'EXPENSE' ? 'despesas' : 'receitas'} no mês
            </Text>
          </View>
        </View>

        <View style={[styles.toggleGroup, { backgroundColor: theme.bgElevated }]}>
          <Pressable
            accessibilityLabel="Analisar Despesas"
            accessibilityRole="button"
            onPress={() => setAnalysisType('EXPENSE')}
            style={[
              styles.toggleButton,
              analysisType === 'EXPENSE' && [
                styles.toggleButtonActiveExpense,
                { backgroundColor: theme.expense }
              ]
            ]}
          >
            <ArrowDownLeft
              color={analysisType === 'EXPENSE' ? '#ffffff' : theme.textSecondary}
              size={14}
            />
            <Text
              style={[
                styles.toggleText,
                { color: analysisType === 'EXPENSE' ? '#ffffff' : theme.textSecondary },
                analysisType === 'EXPENSE' && styles.toggleTextActive
              ]}
            >
              Despesas
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Analisar Receitas"
            accessibilityRole="button"
            onPress={() => setAnalysisType('INCOME')}
            style={[
              styles.toggleButton,
              analysisType === 'INCOME' && [
                styles.toggleButtonActiveIncome,
                { backgroundColor: theme.income }
              ]
            ]}
          >
            <ArrowUpRight
              color={analysisType === 'INCOME' ? '#ffffff' : theme.textSecondary}
              size={14}
            />
            <Text
              style={[
                styles.toggleText,
                { color: analysisType === 'INCOME' ? '#ffffff' : theme.textSecondary },
                analysisType === 'INCOME' && styles.toggleTextActive
              ]}
            >
              Receitas
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Summary Total */}
      <View
        style={[
          styles.summaryBar,
          {
            backgroundColor: theme.bgElevated,
            borderColor: theme.borderElevated
          }
        ]}
      >
        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
          Total de {analysisType === 'EXPENSE' ? 'Despesas' : 'Receitas'}:
        </Text>
        <Text
          style={[
            styles.summaryValue,
            { color: analysisType === 'EXPENSE' ? theme.expense : theme.income }
          ]}
        >
          {formatCurrency(totalAmount, preferredCurrency)}
        </Text>
      </View>

      {/* Proportional Stacked Distribution Bar */}
      {hasItems ? (
        <View style={styles.distributionContainer}>
          <View style={[styles.stackedBar, { backgroundColor: theme.bgElevated }]}>
            {items.map((item) => (
              <View
                key={item.categoryId}
                style={[
                  styles.stackedSegment,
                  {
                    backgroundColor: item.categoryColor || theme.income,
                    width: `${Math.max(item.percentage, 2)}%`
                  }
                ]}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Content State */}
      {loading && items.length === 0 ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={theme.income} size="large" />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Carregando categorias...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={[styles.errorText, { color: theme.expense }]}>
            Erro ao carregar análise por categoria.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refetch()}
            style={[styles.retryButton, { backgroundColor: theme.income }]}
          >
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : !hasItems ? (
        <View style={styles.emptyBox}>
          <Wallet color={theme.textMuted} size={36} />
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
            Nenhum lançamento no período
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Cadastre transações com categorias para visualizar a distribuição dos seus recursos.
          </Text>
        </View>
      ) : (
        <View style={styles.rankingList}>
          {items.map((item, index) => (
            <View
              key={item.categoryId}
              style={[
                styles.card,
                {
                  backgroundColor: theme.bgElevated,
                  borderColor: theme.borderElevated
                }
              ]}
            >
              <View style={styles.cardLeft}>
                <Text style={[styles.rankIndex, { color: theme.textMuted }]}>#{index + 1}</Text>
                <View
                  style={[
                    styles.colorBadge,
                    { backgroundColor: item.categoryColor || theme.income }
                  ]}
                />
                <View style={styles.cardInfo}>
                  <Text style={[styles.categoryName, { color: theme.textPrimary }]}>
                    {item.categoryName}
                  </Text>
                  <Text style={[styles.transactionCount, { color: theme.textSecondary }]}>
                    {item.transactionCount}{' '}
                    {item.transactionCount === 1 ? 'lançamento' : 'lançamentos'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardRight}>
                <Text style={[styles.categoryAmount, { color: theme.textPrimary }]}>
                  {formatCurrency(item.totalAmount, preferredCurrency)}
                </Text>
                <View
                  style={[
                    styles.percentageBadge,
                    {
                      backgroundColor:
                        analysisType === 'EXPENSE' ? theme.expenseBadge : theme.incomeBadge
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.percentageText,
                      { color: analysisType === 'EXPENSE' ? theme.expense : theme.income }
                    ]}
                  >
                    {item.percentage.toFixed(1)}%
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  titleCopy: { flex: 1, minWidth: 0 },
  card: {
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  cardInfo: {
    flex: 1,
    gap: 2
  },
  cardLeft: {
    flexBasis: 180,
    minWidth: 0,
    maxWidth: '100%',
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10
  },
  cardRight: {
    maxWidth: '100%',
    alignItems: 'flex-end',
    gap: 4
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '700'
  },
  categoryName: {
    minWidth: 0,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600'
  },
  centerBox: {
    alignItems: 'center',
    gap: 8,
    height: 140,
    justifyContent: 'center'
  },
  colorBadge: {
    borderRadius: 4,
    height: 14,
    width: 14
  },
  container: {
    borderRadius: 14,
    borderWidth: 1,
    gap: 16,
    padding: 20,
    width: '100%'
  },
  distributionContainer: {
    gap: 6
  },
  emptyBox: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center'
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  errorText: {
    fontSize: 13
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between'
  },
  iconBadge: {
    alignItems: 'center',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  loadingText: {
    fontSize: 13
  },
  percentageBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  percentageText: {
    fontSize: 11,
    fontWeight: '700'
  },
  rankIndex: {
    fontSize: 13,
    fontWeight: '700',
    width: 24
  },
  rankingList: {
    gap: 10
  },
  retryButton: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600'
  },
  stackedBar: {
    borderRadius: 6,
    flexDirection: 'row',
    height: 12,
    overflow: 'hidden',
    width: '100%'
  },
  stackedSegment: {
    height: '100%'
  },
  subtitle: {
    fontSize: 13
  },
  summaryBar: {
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  summaryLabel: {
    minWidth: 0,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '500'
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700'
  },
  title: {
    fontSize: 18,
    fontWeight: '700'
  },
  titleGroup: {
    maxWidth: '100%',
    flexShrink: 1,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12
  },
  toggleButton: {
    alignItems: 'center',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  toggleButtonActiveExpense: {
    elevation: 1
  },
  toggleButtonActiveIncome: {
    elevation: 1
  },
  toggleGroup: {
    maxWidth: '100%',
    flexWrap: 'wrap',
    borderRadius: 8,
    flexDirection: 'row',
    padding: 3
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600'
  },
  toggleTextActive: {
    fontWeight: '700'
  },
  transactionCount: {
    fontSize: 11
  }
});
