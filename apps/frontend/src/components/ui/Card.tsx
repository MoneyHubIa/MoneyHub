import React from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'surface' | 'elevated' | 'gradient' | undefined;
  style?: StyleProp<ViewStyle> | undefined;
  onPress?: (() => void) | undefined;
  testID?: string | undefined;
  accessibilityLabel?: string | undefined;
}

export function Card({
  children,
  variant = 'surface',
  style,
  onPress,
  testID,
  accessibilityLabel
}: CardProps): React.JSX.Element {
  const { theme, isDark } = useTheme();

  const baseStyle: ViewStyle = {
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor:
      variant === 'elevated'
        ? theme.bgElevated
        : variant === 'gradient'
          ? (isDark ? '#064E3B' : '#059669')
          : theme.bgSurface,
    borderColor:
      variant === 'elevated'
        ? theme.borderElevated
        : variant === 'gradient'
          ? (isDark ? 'rgba(16, 185, 129, 0.3)' : '#0D9488')
          : theme.border,
    ...(variant === 'gradient'
      ? { experimental_backgroundImage: isDark ? 'linear-gradient(135deg, #064E3B 0%, #0F2F29 100%)' : 'linear-gradient(135deg, #059669 0%, #0F766E 100%)' }
      : {}),
    ...(Platform.OS === 'ios' || Platform.OS === 'web'
      ? {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.25 : 0.05,
          shadowRadius: 8
        }
      : { elevation: 2 })
  };

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          baseStyle,
          pressed && styles.pressed,
          pressed && { transform: [{ scale: 0.985 }] },
          style
        ]}
        testID={testID}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[baseStyle, style]}
      testID={testID}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.88
  }
});
