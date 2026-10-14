import { gql } from '@apollo/client';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Repeat,
  Settings,
  Sun,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import { useTheme } from '../theme/ThemeContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { AccountsPayable } from './AccountsPayable';
import { AccountsReceivable } from './AccountsReceivable';
import { Agenda } from './Agenda';
import { AiAssistant } from './AiAssistant';
import { CashFlowChart } from './CashFlowChart';
import { CategoryAnalysis } from './CategoryAnalysis';
import { CostCenters } from './CostCenters';
import { FinancialCategories } from './FinancialCategories';
import { FinancialGoalsPreview } from './FinancialGoalsPreview';
import { BottomNavBar } from './layout/BottomNavBar';
import { QuickActionModal } from './layout/QuickActionModal';
import { QuickPills } from './layout/QuickPills';
import { NotificationCenter } from './NotificationCenter';
import { PeriodComparison } from './PeriodComparison';
import { ProfileSettings } from './ProfileSettings';
import { RecurringTransactions } from './RecurringTransactions';
import { Transactions } from './Transactions';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { ProgressBar } from './ui/ProgressBar';

export const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transacoes', label: 'Transações', icon: WalletCards },
  { id: 'a_pagar', label: 'A Pagar', icon: CalendarClock },
  { id: 'a_receber', label: 'A Receber', icon: HandCoins },
  { id: 'recorrencias', label: 'Recorrências', icon: Repeat },
  { id: 'financeiro', label: 'Categorias', icon: WalletCards },
  { id: 'contas', label: 'Centros', icon: CreditCard },
  { id: 'metas', label: 'Metas', icon: Target },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'ajustes', label: 'Ajustes', icon: Settings }
] as const;

export type NavigationId =
  | 'dashboard'
  | 'transacoes'
  | 'a_pagar'
  | 'a_receber'
  | 'recorrencias'
  | 'financeiro'
  | 'contas'
  | 'metas'
  | 'agenda'
  | 'ajustes'
  | 'ai';

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

function localIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

type AccountItem = {
  id: string;
  description: string;
  amount: string;
  dueDate: string;
  status: string;
};

type DashboardSummaryData = {
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
  myProfile?: {
    id: string;
    preferredCurrency: string;
  };
};

export function DashboardShell(): React.JSX.Element {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const { theme, isDark, toggleTheme } = useTheme();
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

  const [syncAgendaNotifications] = useMutation(SYNC_AGENDA_NOTIFICATIONS);

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

  const currency = (summaryData?.myProfile?.preferredCurrency ?? 'BRL') as 'BRL' | 'USD' | 'EUR';
  const payables = summaryData?.myAccountsPayable ?? [];
  const receivables = summaryData?.myAccountsReceivable ?? [];

  const totalPayablePending = payables.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalReceivablePending = receivables.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const netBalanceNum = Number(summaryData?.dashboardSummary?.netBalance ?? 0);
  const projectedBalance = netBalanceNum + totalReceivablePending - totalPayablePending;

  const activeSection =
    navigationItems.find((item) => item.id === activeSectionId) ?? {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard
    };

  return (
    <View
      style={[
        styles.shell,
        desktop ? styles.shellDesktop : styles.shellMobile,
        { backgroundColor: theme.bgPrimary }
      ]}
    >
      {/* Navigation Sidebar / Header Row (Z-Index preserved for regression tests) */}
      <View
        style={[
          styles.navigation,
          desktop && styles.navigationDesktop,
          {
            backgroundColor: theme.bgSurface,
            borderColor: theme.border
          }
        ]}
      >
        <View style={styles.brandRow}>
          <View style={styles.brand}>
            <WalletCards color={theme.income} size={28} />
            <Text
              accessibilityRole="header"
              style={[styles.brandText, { color: theme.textPrimary }]}
            >
              MoneyHub
            </Text>
          </View>

          <View style={styles.headerRightActions}>
            <NotificationCenter
              enabled={notificationsReady}
              onOpenSource={() => setActiveSectionId('agenda')}
              onRetrySync={syncNotifications}
              panelPlacement={desktop ? 'right' : 'left'}
              syncError={syncAgendaError}
            />

            <Pressable
              accessibilityLabel={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
              accessibilityRole="button"
              onPress={toggleTheme}
              style={[styles.themeToggleButton, { backgroundColor: theme.bgElevated }]}
            >
              {isDark ? (
                <Sun color={theme.warning} size={16} />
              ) : (
                <Moon color={theme.textPrimary} size={16} />
              )}
            </Pressable>
          </View>
        </View>

        {/* Scrollable Nav Items */}
        <ScrollView
          contentContainerStyle={desktop ? styles.navListDesktop : styles.navListMobile}
          horizontal={!desktop}
          showsHorizontalScrollIndicator={false}
        >
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeSectionId;

            return (
              <Pressable
                accessibilityLabel={item.label}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={item.id}
                onPress={() => setActiveSectionId(item.id)}
                style={[
                  styles.navButton,
                  active && [styles.navButtonActive, { backgroundColor: theme.income }],
                  !active && { backgroundColor: 'transparent' }
                ]}
              >
                <Icon color={active ? '#FFFFFF' : theme.textSecondary} size={18} />
                <Text
                  style={[
                    styles.navLabel,
                    { color: active ? '#FFFFFF' : theme.textSecondary },
                    active && styles.navLabelActive
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Logout Button */}
        <Pressable
          accessibilityLabel="Sair"
          accessibilityRole="button"
          disabled={loggingOut}
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            { borderColor: theme.borderElevated, backgroundColor: theme.bgElevated },
            pressed && styles.logoutButtonPressed,
            loggingOut && styles.logoutButtonDisabled
          ]}
        >
          {loggingOut ? (
            <ActivityIndicator color={theme.expense} size="small" />
          ) : (
            <LogOut color={theme.expense} size={18} />
          )}
          <Text style={[styles.logoutText, { color: theme.expense }]}>Sair</Text>
        </Pressable>
      </View>

      {/* Main Content Area */}
      <ScrollView contentContainerStyle={styles.content} style={styles.main}>
        {activeSectionId === 'dashboard' ? (
          <>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <View>
                  <Text style={[styles.eyebrow, { color: theme.income }]}>
                    Controle financeiro inteligente
                  </Text>
                  <Text
                    accessibilityRole="header"
                    style={[styles.title, { color: theme.textPrimary }]}
                  >
                    Dashboard financeiro
                  </Text>
                  <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                    Acompanhe saldo, receitas, despesas, metas e proximos compromissos.
                  </Text>
                </View>

                {/* Eye toggle for balance privacy */}
                <Pressable
                  accessibilityLabel={isEyeOpen ? 'Ocultar valores' : 'Mostrar valores'}
                  accessibilityRole="button"
                  onPress={() => setIsEyeOpen((prev) => !prev)}
                  style={[
                    styles.eyeButton,
                    { backgroundColor: theme.bgSurface, borderColor: theme.border }
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

            {/* 4 KPIs Grid */}
            <View accessibilityLabel="Resumo financeiro" style={styles.kpiGrid}>
              {/* 1. Saldo Previsto */}
              <Card
                style={[
                  styles.kpiCard,
                  styles.primaryKpiCard,
                  { backgroundColor: isDark ? '#064E3B' : '#ECFDF5', borderColor: theme.income }
                ]}
                variant="elevated"
              >
                <View style={styles.kpiHeaderRow}>
                  <Text style={[styles.kpiLabel, { color: isDark ? '#A7F3D0' : '#065F46' }]}>
                    Saldo previsto
                  </Text>
                  <TrendingUp color={theme.income} size={18} />
                </View>

                {loadingSummary && !summaryData?.dashboardSummary ? (
                  <ActivityIndicator color={theme.income} size="small" />
                ) : (
                  <Text
                    style={[
                      styles.kpiValue,
                      { color: isDark ? '#FFFFFF' : '#064E3B' }
                    ]}
                  >
                    {isEyeOpen
                      ? formatCurrency(summaryData?.dashboardSummary?.netBalance, currency)
                      : 'R$ ••••••'}
                  </Text>
                )}

                <View style={styles.projectedFooter}>
                  <Text style={[styles.projectedText, { color: isDark ? '#6EE7B7' : '#047857' }]}>
                    Saldo Projetado:{' '}
                    {isEyeOpen
                      ? formatCurrency(projectedBalance.toString(), currency)
                      : 'R$ ••••••'}
                  </Text>
                </View>
              </Card>

              {/* 2. Receitas do Mês */}
              <Card style={styles.kpiCard} variant="surface">
                <View style={styles.kpiHeaderRow}>
                  <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                    Receitas do mes
                  </Text>
                  <ArrowUpRight color={theme.income} size={18} />
                </View>
                {loadingSummary && !summaryData?.dashboardSummary ? (
                  <ActivityIndicator color={theme.income} size="small" />
                ) : (
                  <Text style={[styles.kpiValue, { color: theme.income }]}>
                    {isEyeOpen
                      ? formatCurrency(summaryData?.dashboardSummary?.totalIncome, currency)
                      : 'R$ ••••••'}
                  </Text>
                )}
                <Text style={[styles.kpiSub, { color: theme.textMuted }]}>
                  {summaryData?.dashboardSummary?.incomeCount ?? 0} entradas registradas
                </Text>
              </Card>

              {/* 3. Despesas do Mês */}
              <Card style={styles.kpiCard} variant="surface">
                <View style={styles.kpiHeaderRow}>
                  <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                    Despesas do mes
                  </Text>
                  <ArrowDownRight color={theme.expense} size={18} />
                </View>
                {loadingSummary && !summaryData?.dashboardSummary ? (
                  <ActivityIndicator color={theme.expense} size="small" />
                ) : (
                  <Text style={[styles.kpiValue, { color: theme.expense }]}>
                    {isEyeOpen
                      ? formatCurrency(summaryData?.dashboardSummary?.totalExpense, currency)
                      : 'R$ ••••••'}
                  </Text>
                )}
                <Text style={[styles.kpiSub, { color: theme.textMuted }]}>
                  {summaryData?.dashboardSummary?.expenseCount ?? 0} saídas registradas
                </Text>
              </Card>

              {/* 4. Alertas de Vencimento */}
              <Card style={styles.kpiCard} variant="surface">
                <View style={styles.kpiHeaderRow}>
                  <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                    Alertas de Vencimento
                  </Text>
                  <Clock color={theme.warning} size={18} />
                </View>
                <Text style={[styles.kpiValue, { color: theme.warning }]}>
                  {payables.length} a pagar
                </Text>
                <Text style={[styles.kpiSub, { color: theme.textMuted }]}>
                  {receivables.length} a receber pendentes
                </Text>
              </Card>
            </View>

            {/* AI Assistant Banner */}
            <Card
              style={[
                styles.assistantPanel,
                {
                  backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF',
                  borderColor: theme.brandAI
                }
              ]}
              variant="elevated"
            >
              <View style={styles.panelCopy}>
                <Text style={[styles.eyebrow, { color: theme.brandAI }]}>IA Financeira</Text>
                <Text
                  accessibilityRole="header"
                  style={[styles.panelTitle, { color: theme.textPrimary }]}
                >
                  Insights contextualizados
                </Text>
                <Text style={[styles.panelSubtitle, { color: theme.textSecondary }]}>
                  Obtenha análises preditivas do seu orçamento com inteligência artificial local.
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => setIsAiChatOpen(true)}
                style={[styles.primaryAction, { backgroundColor: theme.brandAI }]}
              >
                <Bot color="#FFFFFF" size={18} />
                <Text style={styles.primaryActionText}>Consultar IA</Text>
              </Pressable>
            </Card>

            {/* 2-Column Grid: Próximos Vencimentos & Metas Preview */}
            <View style={styles.twoColumnGrid}>
              {/* Próximos Vencimentos */}
              <Card style={styles.gridCard} variant="surface">
                <View style={styles.gridCardHeader}>
                  <Text style={[styles.gridCardTitle, { color: theme.textPrimary }]}>
                    Próximos Vencimentos
                  </Text>
                  <Pressable onPress={() => setActiveSectionId('a_pagar')}>
                    <Text style={[styles.linkText, { color: theme.income }]}>Ver todos</Text>
                  </Pressable>
                </View>

                {payables.length === 0 ? (
                  <Text style={[styles.emptyGridText, { color: theme.textMuted }]}>
                    Nenhuma conta a pagar pendente.
                  </Text>
                ) : (
                  payables.slice(0, 3).map((p) => (
                    <View
                      key={p.id}
                      style={[
                        styles.quickListItem,
                        { borderBottomColor: theme.borderElevated }
                      ]}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[styles.quickListDesc, { color: theme.textPrimary }]}>
                          {p.description}
                        </Text>
                        <Text style={[styles.quickListDate, { color: theme.textMuted }]}>
                          {formatDate(p.dueDate, currency)}
                        </Text>
                      </View>
                      <Text style={[styles.quickListAmount, { color: theme.expense }]}>
                        {formatCurrency(p.amount, currency)}
                      </Text>
                    </View>
                  ))
                )}
              </Card>

              {/* Metas Preview */}
              <Card style={styles.gridCard} variant="surface">
                <View style={styles.gridCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.gridCardTitle, { color: theme.textPrimary }]}>
                      Metas em Andamento
                    </Text>
                    <Badge label="Preview" tone="brandAI" />
                  </View>
                  <Pressable onPress={() => setActiveSectionId('metas')}>
                    <Text style={[styles.linkText, { color: theme.income }]}>Explorar</Text>
                  </Pressable>
                </View>

                <View style={{ gap: 12 }}>
                  <View style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={[styles.quickListDesc, { color: theme.textPrimary }]}>
                        Reserva de Emergência
                      </Text>
                      <Text style={[styles.quickListAmount, { color: theme.income }]}>61%</Text>
                    </View>
                    <ProgressBar color="#10B981" progress={0.61} />
                  </View>

                  <View style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={[styles.quickListDesc, { color: theme.textPrimary }]}>
                        Viagem dos Sonhos
                      </Text>
                      <Text style={[styles.quickListAmount, { color: theme.income }]}>70%</Text>
                    </View>
                    <ProgressBar color="#06B6D4" progress={0.7} />
                  </View>
                </View>
              </Card>
            </View>

            {/* Gráficos e Análises */}
            <CashFlowChart
              preferredCurrency={summaryData?.myProfile?.preferredCurrency ?? 'BRL'}
            />

            <CategoryAnalysis
              preferredCurrency={summaryData?.myProfile?.preferredCurrency ?? 'BRL'}
            />

            <PeriodComparison
              preferredCurrency={summaryData?.myProfile?.preferredCurrency ?? 'BRL'}
            />
          </>
        ) : activeSectionId === 'ajustes' ? (
          <ProfileSettings />
        ) : activeSectionId === 'financeiro' ? (
          <FinancialCategories />
        ) : activeSectionId === 'transacoes' ? (
          <Transactions />
        ) : activeSectionId === 'a_pagar' ? (
          <AccountsPayable />
        ) : activeSectionId === 'a_receber' ? (
          <AccountsReceivable />
        ) : activeSectionId === 'recorrencias' ? (
          <RecurringTransactions />
        ) : activeSectionId === 'contas' ? (
          <CostCenters />
        ) : activeSectionId === 'agenda' ? (
          <Agenda />
        ) : activeSectionId === 'metas' ? (
          <FinancialGoalsPreview />
        ) : activeSectionId === 'ai' ? (
          <AiAssistant viewMode="fullscreen" />
        ) : (
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: theme.income }]}>MoneyHub</Text>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: theme.textPrimary }]}
            >
              {activeSection.label}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              O conteudo de {activeSection.label} estara disponivel em breve.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Floating AI Financial Assistant Widget */}
      {activeSectionId !== 'ai' && (
        <AiAssistant
          isOpen={isAiChatOpen}
          onClose={() => setIsAiChatOpen(false)}
          onToggle={() => setIsAiChatOpen((prev) => !prev)}
          {...(summaryData?.myProfile?.preferredCurrency
            ? { preferredCurrency: summaryData.myProfile.preferredCurrency }
            : {})}
        />
      )}

      {/* Quick Action Modal */}
      <QuickActionModal
        onClose={() => setQuickActionModalOpen(false)}
        onSelectAction={(actionId) => {
          setQuickActionModalOpen(false);
          if (actionId === 'transacao') setActiveSectionId('transacoes');
          else if (actionId === 'a_pagar') setActiveSectionId('a_pagar');
          else if (actionId === 'a_receber') setActiveSectionId('a_receber');
          else if (actionId === 'categoria') setActiveSectionId('financeiro');
        }}
        visible={quickActionModalOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  assistantPanel: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
    padding: 20
  },
  brand: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    zIndex: 2
  },
  brandText: {
    fontSize: 22,
    fontWeight: '700'
  },
  content: {
    gap: 20,
    marginHorizontal: 'auto',
    maxWidth: 1200,
    padding: 24,
    width: '100%'
  },
  emptyGridText: {
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 12
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  eyeButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  gridCard: {
    flexBasis: 320,
    flexGrow: 1,
    gap: 12,
    padding: 16
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
  header: {
    gap: 8
  },
  headerRightActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  kpiCard: {
    flexBasis: 220,
    flexGrow: 1,
    gap: 6,
    minHeight: 110,
    padding: 16
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  kpiHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: '500'
  },
  kpiSub: {
    fontSize: 11,
    marginTop: 2
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600'
  },
  logoutButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    marginTop: 'auto',
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  logoutButtonDisabled: {
    opacity: 0.6
  },
  logoutButtonPressed: {
    opacity: 0.7
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600'
  },
  main: {
    flex: 1
  },
  navButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 9,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  navButtonActive: {
    elevation: 2
  },
  navigation: {
    borderBottomWidth: 1,
    zIndex: 1
  },
  navigationDesktop: {
    borderBottomWidth: 0,
    borderRightWidth: 1,
    padding: 20,
    width: 260
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '600'
  },
  navLabelActive: {
    fontWeight: '700'
  },
  navListDesktop: {
    gap: 6
  },
  navListMobile: {
    gap: 8,
    paddingBottom: 12,
    paddingHorizontal: 12
  },
  panelCopy: {
    flex: 1,
    gap: 4
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
    alignSelf: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  primaryKpiCard: {
    borderWidth: 1.5
  },
  projectedFooter: {
    marginTop: 4
  },
  projectedText: {
    fontSize: 11,
    fontWeight: '600'
  },
  quickListAmount: {
    fontSize: 13,
    fontWeight: '700'
  },
  quickListDate: {
    fontSize: 11
  },
  quickListDesc: {
    fontSize: 13,
    fontWeight: '600'
  },
  quickListItem: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8
  },
  shell: {
    flex: 1,
    minHeight: '100%'
  },
  shellDesktop: {
    flexDirection: 'row'
  },
  shellMobile: {
    flexDirection: 'column'
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 720
  },
  themeToggleButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 34,
    justifyContent: 'center',
    width: 34
  },
  title: {
    fontSize: 28,
    fontWeight: '800'
  },
  twoColumnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14
  }
});
