import { gql } from '@apollo/client';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { useRouter } from 'expo-router';
import {
  Bot,
  CalendarClock,
  CalendarDays,
  CreditCard,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Repeat,
  Settings,
  Target,
  WalletCards
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
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
import { ProfileSettings } from './ProfileSettings';
import { FinancialCategories } from './FinancialCategories';
import { CostCenters } from './CostCenters';
import { Transactions } from './Transactions';
import { AccountsPayable } from './AccountsPayable';
import { AccountsReceivable } from './AccountsReceivable';
import { RecurringTransactions } from './RecurringTransactions';
import { CashFlowChart } from './CashFlowChart';
import { CategoryAnalysis } from './CategoryAnalysis';
import { PeriodComparison } from './PeriodComparison';
import { AiAssistant } from './AiAssistant';
import { Agenda } from './Agenda';
import { NotificationCenter } from './NotificationCenter';

const navigationItems = [
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

type NavigationId = (typeof navigationItems)[number]['id'];

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
  myProfile?: {
    id: string;
    preferredCurrency: string;
  };
};

import { formatCurrency } from '../utils/formatters';

export function DashboardShell() {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const { logout } = useAuth();
  const router = useRouter();
  const apolloClient = useApolloClient();
  const [activeSectionId, setActiveSectionId] =
    useState<NavigationId>('dashboard');
  const [isAiChatOpen, setIsAiChatOpen] = useState<boolean>(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notificationsReady, setNotificationsReady] = useState(false);
  const [syncAgendaError, setSyncAgendaError] = useState(false);
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

  const activeSection =
    navigationItems.find((item) => item.id === activeSectionId) ??
    navigationItems[0];

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

  return (
    <View style={[styles.shell, desktop ? styles.shellDesktop : styles.shellMobile]}>
      <View style={[styles.navigation, desktop && styles.navigationDesktop]}>
        <View style={styles.brandRow}>
          <View style={styles.brand}>
            <WalletCards color="#0f766e" size={28} />
            <Text accessibilityRole="header" style={styles.brandText}>MoneyHub</Text>
          </View>
          <NotificationCenter
            enabled={notificationsReady}
            onOpenSource={() => setActiveSectionId('agenda')}
            onRetrySync={syncNotifications}
            syncError={syncAgendaError}
          />
        </View>

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
                style={[styles.navButton, active && styles.navButtonActive]}
              >
                <Icon color={active ? '#ffffff' : '#475569'} size={18} />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          accessibilityLabel="Sair"
          accessibilityRole="button"
          disabled={loggingOut}
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.logoutButtonPressed,
            loggingOut && styles.logoutButtonDisabled
          ]}
        >
          {loggingOut ? (
            <ActivityIndicator color="#b91c1c" size="small" />
          ) : (
            <LogOut color="#b91c1c" size={18} />
          )}
          <Text style={styles.logoutText}>Sair</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} style={styles.main}>
        {activeSectionId === 'dashboard' ? (
          <>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>Controle financeiro inteligente</Text>
              <Text accessibilityRole="header" style={styles.title}>
                Dashboard financeiro
              </Text>
              <Text style={styles.subtitle}>
                Acompanhe saldo, receitas, despesas, metas e proximos compromissos.
              </Text>
            </View>

            <View accessibilityLabel="Resumo financeiro" style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Saldo previsto</Text>
                {loadingSummary && !summaryData?.dashboardSummary ? (
                  <ActivityIndicator color="#0f766e" size="small" />
                ) : (
                  <Text
                    style={[
                      styles.kpiValue,
                      Number(summaryData?.dashboardSummary?.netBalance ?? 0) >= 0
                        ? styles.positiveValue
                        : styles.negativeValue
                    ]}
                  >
                    {formatCurrency(
                      summaryData?.dashboardSummary?.netBalance,
                      summaryData?.myProfile?.preferredCurrency
                    )}
                  </Text>
                )}
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Receitas do mes</Text>
                {loadingSummary && !summaryData?.dashboardSummary ? (
                  <ActivityIndicator color="#059669" size="small" />
                ) : (
                  <Text style={[styles.kpiValue, styles.incomeValue]}>
                    {formatCurrency(
                      summaryData?.dashboardSummary?.totalIncome,
                      summaryData?.myProfile?.preferredCurrency
                    )}
                  </Text>
                )}
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Despesas do mes</Text>
                {loadingSummary && !summaryData?.dashboardSummary ? (
                  <ActivityIndicator color="#dc2626" size="small" />
                ) : (
                  <Text style={[styles.kpiValue, styles.expenseValue]}>
                    {formatCurrency(
                      summaryData?.dashboardSummary?.totalExpense,
                      summaryData?.myProfile?.preferredCurrency
                    )}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.assistantPanel}>
              <View style={styles.panelCopy}>
                <Text style={styles.eyebrow}>IA Financeira</Text>
                <Text accessibilityRole="header" style={styles.panelTitle}>
                  Insights contextualizados
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsAiChatOpen(true)}
                style={styles.primaryAction}
              >
                <Bot color="#ffffff" size={18} />
                <Text style={styles.primaryActionText}>Consultar IA</Text>
              </Pressable>
            </View>

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
        ) : (
          <View style={styles.header}>
            <Text style={styles.eyebrow}>MoneyHub</Text>
            <Text accessibilityRole="header" style={styles.title}>
              {activeSection.label}
            </Text>
            <Text style={styles.subtitle}>
              O conteudo de {activeSection.label} estara disponivel em breve.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Floating AI Financial Assistant Widget */}
      <AiAssistant
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
        onToggle={() => setIsAiChatOpen((prev) => !prev)}
        preferredCurrency={summaryData?.myProfile?.preferredCurrency}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, minHeight: '100%', backgroundColor: '#f8fafc' },
  shellDesktop: { flexDirection: 'row' },
  shellMobile: { flexDirection: 'column' },
  navigation: { backgroundColor: '#ffffff', borderBottomColor: '#e2e8f0', borderBottomWidth: 1 },
  navigationDesktop: { width: 248, borderBottomWidth: 0, borderRightColor: '#e2e8f0', borderRightWidth: 1, padding: 20 },
  brandRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  brand: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  brandText: { color: '#0f172a', fontSize: 22, fontWeight: '700' },
  navListDesktop: { gap: 6 },
  navListMobile: { gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  navButton: { alignItems: 'center', borderRadius: 6, flexDirection: 'row', gap: 9, minHeight: 42, paddingHorizontal: 12, paddingVertical: 10 },
  navButtonActive: { backgroundColor: '#0f766e' },
  navLabel: { color: '#475569', fontSize: 14, fontWeight: '600' },
  navLabelActive: { color: '#ffffff' },
  main: { flex: 1 },
  content: { gap: 20, marginHorizontal: 'auto', maxWidth: 1180, padding: 24, width: '100%' },
  header: { gap: 8 },
  eyebrow: { color: '#0f766e', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: '#0f172a', fontSize: 30, fontWeight: '700' },
  subtitle: { color: '#64748b', fontSize: 16, lineHeight: 24, maxWidth: 720 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: 6, borderWidth: 1, flexBasis: 220, flexGrow: 1, gap: 8, minHeight: 110, padding: 18 },
  kpiLabel: { color: '#64748b', fontSize: 14 },
  kpiValue: { color: '#0f172a', fontSize: 24, fontWeight: '700' },
  positiveValue: { color: '#059669' },
  negativeValue: { color: '#dc2626' },
  incomeValue: { color: '#059669' },
  expenseValue: { color: '#dc2626' },
  assistantPanel: { alignItems: 'center', backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderRadius: 6, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', padding: 20 },
  panelCopy: { gap: 4 },
  panelTitle: { color: '#0f172a', fontSize: 19, fontWeight: '700' },
  primaryAction: { alignItems: 'center', backgroundColor: '#0f766e', borderRadius: 6, flexDirection: 'row', gap: 8, minHeight: 42, paddingHorizontal: 16, paddingVertical: 10 },
  primaryActionText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  chartPlaceholder: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: 6, borderStyle: 'dashed', borderWidth: 1, gap: 12, justifyContent: 'center', minHeight: 220, padding: 24 },
  placeholderText: { color: '#64748b', fontSize: 14, maxWidth: 520, textAlign: 'center' },
  logoutButton: { alignItems: 'center', borderColor: '#fecaca', borderRadius: 6, borderWidth: 1, flexDirection: 'row', gap: 9, marginTop: 'auto', minHeight: 42, paddingHorizontal: 12, paddingVertical: 10 },
  logoutButtonPressed: { backgroundColor: '#fef2f2' },
  logoutButtonDisabled: { opacity: 0.6 },
  logoutText: { color: '#b91c1c', fontSize: 14, fontWeight: '600' }
});
