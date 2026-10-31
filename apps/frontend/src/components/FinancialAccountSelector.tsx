import { ChoiceButton } from './ui';
import React from 'react';
import { Text, View } from 'react-native';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useTheme } from '../theme/ThemeContext';

export const FINANCIAL_ACCOUNTS_QUERY = gql`query FinancialAccounts { myFinancialAccounts { id name type accountNumber additionalData initialBalance balance isDefault archived } }`;
export type FinancialAccountItem = { id: string; name: string; type: string; accountNumber: string | null; additionalData: string | null; initialBalance: string; balance: string; isDefault: boolean; archived: boolean };
export function FinancialAccountSelector({ value, onChange, multiple = false }: { value: string[]; onChange: (ids: string[]) => void; multiple?: boolean }) {
  const { theme } = useTheme();
  const { data, error } = useQuery<{ myFinancialAccounts: FinancialAccountItem[] }>(FINANCIAL_ACCOUNTS_QUERY);
  const items = data?.myFinancialAccounts?.filter(a => !a.archived) ?? [];
  const effective = value.length ? value : multiple ? [] : items.filter(a => a.isDefault).map(a => a.id);
  return <View style={{ gap: 8 }}>
    <Text style={{ color: theme.textSecondary }}>{multiple ? 'Filtrar contas' : 'Conta financeira'}</Text>
    {error && <Text accessibilityRole="alert" style={{ color: theme.expense }}>Não foi possível carregar contas.</Text>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {(multiple ? [{ id: '', name: 'Todas' }, ...items] : items).map(a => {
        const selected = a.id ? effective.includes(a.id) : !value.length;
        return <ChoiceButton key={a.id} title={a.name} selected={selected} onPress={() => onChange(!a.id ? [] : multiple ? value.includes(a.id) ? value.filter(id => id !== a.id) : [...value, a.id] : [a.id])} />;
      })}
    </View>
  </View>;
}
