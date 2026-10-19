import {
  CalendarClock,
  LayoutDashboard,
  Plus,
  Tag,
  Target
} from 'lucide-react-native';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle
} from 'react-native';
import { NavigationId } from '../../navigation/modules';
import { useTheme } from '../../theme/ThemeContext';

export interface BottomNavBarProps {
  activeSection: NavigationId;
  onSelectSection: (id: NavigationId) => void;
  onOpenQuickAction: () => void;
  style?: StyleProp<ViewStyle> | undefined;
}

export function BottomNavBar({
  activeSection,
  onSelectSection,
  onOpenQuickAction,
  style
}: BottomNavBarProps): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.bgSurface,
          borderTopColor: theme.border
        },
        style
      ]}
    >
      {/* 1. Início (Dashboard) */}
      <Pressable
        accessibilityLabel="Início"
        accessibilityRole="button"
        accessibilityState={{ selected: activeSection === 'dashboard' }}
        onPress={() => onSelectSection('dashboard')}
        style={styles.tab}
      >
        <LayoutDashboard
          color={activeSection === 'dashboard' ? theme.income : theme.textSecondary}
          size={20}
        />
        <Text
          style={[
            styles.tabLabel,
            {
              color: activeSection === 'dashboard' ? theme.income : theme.textSecondary,
              fontWeight: activeSection === 'dashboard' ? '700' : '500'
            }
          ]}
        >
          Início
        </Text>
      </Pressable>

      {/* 2. A Pagar */}
      <Pressable
        accessibilityLabel="A Pagar"
        accessibilityRole="button"
        accessibilityState={{ selected: activeSection === 'a_pagar' }}
        onPress={() => onSelectSection('a_pagar')}
        style={styles.tab}
      >
        <CalendarClock
          color={activeSection === 'a_pagar' ? theme.income : theme.textSecondary}
          size={20}
        />
        <Text
          style={[
            styles.tabLabel,
            {
              color: activeSection === 'a_pagar' ? theme.income : theme.textSecondary,
              fontWeight: activeSection === 'a_pagar' ? '700' : '500'
            }
          ]}
        >
          A Pagar
        </Text>
      </Pressable>

      {/* 3. Botão Flutuante Central (+) em #10B981 */}
      <View style={styles.centerButtonWrapper}>
        <Pressable
          accessibilityLabel="Novo lançamento rápido"
          accessibilityRole="button"
          onPress={onOpenQuickAction}
          style={({ pressed }) => [
            styles.floatingButton,
            {
              backgroundColor: theme.income,
              opacity: pressed ? 0.85 : 1
            }
          ]}
        >
          <Plus color="#FFFFFF" size={26} strokeWidth={2.5} />
        </Pressable>
      </View>

      {/* 4. Categorias */}
      <Pressable
        accessibilityLabel="Categorias"
        accessibilityRole="button"
        accessibilityState={{ selected: activeSection === 'financeiro' }}
        onPress={() => onSelectSection('financeiro')}
        style={styles.tab}
      >
        <Tag
          color={activeSection === 'financeiro' ? theme.income : theme.textSecondary}
          size={20}
        />
        <Text
          style={[
            styles.tabLabel,
            {
              color: activeSection === 'financeiro' ? theme.income : theme.textSecondary,
              fontWeight: activeSection === 'financeiro' ? '700' : '500'
            }
          ]}
        >
          Categorias
        </Text>
      </Pressable>

      {/* 5. Metas */}
      <Pressable
        accessibilityLabel="Metas"
        accessibilityRole="button"
        accessibilityState={{ selected: activeSection === 'metas' }}
        onPress={() => onSelectSection('metas')}
        style={styles.tab}
      >
        <Target
          color={activeSection === 'metas' ? theme.income : theme.textSecondary}
          size={20}
        />
        <Text
          style={[
            styles.tabLabel,
            {
              color: activeSection === 'metas' ? theme.income : theme.textSecondary,
              fontWeight: activeSection === 'metas' ? '700' : '500'
            }
          ]}
        >
          Metas
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centerButtonWrapper: {
    alignItems: 'center',
    height: 60,
    justifyContent: 'center',
    top: -12,
    width: 60
  },
  container: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-around',
    paddingBottom: 6,
    paddingHorizontal: 8,
    zIndex: 20
  },
  floatingButton: {
    alignItems: 'center',
    borderRadius: 27,
    elevation: 6,
    height: 54,
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    width: 54
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minHeight: 44
  },
  tabLabel: {
    fontSize: 11
  }
});
