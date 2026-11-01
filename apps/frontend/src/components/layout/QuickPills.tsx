import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle
} from 'react-native';
import { allNavigationItems, NavigationId } from '../../navigation/modules';
import { useTheme } from '../../theme/ThemeContext';

const firstModuleIds: NavigationId[] = ['dashboard', 'transacoes', 'credit_cards'];
const mobileNavigationItems = [
  ...allNavigationItems.filter((item) => firstModuleIds.includes(item.id)),
  ...allNavigationItems.filter((item) => !firstModuleIds.includes(item.id))
];

export interface QuickPillsProps {
  activeSection: NavigationId;
  onSelectSection: (id: NavigationId) => void;
  style?: StyleProp<ViewStyle> | undefined;
}

export function QuickPills({
  activeSection,
  onSelectSection,
  style
}: QuickPillsProps): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[
        styles.scrollView,
        {
          backgroundColor: theme.bgSurface,
          borderBottomColor: theme.border
        },
        style
      ]}
    >
      {mobileNavigationItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeSection === item.id;
        const isAI = item.id === 'ai';

        const activeBg = isAI ? theme.brandAI : theme.income;
        const activeText = '#FFFFFF';

        return (
          <Pressable
            accessibilityLabel={`Pílula ${item.label}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            key={item.id}
            onPress={() => onSelectSection(item.id)}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor: isActive
                  ? activeBg
                  : theme.bgElevated,
                borderColor: isActive
                  ? activeBg
                  : theme.borderElevated,
                opacity: pressed ? 0.75 : 1
              }
            ]}
          >
            <Icon
              color={isActive ? activeText : theme.textSecondary}
              size={14}
            />
            <Text
              style={[
                styles.pillText,
                {
                  color: isActive ? activeText : theme.textSecondary,
                  fontWeight: isActive ? '700' : '500'
                }
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  pill: {
    alignItems: 'center',
    borderRadius: 9999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 6
  },
  pillText: {
    fontSize: 13
  },
  scrollView: {
    borderBottomWidth: 1,
    maxHeight: 56
  }
});
