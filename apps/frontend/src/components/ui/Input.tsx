import { XCircle } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  KeyboardTypeOptions,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export interface InputProps {
  label?: string | undefined;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string | undefined;
  error?: string | null | undefined;
  secureTextEntry?: boolean | undefined;
  keyboardType?: KeyboardTypeOptions | undefined;
  autoCapitalize?: ('none' | 'sentences' | 'words' | 'characters') | undefined;
  style?: StyleProp<TextStyle> | undefined;
  containerStyle?: StyleProp<ViewStyle> | undefined;
  testID?: string | undefined;
  accessibilityLabel?: string | undefined;
  clearable?: boolean | undefined;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  style,
  containerStyle,
  testID,
  accessibilityLabel,
  clearable = true
}: InputProps): React.JSX.Element {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const showClear = clearable && !secureTextEntry && value.length > 0;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: theme.bgElevated,
            borderColor: error
              ? theme.expense
              : isFocused
                ? theme.income
                : theme.borderElevated,
            borderWidth: isFocused || error ? 1.5 : 1
          }
        ]}
      >
        <TextInput
          accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          onBlur={() => setIsFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          secureTextEntry={secureTextEntry}
          style={[
            styles.input,
            {
              color: theme.textPrimary
            },
            style
          ]}
          testID={testID}
          value={value}
        />
        {showClear && (
          <Pressable
            accessibilityLabel="Limpar texto"
            accessibilityRole="button"
            hitSlop={6}
            onPress={() => onChangeText('')}
            style={styles.clearButton}
          >
            <XCircle color={theme.textMuted} size={18} />
          </Pressable>
        )}
      </View>
      {error && (
        <Text style={[styles.errorText, { color: theme.expense }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  clearButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    minHeight: 24,
    minWidth: 24
  },
  container: {
    gap: 6,
    width: '100%'
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500'
  },
  input: {
    flex: 1,
    fontSize: 15,
    minHeight: 48,
    paddingVertical: 12
  },
  inputWrapper: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    minHeight: 48,
    paddingHorizontal: 14
  },
  label: {
    fontSize: 13,
    fontWeight: '600'
  }
});
