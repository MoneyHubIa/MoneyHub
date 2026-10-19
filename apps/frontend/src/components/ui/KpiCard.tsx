import { Eye, EyeOff, LucideIcon } from 'lucide-react-native';
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
import { Card } from './Card';

export interface KpiCardProps {
  title: string;
  value: string;
  subtext?: string | undefined;
  tone?: ('neutral' | 'income' | 'expense' | 'warning' | 'brandAI') | undefined;
  icon?: LucideIcon | undefined;
  onPressEye?: (() => void) | undefined;
  isMasked?: boolean | undefined;
  footer?: React.ReactNode | undefined;
  variant?: ('standard' | 'gradient') | undefined;
  style?: StyleProp<ViewStyle> | undefined;
  testID?: string | undefined;
}

export function KpiCard({
  title,
  value,
  subtext,
  tone = 'neutral',
  icon: Icon,
  onPressEye,
  isMasked = false,
  footer,
  variant = 'standard',
  style,
  testID
}: KpiCardProps): React.JSX.Element {
  const { theme } = useTheme();

  let valueColor = theme.textPrimary;
  if (variant === 'gradient') {
    valueColor = '#FFFFFF';
  } else {
    switch (tone) {
      case 'income':
        valueColor = theme.income;
        break;
      case 'expense':
        valueColor = theme.expense;
        break;
      case 'warning':
        valueColor = theme.warning;
        break;
      case 'brandAI':
        valueColor = theme.brandAI;
        break;
      default:
        valueColor = theme.textPrimary;
    }
  }

  const isGradient = variant === 'gradient';
  const displayValue = isMasked ? 'R$ ••••••' : value;

  return (
    <Card
      style={[
        styles.card,
        isGradient && styles.gradientCard,
        style
      ]}
      testID={testID}
      variant={isGradient ? 'gradient' : 'surface'}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {Icon && (
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: isGradient
                    ? 'rgba(255, 255, 255, 0.2)'
                    : theme.bgElevated
                }
              ]}
            >
              <Icon
                color={isGradient ? '#FFFFFF' : theme.textSecondary}
                size={16}
              />
            </View>
          )}
          <Text
            style={[
              styles.title,
              { color: isGradient ? '#E6FFFA' : theme.textSecondary }
            ]}
          >
            {title}
          </Text>
        </View>

        {onPressEye && (
          <Pressable
            accessibilityLabel={isMasked ? 'Exibir valores' : 'Ocultar valores'}
            accessibilityRole="button"
            onPress={onPressEye}
            style={styles.eyeButton}
          >
            {isMasked ? (
              <EyeOff
                color={isGradient ? '#FFFFFF' : theme.textSecondary}
                size={18}
              />
            ) : (
              <Eye
                color={isGradient ? '#FFFFFF' : theme.textSecondary}
                size={18}
              />
            )}
          </Pressable>
        )}
      </View>

      <Text
        style={[styles.value, { color: valueColor }]}
      >
        {displayValue}
      </Text>

      {subtext && (
        <Text
          style={[
            styles.subtext,
            { color: isGradient ? '#CCFBF1' : theme.textMuted }
          ]}
        >
          {subtext}
        </Text>
      )}

      {footer && <View style={styles.footerContainer}>{footer}</View>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: 220,
    flexGrow: 1,
    gap: 8,
    minHeight: 116
  },
  eyeButton: {
    padding: 4
  },
  footerContainer: {
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 8
  },
  gradientCard: {
    backgroundColor: '#0F766E',
    borderColor: '#14B8A6'
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    width: 28
  },
  subtext: {
    fontSize: 12,
    fontWeight: '500'
  },
  title: {
    fontSize: 13,
    fontWeight: '600'
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  value: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5
  }
});
