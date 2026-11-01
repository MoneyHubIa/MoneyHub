import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import React, { useId, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
}

export function Select({ label, value, options, onChange, placeholder = 'Selecione uma opção', disabled = false, compact = false }: SelectProps) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const valueId = useId();
  const selected = options.find(option => option.value === value);
  const unavailable = disabled || options.length === 0;
  const expanded = open && !unavailable;
  const Chevron = expanded ? ChevronUp : ChevronDown;

  return <View style={styles.container}>
    <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={{ text: selected?.label ?? placeholder }}
      accessibilityState={{ expanded, disabled: unavailable }}
      aria-expanded={expanded}
      aria-describedby={valueId}
      disabled={unavailable}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={() => setOpen(previous => !previous)}
      style={({ pressed }) => [styles.box, compact && styles.compactBox, {
        backgroundColor: theme.bgElevated,
        borderColor: focused || expanded ? theme.income : theme.borderElevated,
        opacity: unavailable ? 0.5 : pressed ? 0.75 : 1
      }]}
    >
      <Text nativeID={valueId} style={[styles.text, compact && styles.compactText, { color: selected ? theme.textPrimary : theme.textSecondary }]}>{selected?.label ?? placeholder}</Text>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Chevron color={theme.textSecondary} size={compact ? 14 : 18} />
      </View>
    </Pressable>
    {expanded && <ScrollView
      accessibilityLabel={`Opções de ${label}`}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      style={[styles.options, { backgroundColor: theme.bgElevated, borderColor: theme.borderElevated }]}
    >
      {options.map(option => {
        const isSelected = option.value === value;
        return <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: isSelected }}
          aria-selected={isSelected}
          onPress={() => { setOpen(false); onChange(option.value); }}
          style={({ pressed }) => [styles.option, { backgroundColor: isSelected ? theme.incomeBadge : theme.bgElevated, opacity: pressed ? 0.75 : 1 }]}
        >
          <Text style={[styles.text, { color: theme.textPrimary }]}>{option.label}</Text>
          {isSelected && <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Check color={theme.income} size={18} />
          </View>}
        </Pressable>;
      })}
    </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({
  container: { width: '100%', minWidth: 0, gap: 6 },
  label: { fontSize: 13, fontWeight: '600' },
  box: { minHeight: 48, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  compactBox: { minHeight: Platform.OS === 'web' ? 28 : 48, paddingHorizontal: 6, paddingVertical: 3, gap: 4 },
  compactText: { fontSize: 13, lineHeight: 18 },
  text: { fontSize: 14, lineHeight: 20, flex: 1, minWidth: 0 },
  options: { maxHeight: 240, borderRadius: 8, borderWidth: 1 },
  option: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }
});
