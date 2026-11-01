import { LucideIcon } from 'lucide-react-native';
import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export type BadgeTone = 'income' | 'expense' | 'warning' | 'brandAI' | 'info' | 'neutral';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone | undefined;
  icon?: LucideIcon | undefined;
  style?: StyleProp<ViewStyle> | undefined;
  textStyle?: StyleProp<TextStyle> | undefined;
}

export function Badge({
  label,
  tone = 'neutral',
  icon: Icon,
  style,
  textStyle
}: BadgeProps): React.JSX.Element {
  const { theme } = useTheme();

  let bgColor = theme.bgElevated;
  let textColor = theme.textSecondary;

  switch (tone) {
    case 'income':
      bgColor = theme.incomeBadge;
      textColor = theme.income;
      break;
    case 'expense':
      bgColor = theme.expenseBadge;
      textColor = theme.expense;
      break;
    case 'warning':
      bgColor = theme.warningBadge;
      textColor = theme.warning;
      break;
    case 'brandAI':
      bgColor = theme.brandAIBadge;
      textColor = theme.brandAI;
      break;
    case 'info':
      bgColor = theme.infoBadge;
      textColor = theme.info;
      break;
    case 'neutral':
    default:
      bgColor = theme.bgElevated;
      textColor = theme.textSecondary;
      break;
  }

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }, style]}>
      {Icon && <Icon color={textColor} size={13} style={styles.icon} />}
      <Text style={[styles.text, { color: textColor }, textStyle]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: 9999,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  icon: {
    marginRight: 1
  },
  text: {
    minWidth: 0,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600'
  }
});
