import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export interface ChoiceButtonProps {
  title: string;
  selected: boolean;
  onPress(): void;
  disabled?: boolean;
  accessibilityLabel?: string;
  role?: 'button' | 'switch';
}

export function ChoiceButton({ title, selected, onPress, disabled = false, accessibilityLabel, role = 'button' }: ChoiceButtonProps) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  return <Pressable
    accessibilityLabel={accessibilityLabel ?? title}
    accessibilityRole={role}
    accessibilityState={role === 'switch' ? { checked: selected, disabled } : { selected, disabled }}
    aria-checked={role === 'switch' ? selected : undefined}
    aria-selected={role === 'button' ? selected : undefined}
    aria-disabled={disabled}
    disabled={disabled}
    onPress={onPress}
    onFocus={() => setFocused(true)}
    onBlur={() => setFocused(false)}
    style={({ pressed }) => [styles.button, {
      backgroundColor: selected ? theme.incomeBadge : theme.bgElevated,
      borderColor: focused ? theme.textPrimary : selected ? theme.income : theme.borderElevated,
      opacity: disabled ? 0.5 : pressed ? 0.75 : 1
    }]}
  >
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ opacity: selected ? 1 : 0 }}>
      <Check size={16} color={theme.textPrimary} />
    </View>
    <Text style={[styles.text, { color: theme.textPrimary }]}>{title}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 48, minWidth: 72, maxWidth: '100%', borderWidth: 2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  text: { fontSize: 14, fontWeight: '600', flexShrink: 1 }
});
