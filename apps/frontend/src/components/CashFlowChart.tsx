import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from 'react-native';
import { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Layers,
  Scale
} from 'lucide-react-native';
import { formatCurrency } from '../utils/formatters';

export const CASH_FLOW_QUERY = gql`
  query CashFlow($input: CashFlowInput) {
    cashFlow(input: $input) {
      granularity
      dataPoints {
        label
        date
        income
        expense
        net
        accumulatedBalance
      }
      totals {
        totalIncome
        totalExpense
        netBalance
      }
    }
  }
`;

export type CashFlowDataPoint = {
  label: string;
  date: string;
  income: string;
  expense: string;
  net: string;
  accumulatedBalance: string;
};

export type CashFlowTotals = {
  totalIncome: string;
  totalExpense: string;
  netBalance: string;
};

export type CashFlowResultData = {
  cashFlow: {
    granularity: 'DAILY' | 'MONTHLY';
    dataPoints: CashFlowDataPoint[];
    totals: CashFlowTotals;
  };
};

type CashFlowChartProps = Readonly<{
  preferredCurrency?: string;
}>;

export function CashFlowChart({ preferredCurrency = 'BRL' }: CashFlowChartProps) {
  const { width } = useWindowDimensions();
  const desktop = width >= 768;
  const [granularity, setGranularity] = useState<'DAILY' | 'MONTHLY'>('DAILY');
  const [selectedPoint, setSelectedPoint] = useState<CashFlowDataPoint | null>(null);

  const { data, loading, error, refetch } = useQuery<CashFlowResultData>(CASH_FLOW_QUERY, {
    variables: {
      input: {
        granularity,
        monthsCount: granularity === 'MONTHLY' ? 6 : undefined
      }
    },
    fetchPolicy: 'cache-and-network'
  });

  const cashFlow = data?.cashFlow;
  const dataPoints = cashFlow?.dataPoints ?? [];
  const totals = cashFlow?.totals;

  // Calculate highest value for proportional bar rendering
  const maxVal = Math.max(
    ...dataPoints.map((p) => Math.max(Number(p.income), Number(p.expense))),
    100
  );

  const activePoint = selectedPoint ?? (dataPoints.length > 0 ? dataPoints[dataPoints.length - 1] : null);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
          <View style={styles.iconBadge}>
            <BarChart3 color="#0f766e" size={20} />
          </View>
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              Fluxo de Caixa
            </Text>
            <Text style={styles.subtitle}>
              Entradas, saídas e saldo acumulado no período
            </Text>
          </View>
        </View>

        <View style={styles.toggleGroup}>
          <Pressable
            accessibilityLabel="Visualização Diária"
            accessibilityRole="button"
            onPress={() => {
              setGranularity('DAILY');
              setSelectedPoint(null);
            }}
            style={[
              styles.toggleButton,
              granularity === 'DAILY' && styles.toggleButtonActive
            ]}
          >
            <Calendar
              color={granularity === 'DAILY' ? '#ffffff' : '#64748b'}
              size={14}
            />
            <Text
              style={[
                styles.toggleText,
                granularity === 'DAILY' && styles.toggleTextActive
              ]}
            >
              Diário (Mês)
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Visualização Mensal"
            accessibilityRole="button"
            onPress={() => {
              setGranularity('MONTHLY');
              setSelectedPoint(null);
            }}
            style={[
              styles.toggleButton,
              granularity === 'MONTHLY' && styles.toggleButtonActive
            ]}
          >
            <Layers
              color={granularity === 'MONTHLY' ? '#ffffff' : '#64748b'}
              size={14}
            />
            <Text
              style={[
                styles.toggleText,
                granularity === 'MONTHLY' && styles.toggleTextActive
              ]}
            >
              Mensal (6M)
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Totals Summary Ribbon */}
      <View style={styles.ribbon}>
        <View style={styles.ribbonItem}>
          <View style={styles.ribbonLabelGroup}>
            <ArrowUpRight color="#059669" size={16} />
            <Text style={styles.ribbonLabel}>Total Entradas</Text>
          </View>
          <Text style={[styles.ribbonValue, styles.incomeText]}>
            {formatCurrency(totals?.totalIncome ?? '0.00', preferredCurrency)}
          </Text>
        </View>

        <View style={styles.ribbonDivider} />

        <View style={styles.ribbonItem}>
          <View style={styles.ribbonLabelGroup}>
            <ArrowDownRight color="#dc2626" size={16} />
            <Text style={styles.ribbonLabel}>Total Saídas</Text>
          </View>
          <Text style={[styles.ribbonValue, styles.expenseText]}>
            {formatCurrency(totals?.totalExpense ?? '0.00', preferredCurrency)}
          </Text>
        </View>

        <View style={styles.ribbonDivider} />

        <View style={styles.ribbonItem}>
          <View style={styles.ribbonLabelGroup}>
            <Scale color="#0f766e" size={16} />
            <Text style={styles.ribbonLabel}>Saldo do Período</Text>
          </View>
          <Text
            style={[
              styles.ribbonValue,
              Number(totals?.netBalance ?? 0) >= 0
                ? styles.positiveText
                : styles.negativeText
            ]}
          >
            {formatCurrency(totals?.netBalance ?? '0.00', preferredCurrency)}
          </Text>
        </View>
      </View>

      {/* Active Point Detail Preview */}
      {activePoint ? (
        <View style={styles.detailBox}>
          <Text style={styles.detailLabel}>
            Detalhes de {activePoint.label} ({activePoint.date}):
          </Text>
          <View style={styles.detailPills}>
            <View style={[styles.pill, styles.pillIncome]}>
              <Text style={styles.pillText}>
                Entradas: {formatCurrency(activePoint.income, preferredCurrency)}
              </Text>
            </View>
            <View style={[styles.pill, styles.pillExpense]}>
              <Text style={styles.pillText}>
                Saídas: {formatCurrency(activePoint.expense, preferredCurrency)}
              </Text>
            </View>
            <View
              style={[
                styles.pill,
                Number(activePoint.net) >= 0 ? styles.pillPositive : styles.pillNegative
              ]}
            >
              <Text style={styles.pillText}>
                Líquido: {formatCurrency(activePoint.net, preferredCurrency)}
              </Text>
            </View>
            <View style={[styles.pill, styles.pillAccumulated]}>
              <Text style={styles.pillText}>
                Acumulado: {formatCurrency(activePoint.accumulatedBalance, preferredCurrency)}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Chart Canvas Area */}
      {loading && dataPoints.length === 0 ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color="#0f766e" size="large" />
          <Text style={styles.loadingText}>Carregando fluxo de caixa...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>Erro ao carregar dados do gráfico.</Text>
          <Pressable onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chartScrollContent}
        >
          <View style={styles.chartTrack}>
            {dataPoints.map((point) => {
              const isSelected = activePoint?.date === point.date;
              const incomeHeight = Math.max((Number(point.income) / maxVal) * 120, 3);
              const expenseHeight = Math.max((Number(point.expense) / maxVal) * 120, 3);
              const hasIncome = Number(point.income) > 0;
              const hasExpense = Number(point.expense) > 0;

              return (
                <Pressable
                  key={point.date}
                  accessibilityLabel={`Ponto ${point.label}`}
                  accessibilityRole="button"
                  onPress={() => setSelectedPoint(point)}
                  style={[
                    styles.barColumn,
                    isSelected && styles.barColumnSelected
                  ]}
                >
                  <View style={styles.barsContainer}>
                    {/* Income Bar */}
                    <View style={styles.singleBarWrapper}>
                      <View
                        style={[
                          styles.bar,
                          styles.incomeBar,
                          { height: incomeHeight },
                          !hasIncome && styles.emptyBar
                        ]}
                      />
                    </View>

                    {/* Expense Bar */}
                    <View style={styles.singleBarWrapper}>
                      <View
                        style={[
                          styles.bar,
                          styles.expenseBar,
                          { height: expenseHeight },
                          !hasExpense && styles.emptyBar
                        ]}
                      />
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.barLabel,
                      isSelected && styles.barLabelSelected
                    ]}
                  >
                    {point.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
          <Text style={styles.legendText}>Receitas Realizadas</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.legendText}>Despesas Realizadas</Text>
        </View>
      </View>
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
  headerTitleGroup: {
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
  toggleButtonActive: {
    backgroundColor: '#0f766e'
  },
  toggleText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600'
  },
  toggleTextActive: {
    color: '#ffffff'
  },
  ribbon: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingVertical: 12
  },
  ribbonItem: {
    alignItems: 'center',
    gap: 4,
    minWidth: 110,
    paddingHorizontal: 8
  },
  ribbonLabelGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4
  },
  ribbonLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500'
  },
  ribbonValue: {
    fontSize: 14,
    fontWeight: '700'
  },
  ribbonDivider: {
    backgroundColor: '#e2e8f0',
    height: '100%',
    width: 1
  },
  incomeText: { color: '#059669' },
  expenseText: { color: '#dc2626' },
  positiveText: { color: '#0f766e' },
  negativeText: { color: '#b91c1c' },
  detailBox: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12
  },
  detailLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600'
  },
  detailPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  pill: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  pillIncome: {
    backgroundColor: '#ecfdf5'
  },
  pillExpense: {
    backgroundColor: '#fef2f2'
  },
  pillPositive: {
    backgroundColor: '#f0fdfa'
  },
  pillNegative: {
    backgroundColor: '#fff1f2'
  },
  pillAccumulated: {
    backgroundColor: '#f1f5f9'
  },
  pillText: {
    color: '#1e293b',
    fontSize: 12,
    fontWeight: '600'
  },
  centerBox: {
    alignItems: 'center',
    gap: 8,
    height: 180,
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
  chartScrollContent: {
    paddingVertical: 10
  },
  chartTrack: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    height: 160,
    paddingHorizontal: 8
  },
  barColumn: {
    alignItems: 'center',
    borderRadius: 6,
    gap: 6,
    minWidth: 28,
    padding: 4
  },
  barColumnSelected: {
    backgroundColor: '#f1f5f9'
  },
  barsContainer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 3,
    height: 120
  },
  singleBarWrapper: {
    alignItems: 'center',
    height: 120,
    justifyContent: 'flex-end',
    width: 10
  },
  bar: {
    borderRadius: 3,
    width: 10
  },
  incomeBar: {
    backgroundColor: '#10b981'
  },
  expenseBar: {
    backgroundColor: '#ef4444'
  },
  emptyBar: {
    backgroundColor: '#e2e8f0',
    height: 3
  },
  barLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '500'
  },
  barLabelSelected: {
    color: '#0f766e',
    fontWeight: '700'
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    paddingTop: 4
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6
  },
  legendDot: {
    borderRadius: 9999,
    height: 8,
    width: 8
  },
  legendText: {
    color: '#64748b',
    fontSize: 12
  }
});
