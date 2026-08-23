import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
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
}: PeriodComparisonProps) {
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
          isGood ? styles.deltaBadgeGood : styles.deltaBadgeBad
        ]}
      >
        {percentage >= 0 ? (
          <ArrowUpRight
            color={isGood ? '#059669' : '#dc2626'}
            size={13}
          />
        ) : (
          <ArrowDownRight
            color={isGood ? '#059669' : '#dc2626'}
            size={13}
          />
        )}
        <Text
          style={[
            styles.deltaText,
            isGood ? styles.deltaTextGood : styles.deltaTextBad
          ]}
        >
          {sign}{percentage.toFixed(1)}% ({sign}{formatCurrency(amountDelta, preferredCurrency)})
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={styles.iconBadge}>
            <GitCompare color="#0f766e" size={20} />
          </View>
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              Comparativo de Períodos Personalizado
            </Text>
            <Text style={styles.subtitle}>
              Escolha livremente os dois meses e anos para comparar a performance
            </Text>
          </View>
        </View>
      </View>

      {/* Preset Quick Actions */}
      <View style={styles.presetsRow}>
        <Text style={styles.presetsLabel}>Atalhos rápidos:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsScroll}>
          <Pressable
            accessibilityLabel="Atalho Mês Anterior"
            accessibilityRole="button"
            onPress={applyMoMPreset}
            style={styles.presetChip}
          >
            <Sparkles color="#0f766e" size={13} />
            <Text style={styles.presetChipText}>Mês Anterior (MoM)</Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Atalho Ano Anterior"
            accessibilityRole="button"
            onPress={applyYoYPreset}
            style={styles.presetChip}
          >
            <Calendar color="#0f766e" size={13} />
            <Text style={styles.presetChipText}>Mesmo Mês do Ano Anterior (YoY)</Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Atalho Trimestre Passado"
            accessibilityRole="button"
            onPress={applyQuarterPreset}
            style={styles.presetChip}
          >
            <Calendar color="#0f766e" size={13} />
            <Text style={styles.presetChipText}>Trimestre Passado (3M atrás)</Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Dual Custom Period Selector Panel */}
      <View style={styles.selectorsCard}>
        {/* Base Period Box */}
        <View style={styles.selectorColumn}>
          <View style={styles.selectorHeader}>
            <View style={[styles.dotIndicator, { backgroundColor: '#0f766e' }]} />
            <Text style={styles.selectorHeading}>Período Base (Referência)</Text>
          </View>

          <View style={styles.pickerControls}>
            {/* Year Stepper */}
            <View style={styles.stepperWrapper}>
              <Pressable
                accessibilityLabel="Diminuir ano base"
                accessibilityRole="button"
                onPress={() => setBYear((y) => Math.max(2000, y - 1))}
                style={styles.stepBtn}
              >
                <ChevronLeft color="#334155" size={16} />
              </Pressable>
              <Text style={styles.yearText}>{bYear}</Text>
              <Pressable
                accessibilityLabel="Aumentar ano base"
                accessibilityRole="button"
                onPress={() => setBYear((y) => Math.min(2100, y + 1))}
                style={styles.stepBtn}
              >
                <ChevronRight color="#334155" size={16} />
              </Pressable>
            </View>

            {/* Months Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthsTrack}>
              {MONTH_NAMES_SHORT.map((mName, idx) => {
                const monthNum = idx + 1;
                const isSelected = bMonth === monthNum;
                return (
                  <Pressable
                    key={`base-${mName}`}
                    accessibilityLabel={`Selecionar mês base ${mName}`}
                    accessibilityRole="button"
                    onPress={() => setBMonth(monthNum)}
                    style={[styles.monthPill, isSelected && styles.monthPillActiveBase]}
                  >
                    <Text style={[styles.monthPillText, isSelected && styles.monthPillTextActive]}>
                      {mName}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <View style={styles.vsDivider}>
          <Text style={styles.vsDividerText}>VS</Text>
        </View>

        {/* Comparison Period Box */}
        <View style={styles.selectorColumn}>
          <View style={styles.selectorHeader}>
            <View style={[styles.dotIndicator, { backgroundColor: '#6366f1' }]} />
            <Text style={styles.selectorHeading}>Período Comparado</Text>
          </View>

          <View style={styles.pickerControls}>
            {/* Year Stepper */}
            <View style={styles.stepperWrapper}>
              <Pressable
                accessibilityLabel="Diminuir ano comparado"
                accessibilityRole="button"
                onPress={() => setCYear((y) => Math.max(2000, y - 1))}
                style={styles.stepBtn}
              >
                <ChevronLeft color="#334155" size={16} />
              </Pressable>
              <Text style={styles.yearText}>{cYear}</Text>
              <Pressable
                accessibilityLabel="Aumentar ano comparado"
                accessibilityRole="button"
                onPress={() => setCYear((y) => Math.min(2100, y + 1))}
                style={styles.stepBtn}
              >
                <ChevronRight color="#334155" size={16} />
              </Pressable>
            </View>

            {/* Months Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthsTrack}>
              {MONTH_NAMES_SHORT.map((mName, idx) => {
                const monthNum = idx + 1;
                const isSelected = cMonth === monthNum;
                return (
                  <Pressable
                    key={`comp-${mName}`}
                    accessibilityLabel={`Selecionar mês comparado ${mName}`}
                    accessibilityRole="button"
                    onPress={() => setCMonth(monthNum)}
                    style={[styles.monthPill, isSelected && styles.monthPillActiveComp]}
                  >
                    <Text style={[styles.monthPillText, isSelected && styles.monthPillTextActive]}>
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
          <ActivityIndicator color="#0f766e" size="large" />
          <Text style={styles.loadingText}>Carregando comparativo...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>Erro ao carregar comparativo de períodos.</Text>
          <Pressable onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : comparison ? (
        <View style={styles.cardsGrid}>
          {/* Card 1: Receitas */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBadge, { backgroundColor: '#ecfdf5' }]}>
                <TrendingUp color="#059669" size={18} />
              </View>
              <Text style={styles.cardTitle}>Receitas (Entradas)</Text>
            </View>

            <View style={styles.cardValuesRow}>
              <View>
                <Text style={styles.periodTag}>{base?.label}</Text>
                <Text style={[styles.mainValue, styles.incomeText]}>
                  {formatCurrency(base?.totalIncome ?? '0.00', preferredCurrency)}
                </Text>
              </View>
              <View style={styles.vsBox}>
                <Text style={styles.vsText}>vs</Text>
              </View>
              <View>
                <Text style={styles.periodTag}>{comp?.label}</Text>
                <Text style={styles.compValue}>
                  {formatCurrency(comp?.totalIncome ?? '0.00', preferredCurrency)}
                </Text>
              </View>
            </View>

            {delta ? renderDeltaBadge(delta.incomePercentage, delta.incomeDelta, false) : null}
          </View>

          {/* Card 2: Despesas */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBadge, { backgroundColor: '#fef2f2' }]}>
                <TrendingDown color="#dc2626" size={18} />
              </View>
              <Text style={styles.cardTitle}>Despesas (Saídas)</Text>
            </View>

            <View style={styles.cardValuesRow}>
              <View>
                <Text style={styles.periodTag}>{base?.label}</Text>
                <Text style={[styles.mainValue, styles.expenseText]}>
                  {formatCurrency(base?.totalExpense ?? '0.00', preferredCurrency)}
                </Text>
              </View>
              <View style={styles.vsBox}>
                <Text style={styles.vsText}>vs</Text>
              </View>
              <View>
                <Text style={styles.periodTag}>{comp?.label}</Text>
                <Text style={styles.compValue}>
                  {formatCurrency(comp?.totalExpense ?? '0.00', preferredCurrency)}
                </Text>
              </View>
            </View>

            {delta ? renderDeltaBadge(delta.expensePercentage, delta.expenseDelta, true) : null}
          </View>

          {/* Card 3: Saldo Líquido */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBadge, { backgroundColor: '#f0fdfa' }]}>
                <Scale color="#0f766e" size={18} />
              </View>
              <Text style={styles.cardTitle}>Saldo Líquido</Text>
            </View>

            <View style={styles.cardValuesRow}>
              <View>
                <Text style={styles.periodTag}>{base?.label}</Text>
                <Text
                  style={[
                    styles.mainValue,
                    Number(base?.netBalance ?? 0) >= 0 ? styles.positiveText : styles.negativeText
                  ]}
                >
                  {formatCurrency(base?.netBalance ?? '0.00', preferredCurrency)}
                </Text>
              </View>
              <View style={styles.vsBox}>
                <Text style={styles.vsText}>vs</Text>
              </View>
              <View>
                <Text style={styles.periodTag}>{comp?.label}</Text>
                <Text style={styles.compValue}>
                  {formatCurrency(comp?.netBalance ?? '0.00', preferredCurrency)}
                </Text>
              </View>
            </View>

            {delta ? renderDeltaBadge(delta.netBalancePercentage, delta.netBalanceDelta, false) : null}
          </View>

          {/* Card 4: Taxa de Economia */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBadge, { backgroundColor: '#f5f3ff' }]}>
                <PiggyBank color="#7c3aed" size={18} />
              </View>
              <Text style={styles.cardTitle}>Taxa de Economia</Text>
            </View>

            <View style={styles.cardValuesRow}>
              <View>
                <Text style={styles.periodTag}>{base?.label}</Text>
                <Text style={[styles.mainValue, styles.savingsText]}>
                  {(base?.savingsRate ?? 0).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.vsBox}>
                <Text style={styles.vsText}>vs</Text>
              </View>
              <View>
                <Text style={styles.periodTag}>{comp?.label}</Text>
                <Text style={styles.compValue}>
                  {(comp?.savingsRate ?? 0).toFixed(1)}%
                </Text>
              </View>
            </View>

            {delta ? (
              <View
                style={[
                  styles.deltaBadge,
                  delta.savingsRateDelta >= 0 ? styles.deltaBadgeGood : styles.deltaBadgeBad
                ]}
              >
                {delta.savingsRateDelta >= 0 ? (
                  <ArrowUpRight
                    color="#059669"
                    size={13}
                  />
                ) : (
                  <ArrowDownRight
                    color="#dc2626"
                    size={13}
                  />
                )}
                <Text
                  style={[
                    styles.deltaText,
                    delta.savingsRateDelta >= 0 ? styles.deltaTextGood : styles.deltaTextBad
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
  presetsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  presetsLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600'
  },
  presetsScroll: {
    flexDirection: 'row',
    gap: 6
  },
  presetChip: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 9999,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5
  },
  presetChipText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '500'
  },
  selectorsCard: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
    padding: 14
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
  dotIndicator: {
    borderRadius: 9999,
    height: 8,
    width: 8
  },
  selectorHeading: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600'
  },
  pickerControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  stepperWrapper: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  stepBtn: {
    padding: 4
  },
  yearText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'center'
  },
  monthsTrack: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 2
  },
  monthPill: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  monthPillActiveBase: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e'
  },
  monthPillActiveComp: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1'
  },
  monthPillText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600'
  },
  monthPillTextActive: {
    color: '#ffffff'
  },
  vsDivider: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  vsDividerText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '800'
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  card: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
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
    color: '#334155',
    fontSize: 14,
    fontWeight: '600'
  },
  cardValuesRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  periodTag: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500'
  },
  mainValue: {
    fontSize: 16,
    fontWeight: '700'
  },
  vsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  vsText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600'
  },
  compValue: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600'
  },
  incomeText: { color: '#059669' },
  expenseText: { color: '#dc2626' },
  positiveText: { color: '#0f766e' },
  negativeText: { color: '#b91c1c' },
  savingsText: { color: '#7c3aed' },
  deltaBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  deltaBadgeGood: {
    backgroundColor: '#ecfdf5'
  },
  deltaBadgeBad: {
    backgroundColor: '#fef2f2'
  },
  deltaText: {
    fontSize: 11,
    fontWeight: '700'
  },
  deltaTextGood: {
    color: '#059669'
  },
  deltaTextBad: {
    color: '#dc2626'
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
  }
});
