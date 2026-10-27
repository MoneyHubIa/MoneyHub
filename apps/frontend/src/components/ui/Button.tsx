import { LucideIcon } from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title?: string | undefined;
  onPress: () => void;
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  icon?: LucideIcon | undefined;
  iconPosition?: ('left' | 'right') | undefined;
  loading?: boolean | undefined;
  disabled?: boolean | undefined;
  children?: React.ReactNode | undefined;
  style?: StyleProp<ViewStyle> | undefined;
  textStyle?: StyleProp<TextStyle> | undefined;
  accessibilityLabel?: string | undefined;
  testID?: string | undefined;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  children,
  style,
  textStyle,
  accessibilityLabel,
  testID
}: ButtonProps): React.JSX.Element {
  const { theme, isDark } = useTheme();

  const isInteractive = !disabled && !loading;

  let backgroundColor = isDark ? '#059669' : theme.income;
  let textColor = '#FFFFFF';
  let borderColor = 'transparent';
  let borderWidth = 0;

  switch (variant) {
    case 'primary':
      backgroundColor = isDark ? '#059669' : theme.income;
      textColor = '#FFFFFF';
      break;
    case 'secondary':
      backgroundColor = theme.bgElevated;
      textColor = theme.textPrimary;
      borderColor = theme.borderElevated;
      borderWidth = StyleSheet.hairlineWidth;
      break;
    case 'danger':
      backgroundColor = isDark ? '#E11D48' : theme.expense;
      textColor = '#FFFFFF';
      break;
    case 'outline':
      backgroundColor = 'transparent';
      textColor = theme.textPrimary;
      borderColor = theme.border;
      borderWidth = StyleSheet.hairlineWidth;
      break;
    case 'ghost':
      backgroundColor = 'transparent';
      textColor = theme.textSecondary;
      break;
  }

  const height = size === 'sm' ? 36 : size === 'lg' ? 52 : 44;
  const paddingHorizontal = size === 'sm' ? 12 : size === 'lg' ? 20 : 16;
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 16 : 14;
  const hitSlop = size === 'sm' ? { top: 8, bottom: 8, left: 8, right: 8 } : undefined;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      disabled={!isInteractive}
      hitSlop={hitSlop}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor,
          borderColor,
          borderWidth,
          minHeight: height,
          paddingHorizontal,
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
          transform: [{ scale: isInteractive && pressed ? 0.98 : 1.0 }]
        },
        style
      ]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator
          color={textColor}
          size="small"
          testID="button-loading"
        />
      ) : (
        <>
          {Icon && iconPosition === 'left' && (
            <Icon color={textColor} size={size === 'sm' ? 15 : 18} />
          )}
          {title ? (
            <Text
              style={[
                styles.text,
                { color: textColor, fontSize },
                textStyle
              ]}
            >
              {title}
            </Text>
          ) : (
            children
          )}
          {Icon && iconPosition === 'right' && (
            <Icon color={textColor} size={size === 'sm' ? 15 : 18} />
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center'
  },
  text: {
    fontWeight: '600'
  }
});
