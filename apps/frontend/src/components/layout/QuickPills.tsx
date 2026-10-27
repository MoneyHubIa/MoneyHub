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
import { haptic } from '../../services/haptics';

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
          borderBottomColor: theme.separator
        },
        style
      ]}
    >
      {allNavigationItems.map((item) => {
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
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            key={item.id}
            onPress={() => {
              void haptic.selection();
              onSelectSection(item.id);
            }}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor: isActive
                  ? activeBg
                  : theme.bgElevated,
                borderColor: isActive
                  ? activeBg
                  : theme.borderElevated,
                transform: [{ scale: pressed ? 0.97 : 1 }],
                opacity: pressed ? 0.8 : 1
              }
            ]}
          >
            <Icon
              color={isActive ? activeText : theme.textSecondary}
              size={15}
            />
            <Text
              style={[
                styles.pillText,
                {
                  color: isActive ? activeText : theme.textSecondary,
                  fontWeight: isActive ? '700' : '600'
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
    paddingVertical: 8
  },
  pill: {
    alignItems: 'center',
    borderRadius: 9999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600'
  },
  scrollView: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    maxHeight: 56
  }
});
