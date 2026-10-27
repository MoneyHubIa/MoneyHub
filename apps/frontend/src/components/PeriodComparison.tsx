import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  GitCompare,
  PiggyBank,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp
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

export const PERIOD_COMPARISON_QUERY = gql`
  query PeriodComparison($input: PeriodComparisonInput) {
    periodComparison(input: $input) {
      basePeriod {
        month
        year
        label
        totalIncome
        totalExpense
        netBalance
        savingsRate
        incomeCount
        expenseCount
      }
      comparisonPeriod {
        month
        year
        label
        totalIncome
        totalExpense
        netBalance
        savingsRate
        incomeCount
        expenseCount
      }
      delta {
        incomeDelta
        incomePercentage
        expenseDelta
        expensePercentage
        netBalanceDelta
        netBalancePercentage
        savingsRateDelta
      }
    }
  }
`;

export type PeriodMetrics = {
  month: number;
  year: number;
  label: string;
  totalIncome: string;
  totalExpense: string;
  netBalance: string;
  savingsRate: number;
  incomeCount: number;
  expenseCount: number;
};

export type PeriodComparisonDelta = {
  incomeDelta: string;
  incomePercentage: number;
  expenseDelta: string;
  expensePercentage: number;
  netBalanceDelta: string;
  netBalancePercentage: number;
  savingsRateDelta: number;
};

export type PeriodComparisonData = {
  periodComparison: {
    basePeriod: PeriodMetrics;
    comparisonPeriod: PeriodMetrics;
    delta: PeriodComparisonDelta;
  };
};

type PeriodComparisonProps = Readonly<{
  preferredCurrency?: string;
  baseMonth?: number;
  baseYear?: number;
}>;

const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export function PeriodComparison({
  preferredCurrency = 'BRL',
  baseMonth,
  baseYear
}: PeriodComparisonProps): React.JSX.Element {
  const { theme } = useTheme();
  const now = new Date();
  const initialBaseMonth = baseMonth ?? (now.getUTCMonth() + 1);
  const initialBaseYear = baseYear ?? now.getUTCFullYear();

  // Fully customizable state for Base Period
  const [bMonth, setBMonth] = useState<number>(initialBaseMonth);
  const [bYear, setBYear] = useState<number>(initialBaseYear);

  // Fully customizable state for Comparison Period
  const [cMonth, setCMonth] = useState<number>(
    initialBaseMonth === 1 ? 12 : initialBaseMonth - 1
  );
  const [cYear, setCYear] = useState<number>(
    initialBaseMonth === 1 ? initialBaseYear - 1 : initialBaseYear
  );

  const { data, loading, error, refetch } = useQuery<PeriodComparisonData>(
    PERIOD_COMPARISON_QUERY,
    {
      variables: {
        input: {
          baseMonth: bMonth,
          baseYear: bYear,
          comparisonMonth: cMonth,
          comparisonYear: cYear
        }
      },
      fetchPolicy: 'cache-and-network'
    }
  );

  const comparison = data?.periodComparison;
  const base = comparison?.basePeriod;
  const comp = comparison?.comparisonPeriod;
  const delta = comparison?.delta;

  // Preset shortcuts
  const applyMoMPreset = () => {
    setCMonth(bMonth === 1 ? 12 : bMonth - 1);
    setCYear(bMonth === 1 ? bYear - 1 : bYear);
  };

  const applyYoYPreset = () => {
    setCMonth(bMonth);
    setCYear(bYear - 1);
  };

  const applyQuarterPreset = () => {
    const targetDate = new Date(Date.UTC(bYear, bMonth - 4, 1));
    setCMonth(targetDate.getUTCMonth() + 1);
    setCYear(targetDate.getUTCFullYear());
  };

  const renderDeltaBadge = (
    percentage: number,
    amountDelta: string,
    isExpense: boolean = false
  ) => {
    const isGood = isExpense ? percentage <= 0 : percentage >= 0;
    const isPositiveVal = Number(amountDelta) >= 0;
    const sign = isPositiveVal ? '+' : '';

    return (
      <View
        style={[
          styles.deltaBadge,
          { backgroundColor: isGood ? theme.incomeBadge : theme.expenseBadge }
        ]}
      >
        {percentage >= 0 ? (
          <ArrowUpRight
            color={isGood ? theme.income : theme.expense}
            size={13}
          />
        ) : (
          <ArrowDownRight
            color={isGood ? theme.income : theme.expense}
            size={13}
          />
        )}
        <Text
          style={[
            styles.deltaText,
            { color: isGood ? theme.income : theme.expense }
          ]}
        >
          {sign}{percentage.toFixed(1)}% ({sign}{formatCurrency(amountDelta, preferredCurrency)})
        </Text>
      </View>
    );
  };

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
            <GitCompare color={theme.income} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>
              Comparativo de Períodos Personalizado
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Escolha livremente os dois meses e anos para comparar a performance
            </Text>
          </View>
        </View>
      </View>

      {/* Preset Quick Actions */}
      <View style={styles.presetsRow}>
        <Text style={[styles.presetsLabel, { color: theme.textSecondary }]}>Atalhos rápidos:</Text>
        <ScrollView
          contentContainerStyle={styles.presetsScroll}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <Pressable
            accessibilityLabel="Atalho Mês Anterior"
            accessibilityRole="button"
            onPress={applyMoMPreset}
            style={[styles.presetChip, { backgroundColor: theme.bgElevated }]}
          >
            <Sparkles color={theme.income} size={13} />
            <Text style={[styles.presetChipText, { color: theme.textPrimary }]}>
              Mês Anterior (MoM)
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Atalho Ano Anterior"
            accessibilityRole="button"
            onPress={applyYoYPreset}
            style={[styles.presetChip, { backgroundColor: theme.bgElevated }]}
          >
            <Calendar color={theme.income} size={13} />
            <Text style={[styles.presetChipText, { color: theme.textPrimary }]}>
              Mesmo Mês do Ano Anterior (YoY)
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Atalho Trimestre Passado"
            accessibilityRole="button"
            onPress={applyQuarterPreset}
            style={[styles.presetChip, { backgroundColor: theme.bgElevated }]}
          >
            <Calendar color={theme.income} size={13} />
            <Text style={[styles.presetChipText, { color: theme.textPrimary }]}>
              Trimestre Passado (3M atrás)
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Dual Custom Period Selector Panel */}
      <View
        style={[
          styles.selectorsCard,
          {
            backgroundColor: theme.bgElevated,
            borderColor: theme.borderElevated
          }
        ]}
      >
        {/* Base Period Box */}
        <View style={styles.selectorColumn}>
          <View style={styles.selectorHeader}>
            <View style={[styles.dotIndicator, { backgroundColor: theme.income }]} />
            <Text style={[styles.selectorHeading, { color: theme.textPrimary }]}>
              Período Base (Referência)
            </Text>
          </View>

          <View style={styles.pickerControls}>
            {/* Year Stepper */}
            <View
              style={[
                styles.stepperWrapper,
                {
                  backgroundColor: theme.bgSurface,
                  borderColor: theme.borderElevated
                }
              ]}
            >
              <Pressable
                accessibilityLabel="Diminuir ano base"
                accessibilityRole="button"
                onPress={() => setBYear((y) => Math.max(2000, y - 1))}
                style={styles.stepBtn}
              >
                <ChevronLeft color={theme.textPrimary} size={16} />
              </Pressable>
              <Text style={[styles.yearText, { color: theme.textPrimary }]}>{bYear}</Text>
              <Pressable
                accessibilityLabel="Aumentar ano base"
                accessibilityRole="button"
                onPress={() => setBYear((y) => Math.min(2100, y + 1))}
                style={styles.stepBtn}
              >
                <ChevronRight color={theme.textPrimary} size={16} />
              </Pressable>
            </View>

            {/* Months Pills */}
            <ScrollView
              contentContainerStyle={styles.monthsTrack}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {MONTH_NAMES_SHORT.map((mName, idx) => {
                const monthNum = idx + 1;
                const isSelected = bMonth === monthNum;
                return (
                  <Pressable
                    accessibilityLabel={`Selecionar mês base ${mName}`}
                    accessibilityRole="button"
                    key={`base-${mName}`}
                    onPress={() => setBMonth(monthNum)}
                    style={[
                      styles.monthPill,
                      {
                        backgroundColor: isSelected ? theme.income : theme.bgSurface,
                        borderColor: isSelected ? theme.income : theme.borderElevated
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.monthPillText,
                        { color: isSelected ? '#ffffff' : theme.textSecondary },
                        isSelected && styles.monthPillTextActive
                      ]}
                    >
                      {mName}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <View style={styles.vsDivider}>
          <Text style={[styles.vsDividerText, { color: theme.textMuted }]}>VS</Text>
        </View>

        {/* Comparison Period Box */}
        <View style={styles.selectorColumn}>
          <View style={styles.selectorHeader}>
            <View style={[styles.dotIndicator, { backgroundColor: theme.brandAI }]} />
            <Text style={[styles.selectorHeading, { color: theme.textPrimary }]}>
              Período Comparado
            </Text>
          </View>

          <View style={styles.pickerControls}>
            {/* Year Stepper */}
            <View
              style={[
                styles.stepperWrapper,
                {
                  backgroundColor: theme.bgSurface,
                  borderColor: theme.borderElevated
                }
              ]}
            >
              <Pressable
                accessibilityLabel="Diminuir ano comparado"
                accessibilityRole="button"
                onPress={() => setCYear((y) => Math.max(2000, y - 1))}
                style={styles.stepBtn}
              >
                <ChevronLeft color={theme.textPrimary} size={16} />
              </Pressable>
              <Text style={[styles.yearText, { color: theme.textPrimary }]}>{cYear}</Text>
              <Pressable
                accessibilityLabel="Aumentar ano comparado"
                accessibilityRole="button"
                onPress={() => setCYear((y) => Math.min(2100, y + 1))}
                style={styles.stepBtn}
              >
                <ChevronRight color={theme.textPrimary} size={16} />
              </Pressable>
            </View>

            {/* Months Pills */}
            <ScrollView
              contentContainerStyle={styles.monthsTrack}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {MONTH_NAMES_SHORT.map((mName, idx) => {
                const monthNum = idx + 1;
                const isSelected = cMonth === monthNum;
                return (
                  <Pressable
                    accessibilityLabel={`Selecionar mês comparado ${mName}`}
                    accessibilityRole="button"
                    key={`comp-${mName}`}
                    onPress={() => setCMonth(monthNum)}
                    style={[
                      styles.monthPill,
                      {
                        backgroundColor: isSelected ? theme.brandAI : theme.bgSurface,
                        borderColor: isSelected ? theme.brandAI : theme.borderElevated
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.monthPillText,
                        { color: isSelected ? '#ffffff' : theme.textSecondary },
                        isSelected && styles.monthPillTextActive
                      ]}
                    >
                      {mName}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>

      {/* Comparison Results Area */}
      {loading && !comparison ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={theme.income} size="large" />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Carregando comparativo...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={[styles.errorText, { color: theme.expense }]}>
            Erro ao carregar comparativo de períodos.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refetch()}
            style={[styles.retryButton, { backgroundColor: theme.income }]}
          >
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : comparison ? (
        <View style={styles.cardsGrid}>
          {/* Card 1: Receitas */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.bgElevated,
                borderColor: theme.borderElevated
              }
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBadge, { backgroundColor: theme.incomeBadge }]}>
                <TrendingUp color={theme.income} size={18} />
              </View>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                Receitas (Entradas)
              </Text>
            </View>

            <View style={styles.cardValuesRow}>
              <View>
                <Text style={[styles.periodTag, { color: theme.textSecondary }]}>{base?.label}</Text>
                <Text style={[styles.mainValue, { color: theme.income }]}>
                  {formatCurrency(base?.totalIncome ?? '0.00', preferredCurrency)}
                </Text>
              </View>
              <View style={styles.vsBox}>
                <Text style={[styles.vsText, { color: theme.textMuted }]}>vs</Text>
              </View>
              <View>
                <Text style={[styles.periodTag, { color: theme.textSecondary }]}>{comp?.label}</Text>
                <Text style={[styles.compValue, { color: theme.textSecondary }]}>
                  {formatCurrency(comp?.totalIncome ?? '0.00', preferredCurrency)}
                </Text>
              </View>
            </View>

            {delta ? renderDeltaBadge(delta.incomePercentage, delta.incomeDelta, false) : null}
          </View>

          {/* Card 2: Despesas */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.bgElevated,
                borderColor: theme.borderElevated
              }
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBadge, { backgroundColor: theme.expenseBadge }]}>
                <TrendingDown color={theme.expense} size={18} />
              </View>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                Despesas (Saídas)
              </Text>
            </View>

            <View style={styles.cardValuesRow}>
              <View>
                <Text style={[styles.periodTag, { color: theme.textSecondary }]}>{base?.label}</Text>
                <Text style={[styles.mainValue, { color: theme.expense }]}>
                  {formatCurrency(base?.totalExpense ?? '0.00', preferredCurrency)}
                </Text>
              </View>
              <View style={styles.vsBox}>
                <Text style={[styles.vsText, { color: theme.textMuted }]}>vs</Text>
              </View>
              <View>
                <Text style={[styles.periodTag, { color: theme.textSecondary }]}>{comp?.label}</Text>
                <Text style={[styles.compValue, { color: theme.textSecondary }]}>
                  {formatCurrency(comp?.totalExpense ?? '0.00', preferredCurrency)}
                </Text>
              </View>
            </View>

            {delta ? renderDeltaBadge(delta.expensePercentage, delta.expenseDelta, true) : null}
          </View>

          {/* Card 3: Saldo Líquido */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.bgElevated,
                borderColor: theme.borderElevated
              }
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBadge, { backgroundColor: theme.incomeBadge }]}>
                <Scale color={theme.income} size={18} />
              </View>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                Saldo Líquido
              </Text>
            </View>

            <View style={styles.cardValuesRow}>
              <View>
                <Text style={[styles.periodTag, { color: theme.textSecondary }]}>{base?.label}</Text>
                <Text
                  style={[
                    styles.mainValue,
                    {
                      color:
                        Number(base?.netBalance ?? 0) >= 0 ? theme.income : theme.expense
                    }
                  ]}
                >
                  {formatCurrency(base?.netBalance ?? '0.00', preferredCurrency)}
                </Text>
              </View>
              <View style={styles.vsBox}>
                <Text style={[styles.vsText, { color: theme.textMuted }]}>vs</Text>
              </View>
              <View>
                <Text style={[styles.periodTag, { color: theme.textSecondary }]}>{comp?.label}</Text>
                <Text style={[styles.compValue, { color: theme.textSecondary }]}>
                  {formatCurrency(comp?.netBalance ?? '0.00', preferredCurrency)}
                </Text>
              </View>
            </View>

            {delta ? renderDeltaBadge(delta.netBalancePercentage, delta.netBalanceDelta, false) : null}
          </View>

          {/* Card 4: Taxa de Economia */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.bgElevated,
                borderColor: theme.borderElevated
              }
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBadge, { backgroundColor: theme.brandAIBadge }]}>
                <PiggyBank color={theme.brandAI} size={18} />
              </View>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                Taxa de Economia
              </Text>
            </View>

            <View style={styles.cardValuesRow}>
              <View>
                <Text style={[styles.periodTag, { color: theme.textSecondary }]}>{base?.label}</Text>
                <Text style={[styles.mainValue, { color: theme.brandAI }]}>
                  {(base?.savingsRate ?? 0).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.vsBox}>
                <Text style={[styles.vsText, { color: theme.textMuted }]}>vs</Text>
              </View>
              <View>
                <Text style={[styles.periodTag, { color: theme.textSecondary }]}>{comp?.label}</Text>
                <Text style={[styles.compValue, { color: theme.textSecondary }]}>
                  {(comp?.savingsRate ?? 0).toFixed(1)}%
                </Text>
              </View>
            </View>

            {delta ? (
              <View
                style={[
                  styles.deltaBadge,
                  {
                    backgroundColor:
                      delta.savingsRateDelta >= 0 ? theme.incomeBadge : theme.expenseBadge
                  }
                ]}
              >
                {delta.savingsRateDelta >= 0 ? (
                  <ArrowUpRight color={theme.income} size={13} />
                ) : (
                  <ArrowDownRight color={theme.expense} size={13} />
                )}
                <Text
                  style={[
                    styles.deltaText,
                    {
                      color: delta.savingsRateDelta >= 0 ? theme.income : theme.expense
                    }
                  ]}
                >
                  {delta.savingsRateDelta >= 0 ? '+' : ''}
                  {delta.savingsRateDelta.toFixed(1)} p.p.
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 12,
    minWidth: 240,
    padding: 16
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  cardIconBadge: {
    alignItems: 'center',
    borderRadius: 6,
    height: 32,
    justifyContent: 'center',
    width: 32
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  cardValuesRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  centerBox: {
    alignItems: 'center',
    gap: 8,
    height: 140,
    justifyContent: 'center'
  },
  compValue: {
    fontSize: 14,
    fontWeight: '600'
  },
  container: {
    borderRadius: 14,
    borderWidth: 1,
    gap: 16,
    padding: 20,
    width: '100%'
  },
  deltaBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  deltaText: {
    fontSize: 11,
    fontWeight: '700'
  },
  dotIndicator: {
    borderRadius: 9999,
    height: 8,
    width: 8
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
  mainValue: {
    fontSize: 16,
    fontWeight: '700'
  },
  monthPill: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  monthPillText: {
    fontSize: 11,
    fontWeight: '600'
  },
  monthPillTextActive: {
    fontWeight: '700'
  },
  monthsTrack: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 2
  },
  periodTag: {
    fontSize: 11,
    fontWeight: '500'
  },
  pickerControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  presetChip: {
    alignItems: 'center',
    borderRadius: 9999,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '500'
  },
  presetsLabel: {
    fontSize: 12,
    fontWeight: '600'
  },
  presetsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  presetsScroll: {
    flexDirection: 'row',
    gap: 6
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
  selectorColumn: {
    flex: 1,
    gap: 10,
    minWidth: 260
  },
  selectorHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6
  },
  selectorHeading: {
    fontSize: 13,
    fontWeight: '600'
  },
  selectorsCard: {
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
    padding: 14
  },
  stepBtn: {
    padding: 4
  },
  stepperWrapper: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  subtitle: {
    fontSize: 13
  },
  title: {
    fontSize: 18,
    fontWeight: '700'
  },
  titleGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12
  },
  vsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  vsDivider: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  vsDividerText: {
    fontSize: 12,
    fontWeight: '800'
  },
  vsText: {
    fontSize: 11,
    fontWeight: '600'
  },
  yearText: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'center'
  }
});
