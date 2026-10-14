import React from 'react';
import {
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
  const { theme } = useTheme();

  const baseStyle: ViewStyle = {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    backgroundColor:
      variant === 'elevated'
        ? theme.bgElevated
        : variant === 'gradient'
          ? '#059669'
          : theme.bgSurface,
    borderColor:
      variant === 'elevated'
        ? theme.borderElevated
        : variant === 'gradient'
          ? '#0D9488'
          : theme.border
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
    opacity: 0.85
  }
});
