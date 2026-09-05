import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import {
  ArrowDownLeft,
  ArrowUpRight,
  PieChart,
  Wallet
} from 'lucide-react-native';
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
  preferredCurrency?: string;
  month?: number;
  year?: number;
}>;

export function CategoryAnalysis({
  preferredCurrency = 'BRL',
  month,
  year
}: CategoryAnalysisProps) {
  const [analysisType, setAnalysisType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');

  const { data, loading, error, refetch } = useQuery<CategoryAnalysisData>(
    CATEGORY_ANALYSIS_QUERY,
    {
      variables: {
        input: {
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
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={styles.iconBadge}>
            <PieChart color="#0f766e" size={20} />
          </View>
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              Análise por Categoria
            </Text>
            <Text style={styles.subtitle}>
              Distribuição e ranking de {analysisType === 'EXPENSE' ? 'despesas' : 'receitas'} no mês
            </Text>
          </View>
        </View>

        <View style={styles.toggleGroup}>
          <Pressable
            accessibilityLabel="Analisar Despesas"
            accessibilityRole="button"
            onPress={() => setAnalysisType('EXPENSE')}
            style={[
              styles.toggleButton,
              analysisType === 'EXPENSE' && styles.toggleButtonActiveExpense
            ]}
          >
            <ArrowDownLeft
              color={analysisType === 'EXPENSE' ? '#ffffff' : '#64748b'}
              size={14}
            />
            <Text
              style={[
                styles.toggleText,
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
              analysisType === 'INCOME' && styles.toggleButtonActiveIncome
            ]}
          >
            <ArrowUpRight
              color={analysisType === 'INCOME' ? '#ffffff' : '#64748b'}
              size={14}
            />
            <Text
              style={[
                styles.toggleText,
                analysisType === 'INCOME' && styles.toggleTextActive
              ]}
            >
              Receitas
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Summary Total */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryLabel}>
          Total de {analysisType === 'EXPENSE' ? 'Despesas' : 'Receitas'}:
        </Text>
        <Text
          style={[
            styles.summaryValue,
            analysisType === 'EXPENSE' ? styles.expenseValue : styles.incomeValue
          ]}
        >
          {formatCurrency(totalAmount, preferredCurrency)}
        </Text>
      </View>

      {/* Proportional Stacked Distribution Bar */}
      {hasItems ? (
        <View style={styles.distributionContainer}>
          <View style={styles.stackedBar}>
            {items.map((item) => (
              <View
                key={item.categoryId}
                style={[
                  styles.stackedSegment,
                  {
                    backgroundColor: item.categoryColor || '#0f766e',
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
          <ActivityIndicator color="#0f766e" size="large" />
          <Text style={styles.loadingText}>Carregando categorias...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>Erro ao carregar análise por categoria.</Text>
          <Pressable onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : !hasItems ? (
        <View style={styles.emptyBox}>
          <Wallet color="#94a3b8" size={36} />
          <Text style={styles.emptyTitle}>Nenhum lançamento no período</Text>
          <Text style={styles.emptySubtitle}>
            Cadastre transações com categorias para visualizar a distribuição dos seus recursos.
          </Text>
        </View>
      ) : (
        <View style={styles.rankingList}>
          {items.map((item, index) => (
            <View key={item.categoryId} style={styles.card}>
              <View style={styles.cardLeft}>
                <Text style={styles.rankIndex}>#{index + 1}</Text>
                <View
                  style={[
                    styles.colorBadge,
                    { backgroundColor: item.categoryColor || '#0f766e' }
                  ]}
                />
                <View style={styles.cardInfo}>
                  <Text style={styles.categoryName}>{item.categoryName}</Text>
                  <Text style={styles.transactionCount}>
                    {item.transactionCount}{' '}
                    {item.transactionCount === 1 ? 'lançamento' : 'lançamentos'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardRight}>
                <Text style={styles.categoryAmount}>
                  {formatCurrency(item.totalAmount, preferredCurrency)}
                </Text>
                <View
                  style={[
                    styles.percentageBadge,
                    analysisType === 'EXPENSE'
                      ? styles.percentageBadgeExpense
                      : styles.percentageBadgeIncome
                  ]}
                >
                  <Text
                    style={[
                      styles.percentageText,
                      analysisType === 'EXPENSE'
                        ? styles.percentageTextExpense
                        : styles.percentageTextIncome
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
  container: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between'
  },
  titleGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12
  },
  iconBadge: {
    alignItems: 'center',
    backgroundColor: '#ccfbf1',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  title: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700'
  },
  subtitle: {
    color: '#64748b',
    fontSize: 13
  },
  toggleGroup: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    flexDirection: 'row',
    padding: 3
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
    backgroundColor: '#dc2626'
  },
  toggleButtonActiveIncome: {
    backgroundColor: '#059669'
  },
  toggleText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600'
  },
  toggleTextActive: {
    color: '#ffffff'
  },
  summaryBar: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500'
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700'
  },
  expenseValue: { color: '#dc2626' },
  incomeValue: { color: '#059669' },
  distributionContainer: {
    gap: 6
  },
  stackedBar: {
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    flexDirection: 'row',
    height: 12,
    overflow: 'hidden',
    width: '100%'
  },
  stackedSegment: {
    height: '100%'
  },
  rankingList: {
    gap: 10
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  cardLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: 10
  },
  rankIndex: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    width: 24
  },
  colorBadge: {
    borderRadius: 4,
    height: 14,
    width: 14
  },
  cardInfo: {
    flex: 1,
    gap: 2
  },
  categoryName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600'
  },
  transactionCount: {
    color: '#64748b',
    fontSize: 11
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 4
  },
  categoryAmount: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700'
  },
  percentageBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  percentageBadgeExpense: {
    backgroundColor: '#fef2f2'
  },
  percentageBadgeIncome: {
    backgroundColor: '#ecfdf5'
  },
  percentageText: {
    fontSize: 11,
    fontWeight: '700'
  },
  percentageTextExpense: {
    color: '#dc2626'
  },
  percentageTextIncome: {
    color: '#059669'
  },
  centerBox: {
    alignItems: 'center',
    gap: 8,
    height: 140,
    justifyContent: 'center'
  },
  loadingText: {
    color: '#64748b',
    fontSize: 13
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13
  },
  retryButton: {
    backgroundColor: '#0f766e',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600'
  },
  emptyBox: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24
  },
  emptyTitle: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600'
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center'
  }
});
