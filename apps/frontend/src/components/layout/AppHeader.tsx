import { Moon, Sun } from 'lucide-react-native';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export interface AppHeaderProps {
  title: string;
  subtitle?: string | undefined;
  onToggleTheme?: (() => void) | undefined;
  currentCurrency?: string | undefined;
  onSelectCurrency?: ((currency: string) => void) | undefined;
  rightContent?: React.ReactNode | undefined;
  leading?: React.ReactNode | undefined;
  compact?: boolean | undefined;
  style?: StyleProp<ViewStyle> | undefined;
}

export function AppHeader({
  title,
  subtitle,
  onToggleTheme,
  currentCurrency = 'BRL',
  onSelectCurrency,
  rightContent,
  leading,
  compact = false,
  style
}: AppHeaderProps): React.JSX.Element {
  const { theme, isDark, toggleTheme } = useTheme();

  const handleToggle = onToggleTheme ?? toggleTheme;

  const nextCurrency = currentCurrency === 'BRL' ? 'USD' : currentCurrency === 'USD' ? 'EUR' : 'BRL';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.bgSurface,
          borderBottomColor: theme.border
        },
        compact && styles.compactContainer,
        style
      ]}
    >
      {leading}
      <View style={styles.titleArea}>
        <Text
          accessibilityRole="header"
          style={[
            styles.title,
            { color: theme.textPrimary },
            compact && styles.compactTitle
          ]}
        >
          {title}
        </Text>
        {subtitle && !compact && (
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        {onSelectCurrency && (
          <Pressable
            accessibilityLabel={`Moeda atual ${currentCurrency}. Toque para alternar.`}
            accessibilityRole="button"
            onPress={() => onSelectCurrency(nextCurrency)}
            style={({ pressed }) => [
              styles.currencyBadge,
              {
                backgroundColor: theme.bgElevated,
                borderColor: theme.borderElevated,
                opacity: pressed ? 0.7 : 1
              }
            ]}
          >
            <Text style={[styles.currencyText, { color: theme.textPrimary }]}>
              {currentCurrency}
            </Text>
          </Pressable>
        )}

        <Pressable
          accessibilityLabel="Alternar tema de cor"
          accessibilityRole="button"
          onPress={handleToggle}
          style={({ pressed }) => [
            styles.iconButton,
            {
              backgroundColor: theme.bgElevated,
              borderColor: theme.borderElevated,
              opacity: pressed ? 0.7 : 1
            }
          ]}
        >
          {isDark ? (
            <Sun color="#F59E0B" size={18} />
          ) : (
            <Moon color={theme.textPrimary} size={18} />
          )}
        </Pressable>

        {rightContent}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10
  },
  compactContainer: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  compactTitle: {
    fontSize: 18
  },
  container: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: 24,
    paddingVertical: 12,
    zIndex: 10
  },
  currencyBadge: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  currencyText: {
    fontSize: 13,
    fontWeight: '700'
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3
  },
  titleArea: {
    minWidth: 0,
    flexShrink: 1,
    flex: 1,
    marginRight: 12
  }
});
