import {
  BarChart3,
  Bot,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Settings,
  Target,
  WalletCards
} from 'lucide-react-native';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';

const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'financeiro', label: 'Financeiro', icon: WalletCards },
  { id: 'contas', label: 'Contas', icon: CreditCard },
  { id: 'metas', label: 'Metas', icon: Target },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'ia', label: 'IA', icon: Bot },
  { id: 'ajustes', label: 'Ajustes', icon: Settings }
] as const;

type NavigationId = (typeof navigationItems)[number]['id'];

export function DashboardShell() {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const [activeSectionId, setActiveSectionId] =
    useState<NavigationId>('dashboard');
  const activeSection =
    navigationItems.find((item) => item.id === activeSectionId) ??
    navigationItems[0];

  return (
    <View style={[styles.shell, desktop ? styles.shellDesktop : styles.shellMobile]}>
      <View style={[styles.navigation, desktop && styles.navigationDesktop]}>
        <View style={styles.brand}>
          <WalletCards color="#0f766e" size={28} />
          <Text accessibilityRole="header" style={styles.brandText}>MoneyHub</Text>
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
              {['Saldo previsto', 'Receitas do mes', 'Despesas do mes'].map((label) => (
                <View key={label} style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>{label}</Text>
                  <Text style={styles.kpiValue}>R$ 0,00</Text>
                </View>
              ))}
            </View>

            <View style={styles.assistantPanel}>
              <View style={styles.panelCopy}>
                <Text style={styles.eyebrow}>IA Financeira</Text>
                <Text accessibilityRole="header" style={styles.panelTitle}>
                  Insights contextualizados
                </Text>
              </View>
              <Pressable accessibilityRole="button" style={styles.primaryAction}>
                <Bot color="#ffffff" size={18} />
                <Text style={styles.primaryActionText}>Consultar IA</Text>
              </Pressable>
            </View>

            <View accessibilityLabel="Indicadores" style={styles.chartPlaceholder}>
              <BarChart3 color="#0f766e" size={40} />
              <Text style={styles.placeholderText}>
                Os graficos serao conectados aos dados financeiros nas proximas tasks.
              </Text>
            </View>
          </>
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
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, minHeight: '100%', backgroundColor: '#f8fafc' },
  shellDesktop: { flexDirection: 'row' },
  shellMobile: { flexDirection: 'column' },
  navigation: { backgroundColor: '#ffffff', borderBottomColor: '#e2e8f0', borderBottomWidth: 1 },
  navigationDesktop: { width: 248, borderBottomWidth: 0, borderRightColor: '#e2e8f0', borderRightWidth: 1, padding: 20 },
  brand: { alignItems: 'center', flexDirection: 'row', gap: 10, padding: 16 },
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
  assistantPanel: { alignItems: 'center', backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderRadius: 6, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', padding: 20 },
  panelCopy: { gap: 4 },
  panelTitle: { color: '#0f172a', fontSize: 19, fontWeight: '700' },
  primaryAction: { alignItems: 'center', backgroundColor: '#0f766e', borderRadius: 6, flexDirection: 'row', gap: 8, minHeight: 42, paddingHorizontal: 16, paddingVertical: 10 },
  primaryActionText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  chartPlaceholder: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: 6, borderStyle: 'dashed', borderWidth: 1, gap: 12, justifyContent: 'center', minHeight: 220, padding: 24 },
  placeholderText: { color: '#64748b', fontSize: 14, maxWidth: 520, textAlign: 'center' }
});
