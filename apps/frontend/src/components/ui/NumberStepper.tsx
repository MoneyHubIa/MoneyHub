import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { ValidatedInput } from './ValidatedInput';

export function NumberStepper({ label, value, onChange, disabled = false, max = 1200 }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  max?: number;
}) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const number = Number(value);
  const step = (delta: number) => onChange(String(value === '' ? 1 : Math.min(max, Math.max(1, number + delta))));

  return <View style={styles.field}>
    <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
    <View style={[styles.box, { backgroundColor: theme.bgElevated, borderColor: focused ? theme.income : theme.borderElevated, opacity: disabled ? 0.5 : 1 }]}>
      <View style={styles.inputContainer}>
        <ValidatedInput
          integerOnly
          accessibilityLabel={label}
          accessibilityHint={`Informe um número inteiro de 1 a ${max} ou use as setas para ajustar.`}
          editable={!disabled}
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, { color: theme.textPrimary }]}
        />
      </View>
      <View style={{ borderLeftWidth: 1, borderColor: theme.borderElevated }}>
        {([1, -1] as const).map(delta => {
          const unavailable = disabled || (value !== '' && (delta === 1 ? number >= max : number <= 1));
          const Icon = delta === 1 ? ChevronUp : ChevronDown;
          return <Pressable
            key={delta}
            accessibilityRole="button"
            accessibilityLabel={`${delta === 1 ? 'Aumentar' : 'Diminuir'} ${label.toLowerCase()}`}
            accessibilityState={{ disabled: unavailable }}
            disabled={unavailable}
            onPress={() => step(delta)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={({ pressed }) => [styles.stepButton, {
              borderColor: theme.borderElevated,
              borderTopWidth: delta === -1 ? 1 : 0,
              opacity: unavailable ? 0.4 : pressed ? 0.65 : 1
            }]}
          >
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Icon color={theme.textSecondary} size={14} />
            </View>
          </Pressable>;
        })}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  field: { width: '100%', minWidth: 0, alignSelf: 'flex-start', gap: 4 },
  label: { fontSize: 13, fontWeight: '600' },
  box: { width: Platform.OS === 'web' ? 96 : 112, maxWidth: '100%', flexDirection: 'row', borderWidth: 1, borderRadius: 8 },
  inputContainer: { flex: 1, minWidth: 0, justifyContent: 'center' },
  input: { minHeight: Platform.OS === 'web' ? 30 : 44, paddingHorizontal: 6, paddingVertical: Platform.OS === 'web' ? 2 : 6, fontSize: Platform.OS === 'web' ? 14 : 16 },
  stepButton: { width: Platform.OS === 'web' ? 24 : 48, minHeight: Platform.OS === 'web' ? 15 : 48, alignItems: 'center', justifyContent: 'center' }
});
