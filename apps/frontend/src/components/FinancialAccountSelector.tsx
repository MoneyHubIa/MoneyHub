import { Select } from './ui';
import React from 'react';
import { Text, View } from 'react-native';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useTheme } from '../theme/ThemeContext';

export const FINANCIAL_ACCOUNTS_QUERY = gql`query FinancialAccounts { myFinancialAccounts { id name type accountNumber additionalData initialBalance balance isDefault archived } }`;
export type FinancialAccountItem = { id: string; name: string; type: string; accountNumber: string | null; additionalData: string | null; initialBalance: string; balance: string; isDefault: boolean; archived: boolean };
export function FinancialAccountSelector({ value, onChange, multiple = false, label = 'Conta financeira', disabled = false }: { value: string[]; onChange: (ids: string[]) => void; multiple?: boolean; label?: string; disabled?: boolean }) {
  const { theme } = useTheme();
  const { data, error } = useQuery<{ myFinancialAccounts: FinancialAccountItem[] }>(FINANCIAL_ACCOUNTS_QUERY);
  const items = data?.myFinancialAccounts?.filter(a => !a.archived) ?? [];
  const effective = value.length ? value : multiple ? [] : items.filter(a => a.isDefault).map(a => a.id);
  return <View style={{ gap: 8 }}>
    {error && <Text accessibilityRole="alert" style={{ color: theme.expense }}>Não foi possível carregar contas.</Text>}
    {multiple ? <Select
      multiple
      label="Filtrar contas"
      value={effective}
      onChange={onChange}
      disabled={disabled}
      options={items.map(a => ({ value: a.id, label: a.name }))}
      allLabel="Todas"
    /> : <Select label={label} value={effective[0] ?? ''} onChange={id => onChange([id])} disabled={disabled} options={items.map(a => ({ value: a.id, label: a.name }))} placeholder={items.length ? 'Selecione uma conta' : 'Nenhuma conta disponível'} />}
  </View>;
}
