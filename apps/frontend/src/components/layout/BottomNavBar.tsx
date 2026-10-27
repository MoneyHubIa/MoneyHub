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
import { useAppSafeArea } from '../../theme/useAppSafeArea';
import { useTheme } from '../../theme/ThemeContext';
import { haptic } from '../../services/haptics';

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
  const insets = useAppSafeArea();

  const bottomPadding = insets.bottom > 0 ? insets.bottom : 8;
  const containerHeight = 52 + bottomPadding;

  const handleTabPress = (id: NavigationId) => {
    void haptic.selection();
    onSelectSection(id);
  };

  const handleCenterPress = () => {
    void haptic.impactLight();
    onOpenQuickAction();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.bgSurface,
          borderTopColor: theme.separator || theme.border,
          height: containerHeight,
          paddingBottom: bottomPadding
        },
        style
      ]}
    >
      {/* 1. Início (Dashboard) */}
      <Pressable
        accessibilityLabel="Início"
        accessibilityRole="button"
        accessibilityState={{ selected: activeSection === 'dashboard' }}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        onPress={() => handleTabPress('dashboard')}
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
              fontWeight: activeSection === 'dashboard' ? '700' : '600'
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
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        onPress={() => handleTabPress('a_pagar')}
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
              fontWeight: activeSection === 'a_pagar' ? '700' : '600'
            }
          ]}
        >
          A Pagar
        </Text>
      </Pressable>

      {/* 3. Botão Central (+) */}
      <View style={styles.centerButtonWrapper}>
        <Pressable
          accessibilityLabel="Novo lançamento rápido"
          accessibilityRole="button"
          hitSlop={6}
          onPress={handleCenterPress}
          style={({ pressed }) => [
            styles.floatingButton,
            {
              backgroundColor: theme.income,
              opacity: pressed ? 0.85 : 1
            }
          ]}
        >
          <Plus color="#FFFFFF" size={22} strokeWidth={2.5} />
        </Pressable>
      </View>

      {/* 4. Categorias */}
      <Pressable
        accessibilityLabel="Categorias"
        accessibilityRole="button"
        accessibilityState={{ selected: activeSection === 'financeiro' }}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        onPress={() => handleTabPress('financeiro')}
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
              fontWeight: activeSection === 'financeiro' ? '700' : '600'
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
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        onPress={() => handleTabPress('metas')}
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
              fontWeight: activeSection === 'metas' ? '700' : '600'
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
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  container: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingTop: 6,
    zIndex: 20
  },
  floatingButton: {
    alignItems: 'center',
    borderRadius: 22,
    elevation: 4,
    height: 44,
    justifyContent: 'center',
    boxShadow: '0px 3px 6px rgba(16, 185, 129, 0.25)',
    width: 44
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 44
  },
  tabLabel: {
    fontSize: 11
  }
});
