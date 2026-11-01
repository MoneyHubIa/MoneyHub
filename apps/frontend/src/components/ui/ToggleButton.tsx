import { Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { ChoiceButton } from './ChoiceButton';

export interface ToggleButtonProps {
  label: string;
  value: boolean;
  onChange(value: boolean): void;
  disabled?: boolean;
  accessibilityLabel?: string;
  activeText?: string;
  inactiveText?: string;
  compact?: boolean;
  singleLineLabel?: boolean;
}

export function ToggleButton({ label, value, onChange, disabled = false, accessibilityLabel, activeText = 'Sim', inactiveText = 'Não', compact = false, singleLineLabel = false }: ToggleButtonProps) {
  const { theme } = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: compact && !singleLineLabel ? 'nowrap' : 'wrap', alignItems: 'center', gap: compact ? 8 : 12 }}>
    <ChoiceButton compact={compact} title={value ? activeText : inactiveText} selected={value} role="switch" accessibilityLabel={accessibilityLabel ?? label} disabled={disabled} onPress={() => onChange(!value)} />
    <Text numberOfLines={singleLineLabel ? 1 : undefined} style={{ flex: singleLineLabel ? undefined : 1, flexShrink: singleLineLabel ? 0 : 1, maxWidth: '100%', minWidth: compact ? 0 : 120, color: theme.textPrimary, fontSize: 14 }}>{label}</Text>
  </View>;
}
