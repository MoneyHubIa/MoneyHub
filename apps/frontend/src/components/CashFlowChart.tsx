import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Layers,
  Scale
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
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

export function CashFlowChart({ preferredCurrency = 'BRL' }: CashFlowChartProps): React.JSX.Element {
  const { theme, isDark } = useTheme();
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
        <View style={styles.headerTitleGroup}>
          <View style={[styles.iconBadge, { backgroundColor: theme.incomeBadge }]}>
            <BarChart3 color={theme.income} size={20} />
          </View>
          <View>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>
              Fluxo de Caixa
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Entradas, saídas e saldo acumulado no período
            </Text>
          </View>
        </View>

        <View style={[styles.toggleGroup, { backgroundColor: theme.bgElevated }]}>
          <Pressable
            accessibilityLabel="Visualização Diária"
            accessibilityRole="button"
            onPress={() => {
              setGranularity('DAILY');
              setSelectedPoint(null);
            }}
            style={[
              styles.toggleButton,
              granularity === 'DAILY' && [styles.toggleButtonActive, { backgroundColor: theme.income }]
            ]}
          >
            <Calendar
              color={granularity === 'DAILY' ? '#ffffff' : theme.textSecondary}
              size={14}
            />
            <Text
              style={[
                styles.toggleText,
                { color: granularity === 'DAILY' ? '#ffffff' : theme.textSecondary },
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
              granularity === 'MONTHLY' && [styles.toggleButtonActive, { backgroundColor: theme.income }]
            ]}
          >
            <Layers
              color={granularity === 'MONTHLY' ? '#ffffff' : theme.textSecondary}
              size={14}
            />
            <Text
              style={[
                styles.toggleText,
                { color: granularity === 'MONTHLY' ? '#ffffff' : theme.textSecondary },
                granularity === 'MONTHLY' && styles.toggleTextActive
              ]}
            >
              Mensal (6M)
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Totals Summary Ribbon */}
      <View
        style={[
          styles.ribbon,
          {
            backgroundColor: theme.bgElevated,
            borderColor: theme.borderElevated
          }
        ]}
      >
        <View style={styles.ribbonItem}>
          <View style={styles.ribbonLabelGroup}>
            <ArrowUpRight color={theme.income} size={16} />
            <Text style={[styles.ribbonLabel, { color: theme.textSecondary }]}>Total Entradas</Text>
          </View>
          <Text style={[styles.ribbonValue, { color: theme.income }]}>
            {formatCurrency(totals?.totalIncome ?? '0.00', preferredCurrency)}
          </Text>
        </View>

        <View style={[styles.ribbonDivider, { backgroundColor: theme.borderElevated }]} />

        <View style={styles.ribbonItem}>
          <View style={styles.ribbonLabelGroup}>
            <ArrowDownRight color={theme.expense} size={16} />
            <Text style={[styles.ribbonLabel, { color: theme.textSecondary }]}>Total Saídas</Text>
          </View>
          <Text style={[styles.ribbonValue, { color: theme.expense }]}>
            {formatCurrency(totals?.totalExpense ?? '0.00', preferredCurrency)}
          </Text>
        </View>

        <View style={[styles.ribbonDivider, { backgroundColor: theme.borderElevated }]} />

        <View style={styles.ribbonItem}>
          <View style={styles.ribbonLabelGroup}>
            <Scale color={theme.income} size={16} />
            <Text style={[styles.ribbonLabel, { color: theme.textSecondary }]}>Saldo do Período</Text>
          </View>
          <Text
            style={[
              styles.ribbonValue,
              { color: Number(totals?.netBalance ?? 0) >= 0 ? theme.income : theme.expense }
            ]}
          >
            {formatCurrency(totals?.netBalance ?? '0.00', preferredCurrency)}
          </Text>
        </View>
      </View>

      {/* Active Point Detail Preview */}
      {activePoint ? (
        <View
          style={[
            styles.detailBox,
            {
              backgroundColor: theme.bgElevated,
              borderColor: theme.borderElevated
            }
          ]}
        >
          <Text style={[styles.detailLabel, { color: theme.textPrimary }]}>
            Detalhes de {activePoint.label} ({activePoint.date}):
          </Text>
          <View style={styles.detailPills}>
            <View style={[styles.pill, { backgroundColor: theme.incomeBadge }]}>
              <Text style={[styles.pillText, { color: theme.income }]}>
                Entradas: {formatCurrency(activePoint.income, preferredCurrency)}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: theme.expenseBadge }]}>
              <Text style={[styles.pillText, { color: theme.expense }]}>
                Saídas: {formatCurrency(activePoint.expense, preferredCurrency)}
              </Text>
            </View>
            <View
              style={[
                styles.pill,
                {
                  backgroundColor:
                    Number(activePoint.net) >= 0 ? theme.incomeBadge : theme.expenseBadge
                }
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: Number(activePoint.net) >= 0 ? theme.income : theme.expense }
                ]}
              >
                Líquido: {formatCurrency(activePoint.net, preferredCurrency)}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
              <Text style={[styles.pillText, { color: theme.textPrimary }]}>
                Acumulado: {formatCurrency(activePoint.accumulatedBalance, preferredCurrency)}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Chart Canvas Area */}
      {loading && dataPoints.length === 0 ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={theme.income} size="large" />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Carregando fluxo de caixa...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={[styles.errorText, { color: theme.expense }]}>
            Erro ao carregar dados do gráfico.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refetch()}
            style={[styles.retryButton, { backgroundColor: theme.income }]}
          >
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.chartScrollContent}
          horizontal
          showsHorizontalScrollIndicator={false}
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
                  accessibilityLabel={`Ponto ${point.label}`}
                  accessibilityRole="button"
                  key={point.date}
                  onPress={() => setSelectedPoint(point)}
                  style={[
                    styles.barColumn,
                    isSelected && [
                      styles.barColumnSelected,
                      { backgroundColor: theme.bgElevated, borderColor: theme.borderElevated }
                    ]
                  ]}
                >
                  <View style={styles.barsContainer}>
                    {/* Income Bar */}
                    <View style={styles.singleBarWrapper}>
                      <View
                        style={[
                          styles.bar,
                          { backgroundColor: theme.income, height: incomeHeight },
                          !hasIncome && [styles.emptyBar, { backgroundColor: theme.borderElevated }]
                        ]}
                      />
                    </View>

                    {/* Expense Bar */}
                    <View style={styles.singleBarWrapper}>
                      <View
                        style={[
                          styles.bar,
                          { backgroundColor: theme.expense, height: expenseHeight },
                          !hasExpense && [styles.emptyBar, { backgroundColor: theme.borderElevated }]
                        ]}
                      />
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.barLabel,
                      { color: theme.textSecondary },
                      isSelected && [styles.barLabelSelected, { color: theme.income }]
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
          <View style={[styles.legendDot, { backgroundColor: theme.income }]} />
          <Text style={[styles.legendText, { color: theme.textSecondary }]}>
            Receitas Realizadas
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.expense }]} />
          <Text style={[styles.legendText, { color: theme.textSecondary }]}>
            Despesas Realizadas
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderRadius: 3,
    width: 10
  },
  barColumn: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 6,
    minWidth: 32,
    padding: 4
  },
  barColumnSelected: {
    borderWidth: 1
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '500'
  },
  barLabelSelected: {
    fontWeight: '700'
  },
  barsContainer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 3,
    height: 120
  },
  centerBox: {
    alignItems: 'center',
    gap: 8,
    height: 180,
    justifyContent: 'center'
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
  container: {
    borderRadius: 14,
    borderWidth: 1,
    gap: 16,
    padding: 20,
    width: '100%'
  },
  detailBox: {
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 12
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600'
  },
  detailPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  emptyBar: {
    height: 3
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
  headerTitleGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12
  },
  iconBadge: {
    alignItems: 'center',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    paddingTop: 4
  },
  legendDot: {
    borderRadius: 9999,
    height: 8,
    width: 8
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6
  },
  legendText: {
    fontSize: 12
  },
  loadingText: {
    fontSize: 13
  },
  pill: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600'
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
  ribbon: {
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingVertical: 12
  },
  ribbonDivider: {
    height: '100%',
    width: 1
  },
  ribbonItem: {
    alignItems: 'center',
    gap: 4,
    minWidth: 110,
    paddingHorizontal: 8
  },
  ribbonLabel: {
    fontSize: 11,
    fontWeight: '500'
  },
  ribbonLabelGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4
  },
  ribbonValue: {
    fontSize: 14,
    fontWeight: '700'
  },
  singleBarWrapper: {
    alignItems: 'center',
    height: 120,
    justifyContent: 'flex-end',
    width: 10
  },
  subtitle: {
    fontSize: 13
  },
  title: {
    fontSize: 18,
    fontWeight: '700'
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
    elevation: 1
  },
  toggleGroup: {
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
  }
});
