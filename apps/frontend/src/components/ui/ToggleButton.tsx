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
}

export function ToggleButton({ label, value, onChange, disabled = false, accessibilityLabel, activeText = 'Sim', inactiveText = 'Não' }: ToggleButtonProps) {
  const { theme } = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
    <ChoiceButton title={value ? activeText : inactiveText} selected={value} role="switch" accessibilityLabel={accessibilityLabel ?? label} disabled={disabled} onPress={() => onChange(!value)} />
    <Text style={{ flex: 1, minWidth: 120, color: theme.textPrimary, fontSize: 14 }}>{label}</Text>
  </View>;
}
