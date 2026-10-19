import React, { useState } from 'react';
import {
  KeyboardTypeOptions,
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
  accessibilityLabel
}: InputProps): React.JSX.Element {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          {label}
        </Text>
      )}
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
            backgroundColor: theme.bgElevated,
            borderColor: error
              ? theme.expense
              : isFocused
                ? theme.income
                : theme.borderElevated,
            color: theme.textPrimary
          },
          style
        ]}
        testID={testID}
        value={value}
      />
      {error && (
        <Text style={[styles.errorText, { color: theme.expense }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    width: '100%'
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500'
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  label: {
    fontSize: 13,
    fontWeight: '600'
  }
});
