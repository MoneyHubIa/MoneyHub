import { useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

type Props = TextInputProps & { moneyDigits?: number | undefined; signed?: boolean; integerOnly?: boolean };

/** Reject invalid numeric edits without changing the amount entered by the user. */
export function ValidatedInput({ moneyDigits, signed = false, integerOnly = false, onChangeText, ...props }: Props) {
  const [error, setError] = useState(false);
  const numeric = moneyDigits !== undefined || integerOnly;
  const pattern = integerOnly ? /^\d{0,4}$/ : new RegExp(`^${signed ? '-?' : ''}\\d{0,${moneyDigits ?? 10}}(?:[.,]\\d{0,2})?$`);
  if (!numeric) return <TextInput {...props} onChangeText={onChangeText} />;
  return <View>
    <TextInput {...props} keyboardType={integerOnly ? 'number-pad' : numeric ? 'decimal-pad' : props.keyboardType} onChangeText={text => {
      if (numeric && !pattern.test(text)) { setError(true); return; }
      setError(false); onChangeText?.(text);
    }} />
    {error && <Text accessibilityRole="alert" style={{ color: '#b91c1c' }}>{integerOnly ? 'Informe somente dígitos, até 4 caracteres.' : `Use até ${moneyDigits} dígitos e duas casas decimais, com vírgula ou ponto, sem separador de milhar.`}</Text>}
  </View>;
}
