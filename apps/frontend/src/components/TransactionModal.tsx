import { decimal, validText } from '../utils/validation';
import { ValidatedInput as TextInput } from './ui/ValidatedInput';
import { FinancialAccountSelector } from './FinancialAccountSelector';
import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { ArrowDownCircle, ArrowUpCircle, Plus, Tag } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { formatISOToRegionalDate, parseRegionalDateToISO, SupportedCurrency } from '../utils/formatters';
import { DatePickerInput } from './DatePickerInput';
import { ThemedModal } from './ui/ThemedModal';

import { CREATE_INCOME, CREATE_EXPENSE } from '../services/financial-mutations';
export { CREATE_INCOME, CREATE_EXPENSE } from '../services/financial-mutations';

export const TRANSACTION_MODAL_CONTEXT_QUERY = gql`
  query TransactionModalContext {
    myCategories {
      id
      name
      type
      color
    }
    myProfile {
      id
      preferredCurrency
    }
  }
`;

export type CategoryItem = {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE' | 'BOTH';
  color: string;
};

export type TransactionModalContextData = {
  myCategories?: CategoryItem[];
  myProfile?: {
    id: string;
    preferredCurrency: string;
  };
};

export interface TransactionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (() => void) | undefined;
  initialType?: ('INCOME' | 'EXPENSE') | undefined;
  categories?: CategoryItem[] | undefined;
  preferredCurrency?: string | undefined;
}

export function TransactionModal({
  visible,
  onClose,
  onSuccess,
  initialType = 'EXPENSE',
  categories: propCategories,
  preferredCurrency: propCurrency
}: TransactionModalProps): React.JSX.Element {
  const { theme } = useTheme();

  const [type, setType] = useState<'INCOME' | 'EXPENSE'>(initialType);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [financialAccountIds, setFinancialAccountIds] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [occurredAtDate, setOccurredAtDate] = useState(() => {
    const today = new Date();
    return formatISOToRegionalDate(today.toISOString().split('T')[0] ?? '', 'BRL');
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: contextData, loading: loadingContext, error: contextError, refetch: refetchContext } = useQuery<TransactionModalContextData>(
    TRANSACTION_MODAL_CONTEXT_QUERY,
    {
      skip: !visible || Boolean(propCategories && propCurrency),
      fetchPolicy: 'network-only'
    }
  );

  const categories = propCategories ?? contextData?.myCategories ?? [];
  const currencyString = propCurrency ?? contextData?.myProfile?.preferredCurrency ?? 'BRL';
  const currency: SupportedCurrency =
    currencyString === 'USD' || currencyString === 'EUR' ? currencyString : 'BRL';

  useEffect(() => {
    if (visible) {
      setType(initialType);
      setDescription('');
      setAmount('');
      setCategoryId('');
      setErrorMessage(null);
      const today = new Date();
      setOccurredAtDate(
        formatISOToRegionalDate(today.toISOString().split('T')[0] ?? '', currency)
      );
    }
  }, [visible, initialType, currency]);

  const [createIncome, { loading: creatingIncome }] = useMutation(CREATE_INCOME, {
    refetchQueries: ['FinancialAccounts', 'DashboardSummary', 'MyTransactions'],
    onCompleted: () => {
      onSuccess?.();
      onClose();
    },
    onError: (err: Error) => setErrorMessage(err.message)
  });

  const [createExpense, { loading: creatingExpense }] = useMutation(CREATE_EXPENSE, {
    refetchQueries: ['FinancialAccounts', 'DashboardSummary', 'MyTransactions'],
    onCompleted: () => {
      onSuccess?.();
      onClose();
    },
    onError: (err: Error) => setErrorMessage(err.message)
  });

  const isSubmitting = creatingIncome || creatingExpense;

  const formValid = validText(description, 120) && !!decimal(amount) && !!categoryId && !!parseRegionalDateToISO(occurredAtDate, currency);
  const handleSave = async () => {
    if (!formValid) return;
    if (!validText(description, 120)) {
      setErrorMessage('Informe a descrição.');
      return;
    }
    if (!decimal(amount)) {
      setErrorMessage('Informe um valor válido.');
      return;
    }
    if (!categoryId) {
      setErrorMessage('Selecione uma categoria.');
      return;
    }

    const isoDate = parseRegionalDateToISO(occurredAtDate, currency);
    const parsedDate = isoDate ? new Date(`${isoDate}T12:00:00Z`) : null;
    if (!parsedDate || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== isoDate) {
      setErrorMessage('Informe uma data válida.');
      return;
    }
    const finalIso = parsedDate.toISOString();

    const variables = {
      input: {
        description: description.trim(),
        amount: decimal(amount)!,
        financialAccountId: financialAccountIds[0],
        categoryId,
        occurredAt: finalIso
      }
    };

    if (type === 'INCOME') {
      await createIncome({ variables });
    } else {
      await createExpense({ variables });
    }
  };

  const availableCategories = categories.filter(
    (c) => c.type === type || c.type === 'BOTH'
  );

  return (
    <ThemedModal
      maxWidth={480}
      onClose={onClose}
      subtitle="Cadastre uma entrada ou saída no seu fluxo financeiro"
      title={type === 'INCOME' ? 'Nova Receita' : 'Nova Despesa'}
      visible={visible}
    >
      <View style={styles.form}>
        {loadingContext && <ActivityIndicator accessibilityLabel="Atualizando categorias" color={theme.textSecondary} />}
        {contextError && (
          <View style={[styles.errorBox, { backgroundColor: theme.expenseBadge }]}>
            <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.errorText, { color: theme.expense }]}>
              Não foi possível atualizar as categorias. Tente novamente.
            </Text>
            <Pressable
              accessibilityLabel="Tentar atualizar categorias novamente"
              accessibilityRole="button"
              onPress={() => { void refetchContext().catch(() => undefined); }}
              style={styles.cancelButton}
            >
              <Text style={[styles.cancelButtonText, { color: theme.textPrimary }]}>Tentar novamente</Text>
            </Pressable>
          </View>
        )}
        {errorMessage && (
          <View style={[styles.errorBox, { backgroundColor: theme.expenseBadge }]}>
            <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.errorText, { color: theme.expense }]}>
              {errorMessage}
            </Text>
          </View>
        )}

        {/* Tipo: Despesa ou Receita */}
        <View style={styles.typeSelector}>
          <Pressable
            accessibilityLabel="Despesa"
            accessibilityRole="button"
            onPress={() => {
              setType('EXPENSE');
              setCategoryId('');
            }}
            style={[
              styles.typeOption,
              {
                backgroundColor: type === 'EXPENSE' ? theme.expenseBadge : theme.bgElevated,
                borderColor: type === 'EXPENSE' ? theme.expense : theme.borderElevated
              }
            ]}
          >
            <ArrowDownCircle
              color={type === 'EXPENSE' ? theme.expense : theme.textSecondary}
              size={18}
            />
            <Text
              style={[
                styles.typeOptionText,
                { color: type === 'EXPENSE' ? theme.expense : theme.textSecondary }
              ]}
            >
              Despesa
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Receita"
            accessibilityRole="button"
            onPress={() => {
              setType('INCOME');
              setCategoryId('');
            }}
            style={[
              styles.typeOption,
              {
                backgroundColor: type === 'INCOME' ? theme.incomeBadge : theme.bgElevated,
                borderColor: type === 'INCOME' ? theme.income : theme.borderElevated
              }
            ]}
          >
            <ArrowUpCircle
              color={type === 'INCOME' ? theme.income : theme.textSecondary}
              size={18}
            />
            <Text
              style={[
                styles.typeOptionText,
                { color: type === 'INCOME' ? theme.income : theme.textSecondary }
              ]}
            >
              Receita
            </Text>
          </Pressable>
        </View>

        {/* Descrição */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Descrição</Text>
          <TextInput
            maxLength={120} accessibilityLabel="Descrição da transação"
            onChangeText={(t) => {
              setDescription(t);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="Ex: Supermercado"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: theme.bgElevated,
                borderColor: theme.borderElevated,
                color: theme.textPrimary
              }
            ]}
            value={description}
          />
        </View>

        {/* Valor */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Valor ({currency})
          </Text>
          <TextInput
            accessibilityLabel="Valor da transação"
            moneyDigits={10}
            onChangeText={(t) => {
              setAmount(t);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="Ex: 150.00"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: theme.bgElevated,
                borderColor: theme.borderElevated,
                color: theme.textPrimary
              }
            ]}
            value={amount}
          />
        </View>

        {/* Data */}
        <DatePickerInput
          currency={currency}
          label="Data da Ocorrência"
          onChangeText={(value) => {
            setOccurredAtDate(value);
            setErrorMessage(null);
          }}
          value={occurredAtDate}
        />
        <FinancialAccountSelector value={financialAccountIds} onChange={setFinancialAccountIds} />

        {/* Categorias */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Categoria</Text>
          <View style={styles.catGrid}>
            {availableCategories.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Crie categorias primeiro.
              </Text>
            ) : (
              availableCategories.map((c) => {
                const isSelected = categoryId === c.id;
                return (
                  <Pressable
                    accessibilityLabel={c.name}
                    accessibilityRole="button"
                    key={c.id}
                    onPress={() => {
                      setCategoryId(c.id);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    style={[
                      styles.catOption,
                      {
                        backgroundColor: isSelected ? c.color : theme.bgElevated,
                        borderColor: c.color
                      }
                    ]}
                  >
                    <Tag
                      color={isSelected ? '#FFFFFF' : c.color}
                      size={13}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={{
                        color: isSelected ? '#FFFFFF' : c.color,
                        fontSize: 13,
                        fontWeight: '600'
                      }}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
        </View>

        {/* Ações do Rodapé */}
        <View style={styles.actionsRow}>
          <Pressable
            accessibilityLabel="Cancelar"
            accessibilityRole="button"
            onPress={onClose}
            style={[
              styles.cancelButton,
              { backgroundColor: theme.bgElevated, borderColor: theme.borderElevated }
            ]}
          >
            <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>
              Cancelar
            </Text>
          </Pressable>

          {!formValid && <Text style={[styles.helperText, { color: theme.textSecondary }]}>Preencha descrição, valor positivo, categoria e data válida.</Text>}
          <Pressable
            accessibilityLabel="Adicionar transação"
            accessibilityRole="button"
            disabled={isSubmitting || !formValid}
            onPress={handleSave}
            style={[
              styles.submitButton,
              {
                backgroundColor: type === 'INCOME' ? theme.income : theme.expense,
                opacity: (isSubmitting || !formValid) ? 0.7 : 1
              }
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Plus color="#FFFFFF" size={18} />
                <Text style={styles.submitButtonText}>Adicionar transação</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </ThemedModal>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: 12,
    marginTop: 8
  },
  cancelButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600'
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  catOption: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 4
  },
  errorBox: {
    borderRadius: 8,
    padding: 10
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600'
  },
  form: {
    gap: 16
  },
  formGroup: {
    gap: 6
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 12
  },
  label: {
    fontSize: 13,
    fontWeight: '600'
  },
  helperText: {
    fontSize: 13
  },
  submitButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 2,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16
  },
  submitButtonText: {
    minWidth: 0,
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  typeOption: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 10
  },
  typeOptionText: {
    minWidth: 0,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700'
  },
  typeSelector: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: 10
  }
});
