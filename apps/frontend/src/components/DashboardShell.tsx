import { gql } from '@apollo/client';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { useRouter } from 'expo-router';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  LogOut,
  Plus,
  Sparkles,
  WalletCards
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { allNavigationItems, NavigationId } from '../navigation/modules';
import { useAuth } from '../providers/AuthProvider';
import { useTheme } from '../theme/ThemeContext';
import { useResponsive } from '../theme/useResponsive';
import { useAppSafeArea } from '../theme/useAppSafeArea';
import { formatCurrency, formatDate } from '../utils/formatters';
import { AccountsPayable } from './AccountsPayable';
import { AccountsReceivable } from './AccountsReceivable';
import { Agenda } from './Agenda';
import { AiAssistant } from './AiAssistant';
import { CashFlowChart } from './CashFlowChart';
import { CategoryAnalysis } from './CategoryAnalysis';
import { CostCenters } from './CostCenters';
import { FinancialCategories } from './FinancialCategories';
import { FinancialGoals } from './FinancialGoals';
import { AppHeader } from './layout/AppHeader';
import { BottomNavBar } from './layout/BottomNavBar';
import { QuickActionModal } from './layout/QuickActionModal';
import { QuickPills } from './layout/QuickPills';
import { Sidebar } from './layout/Sidebar';
import { NotificationCenter } from './NotificationCenter';
import { PeriodComparison } from './PeriodComparison';
import { ProfileSettings } from './ProfileSettings';
import { RecurringTransactions } from './RecurringTransactions';
import { Transactions } from './Transactions';
import { TransactionModal } from './TransactionModal';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { ProgressBar } from './ui/ProgressBar';

export type { NavigationId } from '../navigation/modules';

const DASHBOARD_SUMMARY_QUERY = gql`
  query DashboardSummary {
    dashboardSummary {
      totalIncome
      totalExpense
      netBalance
      incomeCount
      expenseCount
      month
      year
    }
    myAccountsPayable(status: PENDING) {
      id
      description
      amount
      dueDate
      status
    }
    myAccountsReceivable(status: PENDING) {
      id
      description
      amount
      dueDate
      status
    }
    overdueAccountsPayable: myAccountsPayable(status: OVERDUE) {
      id
      description
      amount
      dueDate
      status
    }
    overdueAccountsReceivable: myAccountsReceivable(status: OVERDUE) {
      id
      description
      amount
      dueDate
      status
    }
    financialGoalsSummary {
      count
      totalAccumulated
      totalTarget
    }
    myFinancialGoals {
      id
      name
      progress
    }
    myProfile {
      id
      preferredCurrency
    }
  }
`;

const SYNC_AGENDA_NOTIFICATIONS = gql`
  mutation SyncAgendaNotifications($today: String!) {
    syncAgendaNotifications(today: $today) {
      id
    }
  }
`;

const MARK_ACCOUNT_PAYABLE_PAID = gql`
  mutation MarkAccountPayablePaid($id: ID!, $paidAt: String) {
    markAccountPayablePaid(id: $id, paidAt: $paidAt) {
      id
      status
      paidAt
    }
  }
`;

const MARK_ACCOUNT_RECEIVABLE_RECEIVED = gql`
  mutation MarkAccountReceivableReceived($id: ID!, $receivedAt: String) {
    markAccountReceivableReceived(id: $id, receivedAt: $receivedAt) {
      id
      status
      receivedAt
    }
  }
`;

const HIDDEN_VALUE = 'R$ ••••••';
const ALERT_WINDOW_DAYS = 7;

type SupportedCurrency = 'BRL' | 'USD' | 'EUR';

type AccountItem = {
  id: string;
  description: string;
  amount: string;
  dueDate: string;
  status: string;
};

type UpcomingItem = AccountItem & { kind: 'payable' | 'receivable' };

type DashboardSummaryData = {
  financialGoalsSummary?: { count: number; totalAccumulated: string; totalTarget: string };
  myFinancialGoals?: Array<{ id: string; name: string; progress: number }>;
  dashboardSummary?: {
    totalIncome: string;
    totalExpense: string;
    netBalance: string;
    incomeCount: number;
    expenseCount: number;
    month: number;
    year: number;
  };
  myAccountsPayable?: AccountItem[];
  myAccountsReceivable?: AccountItem[];
  overdueAccountsPayable?: AccountItem[];
  overdueAccountsReceivable?: AccountItem[];
  myProfile?: {
    id: string;
    preferredCurrency: string;
  };
};

function localIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function daysUntil(isoDate: string, todayIso: string): number {
  const due = Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`);
  const today = Date.parse(`${todayIso}T00:00:00Z`);
  return Math.round((due - today) / 86_400_000);
}

function toSupportedCurrency(value: string | undefined): SupportedCurrency {
  return value === 'USD' || value === 'EUR' ? value : 'BRL';
}

function formatLongDate(value: Date): string {
  return value.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  });
}

export function DashboardShell(): React.JSX.Element {
  const { isDesktop } = useResponsive();
  const insets = useAppSafeArea();
  const { theme, isDark } = useTheme();
  const { logout } = useAuth();
  const router = useRouter();
  const apolloClient = useApolloClient();

  const [activeSectionId, setActiveSectionId] = useState<NavigationId>('dashboard');
  const [isAiChatOpen, setIsAiChatOpen] = useState<boolean>(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notificationsReady, setNotificationsReady] = useState(false);
  const [syncAgendaError, setSyncAgendaError] = useState(false);
  const [isEyeOpen, setIsEyeOpen] = useState(true);
  const [quickActionModalOpen, setQuickActionModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const [syncAgendaNotifications] = useMutation(SYNC_AGENDA_NOTIFICATIONS);
  const [markPayablePaid] = useMutation(MARK_ACCOUNT_PAYABLE_PAID, {
    refetchQueries: ['DashboardSummary']
  });
  const [markReceivableReceived] = useMutation(MARK_ACCOUNT_RECEIVABLE_RECEIVED, {
    refetchQueries: ['DashboardSummary']
  });

  const { data: summaryData, loading: loadingSummary, refetch: refetchSummary } =
    useQuery<DashboardSummaryData>(DASHBOARD_SUMMARY_QUERY, {
      fetchPolicy: 'cache-and-network'
    });

  useEffect(() => {
    if (activeSectionId === 'dashboard') {
      refetchSummary?.();
    }
  }, [activeSectionId, refetchSummary]);

  const syncNotifications = useCallback(async () => {
    setSyncAgendaError(false);
    try {
      await syncAgendaNotifications({ variables: { today: localIsoDate(new Date()) } });
    } catch (error) {
      setSyncAgendaError(true);
      throw error;
    } finally {
      setNotificationsReady(true);
    }
  }, [syncAgendaNotifications]);

  useEffect(() => {
    void syncNotifications().catch(() => undefined);
  }, [syncNotifications]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await apolloClient.clearStore();
      await logout();
      router.replace('/(auth)/login');
    } catch {
      setLoggingOut(false);
    }
  };

  const handleSettle = async (item: UpcomingItem) => {
    setSettlingId(item.id);
    const nowIso = new Date().toISOString();
    try {
      if (item.kind === 'payable') {
        await markPayablePaid({ variables: { id: item.id, paidAt: nowIso } });
      } else {
        await markReceivableReceived({ variables: { id: item.id, receivedAt: nowIso } });
      }
    } catch {
      // Error surfaces on the dedicated screens; keep the dashboard responsive.
    } finally {
      setSettlingId(null);
    }
  };

  const currency = toSupportedCurrency(summaryData?.myProfile?.preferredCurrency);
  const preferredCurrency = summaryData?.myProfile?.preferredCurrency ?? 'BRL';
  const payables = useMemo(() => [
    ...(summaryData?.myAccountsPayable ?? []),
    ...(summaryData?.overdueAccountsPayable ?? [])
  ], [summaryData]);
  const receivables = useMemo(() => [
    ...(summaryData?.myAccountsReceivable ?? []),
    ...(summaryData?.overdueAccountsReceivable ?? [])
  ], [summaryData]);
  const todayIso = localIsoDate(new Date());

  const totalPayablePending = payables.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalReceivablePending = receivables.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const netBalanceNum = Number(summaryData?.dashboardSummary?.netBalance ?? 0);
  const projectedBalance = netBalanceNum + totalReceivablePending - totalPayablePending;

  const alertCount = payables.filter(
    (p) => daysUntil(p.dueDate, todayIso) <= ALERT_WINDOW_DAYS
  ).length;
  const overdueCount = payables.filter((p) => daysUntil(p.dueDate, todayIso) < 0).length;

  const upcoming = useMemo<UpcomingItem[]>(() => {
    const merged: UpcomingItem[] = [
      ...payables.map((p) => ({ ...p, kind: 'payable' as const })),
      ...receivables.map((r) => ({ ...r, kind: 'receivable' as const }))
    ];
    return merged.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
  }, [payables, receivables]);

  const showValue = (value: string | undefined): string =>
    isEyeOpen ? formatCurrency(value, currency) : HIDDEN_VALUE;

  const activeLabel =
    allNavigationItems.find((item) => item.id === activeSectionId)?.label ?? 'Dashboard';

  const goToQuickAction = (action: 'a_pagar' | 'a_receber' | 'transacao' | 'categoria' | 'meta') => {
    if (action === 'transacao') setIsTransactionModalOpen(true);
    else if (action === 'categoria') setActiveSectionId('financeiro');
    else if (action === 'meta') setActiveSectionId('metas');
    else setActiveSectionId(action);
  };

  const notificationCenter = (
    <NotificationCenter
      enabled={notificationsReady}
      onOpenSource={() => setActiveSectionId('agenda')}
      onRetrySync={syncNotifications}
      panelPlacement="left"
      syncError={syncAgendaError}
    />
  );

  const renderDashboard = () => (
    <>
      {/* Header */}
      <View style={styles.header}>
        {isDesktop ? (
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { color: theme.income }]}>
                Controle financeiro inteligente
              </Text>
              <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>
                Dashboard financeiro
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Acompanhe saldo, receitas, despesas, metas e proximos compromissos.
              </Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                accessibilityLabel="Nova Transação"
                accessibilityRole="button"
                onPress={() => setIsTransactionModalOpen(true)}
                style={({ pressed }) => [
                  styles.primaryCtaButton,
                  { backgroundColor: theme.brandAI, opacity: pressed ? 0.85 : 1 }
                ]}
              >
                <Plus color="#FFFFFF" size={16} strokeWidth={2.5} />
                <Text style={styles.primaryCtaText}>Nova Transação</Text>
              </Pressable>

              <Pressable
                accessibilityLabel={isEyeOpen ? 'Ocultar valores' : 'Mostrar valores'}
                accessibilityRole="button"
                onPress={() => setIsEyeOpen((prev) => !prev)}
                style={({ pressed }) => [
                  styles.iconButton,
                  {
                    backgroundColor: theme.bgSurface,
                    borderColor: theme.border,
                    opacity: pressed ? 0.75 : 1
                  }
                ]}
              >
                {isEyeOpen ? (
                  <Eye color={theme.textSecondary} size={18} />
                ) : (
                  <EyeOff color={theme.income} size={18} />
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.headerRowMobile}>
            <View style={styles.headerCopyMobile}>
              <Text style={[styles.eyebrow, { color: theme.income }]}>
                Controle financeiro inteligente
              </Text>
              <View style={styles.titleRowMobile}>
                <Text
                  accessibilityRole="header"
                  numberOfLines={1}
                  style={[styles.titleMobile, { color: theme.textPrimary }]}
                >
                  Dashboard financeiro
                </Text>
                <Pressable
                  accessibilityLabel={isEyeOpen ? 'Ocultar valores' : 'Mostrar valores'}
                  accessibilityRole="button"
                  onPress={() => setIsEyeOpen((prev) => !prev)}
                  style={({ pressed }) => [
                    styles.iconButton,
                    {
                      backgroundColor: theme.bgSurface,
                      borderColor: theme.border,
                      opacity: pressed ? 0.75 : 1
                    }
                  ]}
                >
                  {isEyeOpen ? (
                    <Eye color={theme.textSecondary} size={18} />
                  ) : (
                    <EyeOff color={theme.income} size={18} />
                  )}
                </Pressable>
              </View>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Acompanhe saldo, receitas, despesas, metas e proximos compromissos.
              </Text>
            </View>

            <View style={styles.headerActionsMobile}>
              <Pressable
                accessibilityLabel="Nova Transação"
                accessibilityRole="button"
                onPress={() => setIsTransactionModalOpen(true)}
                style={({ pressed }) => [
                  styles.primaryCtaButtonMobile,
                  { backgroundColor: theme.brandAI, opacity: pressed ? 0.85 : 1 }
                ]}
              >
                <Plus color="#FFFFFF" size={16} strokeWidth={2.5} />
                <Text style={styles.primaryCtaText}>Nova Transação</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* 4 KPIs */}
      <View accessibilityLabel="Resumo financeiro" style={styles.kpiGrid}>
        {/* 1. Saldo — gradient hero card */}
        <Card
          style={[styles.kpiCard, styles.heroCard, !isDesktop && styles.kpiCardHeroMobile]}
          variant="gradient"
        >
          <View style={styles.kpiHeaderRow}>
            <Text style={[styles.kpiLabel, styles.heroLabel]}>Saldo previsto</Text>
            <View style={styles.heroIconWrap}>
              <WalletCards color="#FFFFFF" size={16} />
            </View>
          </View>

          {loadingSummary && !summaryData?.dashboardSummary ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text numberOfLines={1} style={[styles.kpiValue, styles.heroValue]}>
              {showValue(summaryData?.dashboardSummary?.netBalance)}
            </Text>
          )}

          <View style={styles.heroFooter}>
            <Text numberOfLines={1} style={styles.heroFooterText}>
              Saldo Projetado: {showValue(projectedBalance.toString())}
            </Text>
          </View>
        </Card>

        {/* 2. Receitas */}
        <Card
          style={[styles.kpiCard, !isDesktop && styles.kpiCardHalfMobile]}
          variant="surface"
        >
          <View style={styles.kpiHeaderRow}>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Receitas do mes</Text>
            <View style={[styles.kpiIconWrap, { backgroundColor: theme.incomeBadge }]}>
              <ArrowUpRight color={theme.income} size={16} />
            </View>
          </View>
          {loadingSummary && !summaryData?.dashboardSummary ? (
            <ActivityIndicator color={theme.income} size="small" />
          ) : (
            <Text numberOfLines={1} style={[styles.kpiValue, { color: theme.income }]}>
              {showValue(summaryData?.dashboardSummary?.totalIncome)}
            </Text>
          )}
          <Text numberOfLines={2} style={[styles.kpiSub, { color: theme.textMuted }]}>
            {summaryData?.dashboardSummary?.incomeCount ?? 0} entradas ·{' '}
            {isEyeOpen ? formatCurrency(totalReceivablePending.toString(), currency) : HIDDEN_VALUE} a
            receber
          </Text>
        </Card>

        {/* 3. Despesas */}
        <Card
          style={[styles.kpiCard, !isDesktop && styles.kpiCardHalfMobile]}
          variant="surface"
        >
          <View style={styles.kpiHeaderRow}>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Despesas do mes</Text>
            <View style={[styles.kpiIconWrap, { backgroundColor: theme.expenseBadge }]}>
              <ArrowDownRight color={theme.expense} size={16} />
            </View>
          </View>
          {loadingSummary && !summaryData?.dashboardSummary ? (
            <ActivityIndicator color={theme.expense} size="small" />
          ) : (
            <Text numberOfLines={1} style={[styles.kpiValue, { color: theme.expense }]}>
              {showValue(summaryData?.dashboardSummary?.totalExpense)}
            </Text>
          )}
          <Text numberOfLines={2} style={[styles.kpiSub, { color: theme.textMuted }]}>
            {summaryData?.dashboardSummary?.expenseCount ?? 0} saídas ·{' '}
            {isEyeOpen ? formatCurrency(totalPayablePending.toString(), currency) : HIDDEN_VALUE} a
            pagar
          </Text>
        </Card>

        {/* 4. Alertas */}
        <Card
          style={[styles.kpiCard, !isDesktop && styles.kpiCardHeroMobile]}
          variant="surface"
        >
          <View style={styles.kpiHeaderRow}>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
              Alertas de Vencimento
            </Text>
            <View style={[styles.kpiIconWrap, { backgroundColor: theme.warningBadge }]}>
              <Clock color={theme.warning} size={16} />
            </View>
          </View>
          <Text numberOfLines={1} style={[styles.kpiValue, { color: theme.warning }]}>
            {alertCount} {alertCount === 1 ? 'conta' : 'contas'}
          </Text>
          <Text numberOfLines={2} style={[styles.kpiSub, { color: theme.textMuted }]}>
            {overdueCount > 0
              ? `${overdueCount} vencida${overdueCount === 1 ? '' : 's'} · próximos ${ALERT_WINDOW_DAYS} dias`
              : `Vencendo nos próximos ${ALERT_WINDOW_DAYS} dias`}
          </Text>
        </Card>
      </View>

      {/* AI Banner */}
      <Card
        style={[
          styles.assistantPanel,
          { backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF', borderColor: theme.brandAIBadge }
        ]}
        variant="elevated"
      >
        <View style={[styles.aiAvatar, { backgroundColor: theme.brandAI }]}>
          <Sparkles color="#FFFFFF" size={20} />
        </View>
        <View style={styles.panelCopy}>
          <Text style={[styles.eyebrow, { color: theme.brandAI }]}>MoneyHub IA</Text>
          <Text style={[styles.panelTitle, { color: theme.textPrimary }]}>
            Insights contextualizados
          </Text>
          <Text style={[styles.panelSubtitle, { color: theme.textSecondary }]}>
            Obtenha análises preditivas do seu orçamento com inteligência artificial.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => setIsAiChatOpen(true)}
          style={({ pressed }) => [
            styles.primaryAction,
            { backgroundColor: theme.brandAI, opacity: pressed ? 0.85 : 1 }
          ]}
        >
          <Bot color="#FFFFFF" size={18} />
          <Text style={styles.primaryActionText}>Consultar IA</Text>
        </Pressable>
      </Card>

      {/* 2-column grid */}
      <View style={styles.twoColumnGrid}>
        {/* Próximos Vencimentos */}
        <Card style={[styles.gridCard, !isDesktop && styles.gridCardMobile]} variant="surface">
          <View style={styles.gridCardHeader}>
            <Text style={[styles.gridCardTitle, { color: theme.textPrimary }]}>
              Próximos Vencimentos
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveSectionId('a_pagar')}
              style={styles.linkButton}
            >
              <Text style={[styles.linkText, { color: theme.income }]}>Ver todos</Text>
            </Pressable>
          </View>

          {upcoming.length === 0 ? (
            <View style={styles.emptyState}>
              <CheckCircle2 color={theme.income} size={22} />
              <Text style={[styles.emptyGridText, { color: theme.textMuted }]}>
                Nenhuma conta pendente. Tudo em dia!
              </Text>
            </View>
          ) : (
            upcoming.map((item, index) => {
              const isPayable = item.kind === 'payable';
              const days = daysUntil(item.dueDate, todayIso);
              const tone = days < 0 ? 'expense' : days <= 3 ? 'warning' : 'neutral';
              const dueLabel =
                days < 0 ? `${Math.abs(days)}d atrasada` : days === 0 ? 'Hoje' : `em ${days}d`;
              const isSettling = settlingId === item.id;

              return (
                <View
                  key={`${item.kind}-${item.id}`}
                  style={[
                    styles.upcomingRow,
                    index < upcoming.length - 1 && {
                      borderBottomColor: theme.border,
                      borderBottomWidth: 1
                    }
                  ]}
                >
                  <View
                    style={[
                      styles.upcomingIcon,
                      { backgroundColor: isPayable ? theme.expenseBadge : theme.incomeBadge }
                    ]}
                  >
                    {isPayable ? (
                      <ArrowDownRight color={theme.expense} size={16} />
                    ) : (
                      <ArrowUpRight color={theme.income} size={16} />
                    )}
                  </View>
                  <View style={styles.upcomingCopy}>
                    <Text
                      numberOfLines={1}
                      style={[styles.quickListDesc, { color: theme.textPrimary }]}
                    >
                      {item.description}
                    </Text>
                    <View style={styles.upcomingMeta}>
                      <Text style={[styles.quickListDate, { color: theme.textMuted }]}>
                        {formatDate(item.dueDate, currency)}
                      </Text>
                      <Badge label={dueLabel} tone={tone} textStyle={styles.smallBadgeText} />
                    </View>
                  </View>
                  <View style={styles.upcomingRight}>
                    <Text
                      style={[
                        styles.quickListAmount,
                        { color: isPayable ? theme.expense : theme.income }
                      ]}
                    >
                      {isEyeOpen ? formatCurrency(item.amount, currency) : HIDDEN_VALUE}
                    </Text>
                    <Pressable
                      accessibilityLabel={`${isPayable ? 'Pagar' : 'Receber'} ${item.description}`}
                      accessibilityRole="button"
                      disabled={isSettling}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      onPress={() => void handleSettle(item)}
                      style={({ pressed }) => [
                        styles.settleButton,
                        {
                          backgroundColor: isPayable ? theme.expenseBadge : theme.incomeBadge,
                          opacity: pressed || isSettling ? 0.7 : 1
                        }
                      ]}
                    >
                      {isSettling ? (
                        <ActivityIndicator
                          color={isPayable ? theme.expense : theme.income}
                          size="small"
                        />
                      ) : (
                        <Text
                          style={[
                            styles.settleText,
                            { color: isPayable ? theme.expense : theme.income }
                          ]}
                        >
                          {isPayable ? 'Pagar' : 'Receber'}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {/* Metas */}
        <Card
          accessibilityLabel="Metas no dashboard"
          style={[styles.gridCard, !isDesktop && styles.gridCardMobile]}
          variant="surface"
        >
          <View style={styles.gridCardHeader}>
            <View style={styles.inlineRow}>
              <Text style={[styles.gridCardTitle, { color: theme.textPrimary }]}>
                Progresso das Metas
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveSectionId('metas')}
              style={styles.linkButton}
            >
              <Text style={[styles.linkText, { color: theme.income }]}>Explorar</Text>
            </Pressable>
          </View>

          <View style={styles.goalsList}>
            {summaryData?.financialGoalsSummary && (
              <View style={styles.goalItem}>
                <Text style={[styles.quickListDesc, { color: theme.textPrimary }]}>
                  {summaryData.financialGoalsSummary.count} metas
                </Text>
                <Text style={[styles.quickListAmount, { color: theme.income }]}>
                  Acumulado: {showValue(summaryData.financialGoalsSummary.totalAccumulated)}
                </Text>
                <Text style={[styles.quickListDesc, { color: theme.textSecondary }]}>
                  Alvo total: {showValue(summaryData.financialGoalsSummary.totalTarget)}
                </Text>
              </View>
            )}
            {!loadingSummary && !summaryData?.myFinancialGoals?.length && (
              <Text style={[styles.quickListDesc, { color: theme.textSecondary }]}>
                Crie sua primeira meta financeira.
              </Text>
            )}
            {summaryData?.myFinancialGoals?.slice(0, 3).map((goal) => (
              <View key={goal.id} style={styles.goalItem}>
                <View style={styles.goalRow}>
                  <Text style={[styles.quickListDesc, { color: theme.textPrimary }]}>
                    {goal.name}
                  </Text>
                  <Text style={[styles.quickListAmount, { color: theme.income }]}>
                    {Math.round(goal.progress)}%
                  </Text>
                </View>
                <ProgressBar color={theme.income} progress={goal.progress / 100} />
              </View>
            ))}
          </View>
        </Card>
      </View>

      {/* Charts */}
      <CashFlowChart preferredCurrency={preferredCurrency} />
      <CategoryAnalysis preferredCurrency={preferredCurrency} />
      <PeriodComparison preferredCurrency={preferredCurrency} />
    </>
  );

  const renderSection = () => {
    switch (activeSectionId) {
      case 'dashboard':
        return renderDashboard();
      case 'ajustes':
        return <ProfileSettings />;
      case 'financeiro':
        return <FinancialCategories />;
      case 'transacoes':
        return <Transactions />;
      case 'a_pagar':
        return <AccountsPayable />;
      case 'a_receber':
        return <AccountsReceivable />;
      case 'recorrencias':
        return <RecurringTransactions />;
      case 'contas':
        return <CostCenters />;
      case 'agenda':
        return <Agenda />;
      case 'metas':
        return <FinancialGoals preferredCurrency={preferredCurrency} />;
      case 'ai':
        return <AiAssistant viewMode="fullscreen" />;
    }
  };

  return (
    <View style={[styles.shell, isDesktop && styles.shellDesktop, { backgroundColor: theme.bgPrimary }]}>
      {isDesktop && (
        <Sidebar
          activeSection={activeSectionId}
          loggingOut={loggingOut}
          onLogout={() => void handleLogout()}
          onQuickAction={goToQuickAction}
          onSelectSection={setActiveSectionId}
          pendingPayablesCount={payables.length}
          pendingReceivablesCount={receivables.length}
        />
      )}

      <View style={styles.main}>
        {/* Top navigation layer — kept above content so the notification panel overlays it */}
        <View style={styles.topLayer}>
          {isDesktop ? (
            <AppHeader
              rightContent={
                <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    accessibilityLabel="Abrir Assistente Financeiro IA"
                    accessibilityRole="button"
                    onPress={() => setIsAiChatOpen((prev) => !prev)}
                    style={({ pressed }) => [
                      styles.iconButton,
                      {
                        backgroundColor: isAiChatOpen ? theme.brandAI : theme.bgElevated,
                        borderColor: isAiChatOpen ? theme.brandAI : theme.borderElevated,
                        opacity: pressed ? 0.7 : 1
                      }
                    ]}
                  >
                    <Bot color={isAiChatOpen ? '#FFFFFF' : theme.brandAI} size={18} />
                  </Pressable>
                  {notificationCenter}
                </View>
              }
              subtitle={formatLongDate(new Date())}
              title={activeLabel}
            />
          ) : (
            <AppHeader
              compact
              leading={
                <View style={[styles.brandIcon, { backgroundColor: theme.incomeBadge }]}>
                  <WalletCards color={theme.income} size={18} />
                </View>
              }
              rightContent={
                <>
                  {notificationCenter}
                  <Pressable
                    accessibilityLabel="Sair"
                    accessibilityRole="button"
                    disabled={loggingOut}
                    onPress={() => void handleLogout()}
                    style={({ pressed }) => [
                      styles.iconButton,
                      {
                        backgroundColor: theme.bgElevated,
                        borderColor: theme.borderElevated,
                        opacity: pressed || loggingOut ? 0.7 : 1
                      }
                    ]}
                  >
                    {loggingOut ? (
                      <ActivityIndicator color={theme.expense} size="small" />
                    ) : (
                      <LogOut color={theme.expense} size={17} />
                    )}
                  </Pressable>
                </>
              }
              title="MoneyHub"
            />
          )}
        </View>

        {!isDesktop && (
          <QuickPills activeSection={activeSectionId} onSelectSection={setActiveSectionId} />
        )}

        <ScrollView
          contentContainerStyle={[
            styles.content,
            !isDesktop && [
              styles.contentMobile,
              { paddingBottom: Math.max(insets.bottom + 84, 100) }
            ]
          ]}
          style={styles.scroll}
        >
          {renderSection()}
        </ScrollView>

        {!isDesktop && (
          <BottomNavBar
            activeSection={activeSectionId}
            onOpenQuickAction={() => setQuickActionModalOpen(true)}
            onSelectSection={setActiveSectionId}
          />
        )}
      </View>

      {/* Floating AI widget */}
      {activeSectionId !== 'ai' && (
        <AiAssistant
          hideFloatingTrigger={isDesktop}
          isOpen={isAiChatOpen}
          onClose={() => setIsAiChatOpen(false)}
          onToggle={() => setIsAiChatOpen((prev) => !prev)}
          {...(summaryData?.myProfile?.preferredCurrency
            ? { preferredCurrency: summaryData.myProfile.preferredCurrency }
            : {})}
        />
      )}

      {/* Desktop quick "+" lives in the Sidebar; mobile uses the BottomNavBar FAB */}
      {isDesktop && activeSectionId === 'dashboard' && (
        <Pressable
          accessibilityLabel="Novo lançamento rápido"
          accessibilityRole="button"
          onPress={() => setQuickActionModalOpen(true)}
          style={({ pressed }) => [
            styles.desktopFab,
            { backgroundColor: theme.income, opacity: pressed ? 0.85 : 1 }
          ]}
        >
          <Plus color="#FFFFFF" size={18} strokeWidth={2.5} />
          <Text style={styles.desktopFabText}>Novo lançamento</Text>
        </Pressable>
      )}

      <QuickActionModal
        onClose={() => setQuickActionModalOpen(false)}
        onSelectAction={(actionId) => {
          setQuickActionModalOpen(false);
          goToQuickAction(actionId);
        }}
        visible={quickActionModalOpen}
      />

      <TransactionModal
        onClose={() => setIsTransactionModalOpen(false)}
        onSuccess={() => void refetchSummary?.()}
        preferredCurrency={currency}
        visible={isTransactionModalOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  aiAvatar: {
    alignItems: 'center',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  assistantPanel: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    padding: 20
  },
  brandIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 34,
    justifyContent: 'center',
    marginRight: 10,
    width: 34
  },
  content: {
    gap: 16,
    marginHorizontal: 'auto',
    maxWidth: 1200,
    paddingHorizontal: 24,
    paddingVertical: 14,
    width: '100%'
  },
  contentMobile: {
    padding: 16,
    paddingBottom: 32
  },
  desktopFab: {
    alignItems: 'center',
    borderRadius: 9999,
    bottom: 28,
    elevation: 4,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 20,
    position: 'absolute',
    right: 104,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)'
  },
  desktopFabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  emptyGridText: {
    fontSize: 13,
    textAlign: 'center'
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  gridCard: {
    flexBasis: 340,
    flexGrow: 1,
    gap: 12,
    padding: 18
  },
  gridCardMobile: {
    flexBasis: '100%',
    width: '100%',
    padding: 14
  },
  gridCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  gridCardTitle: {
    fontSize: 16,
    fontWeight: '700'
  },
  goalItem: {
    gap: 6
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  goalsList: {
    gap: 16
  },
  header: {
    gap: 8
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between'
  },
  headerRowMobile: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: 10,
    width: '100%'
  },
  headerCopy: {
    flex: 1,
    gap: 6
  },
  headerCopyMobile: {
    gap: 4,
    width: '100%'
  },
  titleRowMobile: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10
  },
  titleMobile: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4
  },
  headerActionsMobile: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 2
  },
  primaryCtaButtonMobile: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 44,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14
  },
  heroCard: {
    borderRadius: 16,
    boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.15)'
  },
  heroFooter: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 8,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  heroFooterText: {
    color: '#ECFDF5',
    fontSize: 12,
    fontWeight: '600'
  },
  heroIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    width: 30
  },
  heroLabel: {
    color: '#A7F3D0'
  },
  heroValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontVariant: ['tabular-nums'],
    fontWeight: '800'
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  inlineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  kpiCard: {
    borderRadius: 16,
    flexBasis: 220,
    flexGrow: 1,
    gap: 6,
    minHeight: 124,
    padding: 16
  },
  kpiCardHeroMobile: {
    flexBasis: '100%',
    minHeight: 112
  },
  kpiCardHalfMobile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 112,
    padding: 12
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14
  },
  kpiHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  kpiIconWrap: {
    alignItems: 'center',
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    width: 30
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: '600'
  },
  kpiSub: {
    fontSize: 12,
    marginTop: 2
  },
  kpiValue: {
    fontSize: 26,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 4
  },
  linkButton: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 4
  },
  linkText: {
    fontSize: 13,
    fontWeight: '700'
  },
  main: {
    flex: 1
  },
  panelCopy: {
    flex: 1,
    gap: 4,
    minWidth: 200
  },
  panelSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '700'
  },
  primaryAction: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 18
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  primaryCtaButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 14
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  quickListAmount: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    fontWeight: '700'
  },
  quickListDate: {
    fontSize: 12
  },
  quickListDesc: {
    fontSize: 14,
    fontWeight: '600'
  },
  scroll: {
    flex: 1
  },
  settleButton: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 76,
    paddingHorizontal: 12
  },
  settleText: {
    fontSize: 12,
    fontWeight: '700'
  },
  shell: {
    flex: 1,
    minHeight: '100%'
  },
  shellDesktop: {
    flexDirection: 'row'
  },
  smallBadgeText: {
    fontSize: 11
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 720
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5
  },
  topLayer: {
    zIndex: 5
  },
  twoColumnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14
  },
  upcomingCopy: {
    flex: 1,
    gap: 4
  },
  upcomingIcon: {
    alignItems: 'center',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  upcomingMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  upcomingRight: {
    alignItems: 'flex-end',
    gap: 6
  },
  upcomingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10
  }
});
