import {
  LogOut,
  Plus,
  Settings,
  WalletCards
} from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle
} from 'react-native';
import {
  NavigationId,
  primaryModules,
  secondaryModules
} from '../../navigation/modules';
import { useTheme } from '../../theme/ThemeContext';

export interface SidebarProps {
  activeSection: NavigationId;
  onSelectSection: (id: NavigationId) => void;
  pendingPayablesCount?: number | undefined;
  pendingReceivablesCount?: number | undefined;
  onQuickAction: (action: 'a_pagar' | 'a_receber' | 'categoria' | 'meta') => void;
  onLogout: () => void;
  loggingOut?: boolean | undefined;
  style?: StyleProp<ViewStyle> | undefined;
}

export function Sidebar({
  activeSection,
  onSelectSection,
  pendingPayablesCount = 0,
  pendingReceivablesCount = 0,
  onQuickAction,
  onLogout,
  loggingOut = false,
  style
}: SidebarProps): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.bgSurface,
          borderRightColor: theme.separator || theme.border
        },
        style
      ]}
    >
      {/* Brand */}
      <View style={styles.brandRow}>
        <View style={[styles.brandIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
          <WalletCards color={theme.income} size={22} />
        </View>
        <Text accessibilityRole="header" style={[styles.brandTitle, { color: theme.textPrimary }]}>
          MoneyHub
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Primary 7 Modules */}
        <View style={styles.sectionGroup}>
          <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>
            MENU PRINCIPAL
          </Text>
          {primaryModules.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const isAI = item.id === 'ai';

            let count = 0;
            if (item.badgeCountKey === 'payables') count = pendingPayablesCount;
            if (item.badgeCountKey === 'receivables') count = pendingReceivablesCount;

            return (
              <Pressable
                accessibilityLabel={item.label}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                key={item.id}
                onPress={() => onSelectSection(item.id)}
                style={({ pressed }) => [
                  styles.navItem,
                  {
                    backgroundColor: isActive
                      ? isAI
                        ? 'rgba(99, 102, 241, 0.15)'
                        : 'rgba(16, 185, 129, 0.15)'
                      : pressed
                        ? theme.bgElevated
                        : 'transparent'
                  }
                ]}
              >
                <Icon
                  color={
                    isActive
                      ? isAI
                        ? theme.brandAI
                        : theme.income
                      : theme.textSecondary
                  }
                  size={18}
                />
                <Text
                  style={[
                    styles.navLabel,
                    {
                      color: isActive
                        ? isAI
                          ? theme.brandAI
                          : theme.income
                        : theme.textSecondary,
                      fontWeight: isActive ? '700' : '500'
                    }
                  ]}
                >
                  {item.label}
                </Text>

                {count > 0 && (
                  <View
                    style={[
                      styles.countBadge,
                      {
                        backgroundColor:
                          item.id === 'a_pagar'
                            ? theme.expenseBadge
                            : theme.incomeBadge
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.countText,
                        {
                          color:
                            item.id === 'a_pagar'
                              ? theme.expense
                              : theme.income
                        }
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Secondary Modules */}
        <View style={styles.sectionGroup}>
          <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>
            OUTROS
          </Text>
          {secondaryModules.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <Pressable
                accessibilityLabel={item.label}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                key={item.id}
                onPress={() => onSelectSection(item.id)}
                style={({ pressed }) => [
                  styles.navItem,
                  {
                    backgroundColor: isActive
                      ? 'rgba(16, 185, 129, 0.15)'
                      : pressed
                        ? theme.bgElevated
                        : 'transparent'
                  }
                ]}
              >
                <Icon
                  color={isActive ? theme.income : theme.textSecondary}
                  size={18}
                />
                <Text
                  style={[
                    styles.navLabel,
                    {
                      color: isActive ? theme.income : theme.textSecondary,
                      fontWeight: isActive ? '700' : '500'
                    }
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Quick Actions Block */}
        <View
          style={[
            styles.quickActionsBlock,
            {
              backgroundColor: theme.bgElevated,
              borderColor: theme.borderElevated
            }
          ]}
        >
          <Text style={[styles.quickActionsTitle, { color: theme.textPrimary }]}>
            Ações Rápidas
          </Text>
          <View style={styles.quickButtonsGrid}>
            <Pressable
              accessibilityLabel="Criar A Pagar"
              accessibilityRole="button"
              onPress={() => onQuickAction('a_pagar')}
              style={[styles.quickButton, { borderColor: theme.border }]}
            >
              <Plus color={theme.expense} size={14} />
              <Text style={[styles.quickButtonText, { color: theme.textPrimary }]}>
                A Pagar
              </Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Criar A Receber"
              accessibilityRole="button"
              onPress={() => onQuickAction('a_receber')}
              style={[styles.quickButton, { borderColor: theme.border }]}
            >
              <Plus color={theme.income} size={14} />
              <Text style={[styles.quickButtonText, { color: theme.textPrimary }]}>
                A Receber
              </Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Criar Categoria"
              accessibilityRole="button"
              onPress={() => onQuickAction('categoria')}
              style={[styles.quickButton, { borderColor: theme.border }]}
            >
              <Plus color={theme.info} size={14} />
              <Text style={[styles.quickButtonText, { color: theme.textPrimary }]}>
                Categoria
              </Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Criar Meta"
              accessibilityRole="button"
              onPress={() => onQuickAction('meta')}
              style={[styles.quickButton, { borderColor: theme.border }]}
            >
              <Plus color={theme.warning} size={14} />
              <Text style={[styles.quickButtonText, { color: theme.textPrimary }]}>
                Meta
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Footer: Settings and Logout */}
      <View style={[styles.footer, { borderTopColor: theme.separator || theme.border }]}>
        <Pressable
          accessibilityLabel="Ajustes"
          accessibilityRole="button"
          onPress={() => onSelectSection('ajustes')}
          style={({ pressed }) => [
            styles.navItem,
            {
              backgroundColor: activeSection === 'ajustes'
                ? theme.bgElevated
                : pressed
                  ? theme.bgElevated
                  : 'transparent'
            }
          ]}
        >
          <Settings color={theme.textSecondary} size={18} />
          <Text style={[styles.navLabel, { color: theme.textSecondary }]}>
            Ajustes
          </Text>
        </Pressable>

        <Pressable
          accessibilityLabel="Sair"
          accessibilityRole="button"
          disabled={loggingOut}
          onPress={onLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            {
              backgroundColor: pressed ? 'rgba(244, 63, 94, 0.1)' : 'transparent',
              opacity: loggingOut ? 0.6 : 1
            }
          ]}
        >
          {loggingOut ? (
            <ActivityIndicator color={theme.expense} size="small" />
          ) : (
            <LogOut color={theme.expense} size={18} />
          )}
          <Text style={[styles.logoutText, { color: theme.expense }]}>
            Sair
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brandIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 22
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4
  },
  container: {
    borderRightWidth: StyleSheet.hairlineWidth,
    flexDirection: 'column',
    height: '100%',
    width: 260
  },
  countBadge: {
    borderRadius: 9999,
    marginLeft: 'auto',
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  countText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '700'
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
    padding: 12
  },
  logoutButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    minHeight: 40,
    paddingHorizontal: 12
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600'
  },
  navItem: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  navLabel: {
    fontSize: 14
  },
  quickActionsBlock: {
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    marginTop: 14,
    padding: 12
  },
  quickActionsTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  quickButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '47%',
    flexDirection: 'row',
    gap: 4,
    height: 36,
    minHeight: 36,
    justifyContent: 'center'
  },
  quickButtonText: {
    fontSize: 12,
    fontWeight: '600'
  },
  quickButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  scrollContent: {
    gap: 16,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  sectionGroup: {
    gap: 4
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
    paddingHorizontal: 12
  }
});
