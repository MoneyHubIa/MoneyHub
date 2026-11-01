import { CREATE_INCOME, CREATE_EXPENSE } from '../services/financial-mutations';
import { Button, Select, ToggleButton } from './ui';
import { validSchedule, scheduleInput } from './CommitmentSchedule';
import { decimal, validText } from '../utils/validation';
import { ValidatedInput as TextInput } from './ui/ValidatedInput';
import { randomUUID } from 'expo-crypto';
import { CommitmentSchedule, defaultSchedule } from './CommitmentSchedule';
import { FinancialAccountSelector } from './FinancialAccountSelector';
import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  WalletCards
} from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useResponsive } from '../theme/useResponsive';
import {
  formatCurrency,
  formatDate,
  formatISOToRegionalDate,
  parseRegionalDateToISO,
  type SupportedCurrency
} from '../utils/formatters';
import { DatePickerInput } from './DatePickerInput';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { ThemedModal } from './ui/ThemedModal';

export const MY_ACCOUNTS_PAYABLE_QUERY = gql`
  query MyAccountsPayable($status: AccountPayableStatus) {
    myAccountsPayable(status: $status) {
      id
      categoryId
      financialAccountId
      seriesId
      installmentNumber
      installmentTotal
      costCenterId
      description
      amount
      dueDate
      status
      paidAt
      reminderOffsetDays
      createdAt
    }
    myCategories {
      id
      name
      type
      color
    }
    myCostCenters {
      id
      name
      description
    }
    myProfile {
      id
      preferredCurrency
    }
  }
`;

export const MY_ACCOUNTS_RECEIVABLE_QUERY = gql`
  query MyAccountsReceivable($status: AccountReceivableStatus) {
    myAccountsReceivable(status: $status) {
      id
      categoryId
      financialAccountId
      seriesId
      installmentNumber
      installmentTotal
      costCenterId
      description
      amount
      dueDate
      status
      receivedAt
      reminderOffsetDays
      createdAt
    }
    myCategories {
      id
      name
      type
      color
    }
    myCostCenters {
      id
      name
      description
    }
    myProfile {
      id
      preferredCurrency
    }
  }
`;

export const CREATE_ACCOUNT_PAYABLE = gql`
  mutation CreateAccountPayable($input: CreateAccountPayableInput!) {
    createAccountPayable(input: $input) {
      id
      description
      amount
      dueDate
      status
    }
  }
`;

export const UPDATE_ACCOUNT_PAYABLE = gql`
  mutation UpdateAccountPayable($input: UpdateAccountPayableInput!) {
    updateAccountPayable(input: $input) {
      id
      description
      amount
      dueDate
      status
      reminderOffsetDays
    }
  }
`;

export const MARK_ACCOUNT_PAYABLE_PAID = gql`
  mutation MarkAccountPayablePaid($id: ID!, $paidAt: String) {
    markAccountPayablePaid(id: $id, paidAt: $paidAt) {
      id
      status
      paidAt
    }
  }
`;

export const DELETE_ACCOUNT_PAYABLE = gql`
  mutation DeleteAccountPayable($id: ID!) {
    deleteAccountPayable(id: $id)
  }
`;

export const CREATE_ACCOUNT_RECEIVABLE = gql`
  mutation CreateAccountReceivable($input: CreateAccountReceivableInput!) {
    createAccountReceivable(input: $input) {
      id
      description
      amount
      dueDate
      status
    }
  }
`;

export const UPDATE_ACCOUNT_RECEIVABLE = gql`
  mutation UpdateAccountReceivable($input: UpdateAccountReceivableInput!) {
    updateAccountReceivable(input: $input) {
      id
      description
      amount
      dueDate
      status
      reminderOffsetDays
    }
  }
`;

export const MARK_ACCOUNT_RECEIVABLE_RECEIVED = gql`
  mutation MarkAccountReceivableReceived($id: ID!, $receivedAt: String) {
    markAccountReceivableReceived(id: $id, receivedAt: $receivedAt) {
      id
      status
      receivedAt
    }
  }
`;

export const DELETE_ACCOUNT_RECEIVABLE = gql`
  mutation DeleteAccountReceivable($id: ID!) {
    deleteAccountReceivable(id: $id)
  }
`;

export type AccountPayableItem = {
  id: string;
  categoryId: string;
  financialAccountId?: string;
  seriesId?: string;
  installmentNumber?: number;
  installmentTotal?: number;
  costCenterId?: string | null;
  description: string;
  amount: string;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paidAt?: string | null;
  reminderOffsetDays?: number | null;
  createdAt: string;
};

export type AccountReceivableItem = {
  id: string;
  categoryId: string;
  financialAccountId?: string;
  seriesId?: string;
  installmentNumber?: number;
  installmentTotal?: number;
  costCenterId?: string | null;
  description: string;
  amount: string;
  dueDate: string;
  status: 'PENDING' | 'RECEIVED' | 'OVERDUE' | 'CANCELLED';
  receivedAt?: string | null;
  reminderOffsetDays?: number | null;
  createdAt: string;
};

export type Category = {
  id: string;
  name: string;
  type: string;
  color: string;
};

export type CostCenter = {
  id: string;
  name: string;
  description?: string | null;
};

export const reminderOptions: Array<{ label: string; value: number | null }> = [
  { label: 'Sem lembrete', value: null },
  { label: 'No dia', value: 0 },
  { label: '1 dia antes', value: 1 },
  { label: '3 dias antes', value: 3 },
  { label: '7 dias antes', value: 7 }
];

export type AccountsTab = 'PAYABLE' | 'RECEIVABLE';
const newAccountSchedule = () => ({ ...defaultSchedule(), effective: true });

export interface AccountsManagerProps {
  initialTab?: AccountsTab | undefined;
  initialModalOpen?: boolean | undefined;
  modalOnly?: boolean;
  onClose?: () => void;
}

export function AccountsManager({
  initialTab = 'PAYABLE',
  initialModalOpen = false,
  modalOnly = false,
  onClose
}: AccountsManagerProps): React.JSX.Element {
  const { theme } = useTheme();
  const { isDesktop } = useResponsive();
  const [activeTab, setActiveTab] = useState<AccountsTab>(initialTab);
  const isPayable = activeTab === 'PAYABLE';
  const [isModalOpen, setIsModalOpen] = useState(initialModalOpen || modalOnly);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'SETTLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${d}/${m}/${y}`;
  });
  const [categoryId, setCategoryId] = useState('');
  const [financialAccountIds, setFinancialAccountIds] = useState<string[]>([]);
  const [seriesEdit, setSeriesEdit] = useState<{ id: string; number: number } | null>(null);
  const [futureScope, setFutureScope] = useState(false);
  const [updateSeries] = useMutation(gql`mutation UpdateCommitmentSeries($input:UpdateCommitmentSeriesInput!) { updateCommitmentSeries(input:$input) }`, { refetchQueries: ['FinancialAccounts', 'DashboardSummary'], onCompleted: () => { closeModal(); if (isPayable) void refetchPayables(); else void refetchReceivables(); }, onError: e => setErrorMessage(e.message) });
  const [cancelSeries] = useMutation(gql`mutation CancelFinancialSeries($id:ID!, $fromNumber:Int!) { cancelFinancialSeries(id:$id,fromNumber:$fromNumber) }`, { refetchQueries: ['FinancialAccounts', 'DashboardSummary'], onCompleted: () => { closeModal(); if (isPayable) void refetchPayables(); else void refetchReceivables(); }, onError: e => setErrorMessage(e.message) });
  const seriesOperation = useRef<string | null>(null);
  const [schedule, setSchedule] = useState(newAccountSchedule);
  const [createSeries, { loading: creatingSeries }] = useMutation(gql`mutation CreateCommitmentSeries($input: CommitmentSeriesInput!) { createCommitmentSeries(input:$input) }`, { refetchQueries: ['FinancialAccounts', 'DashboardSummary'], onCompleted: () => { closeModal(); if (isPayable) void refetchPayables(); else void refetchReceivables(); }, onError: error => setErrorMessage(error.message) });
  const [costCenterId, setCostCenterId] = useState('');
  const [reminderOffsetDays, setReminderOffsetDays] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const settlingRef = useRef(false);

  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  // Queries
  const { data: payablesData, loading: loadingPayables, refetch: refetchPayables } = useQuery<{
    myAccountsPayable: AccountPayableItem[];
    myCategories: Category[];
    myCostCenters: CostCenter[];
    myProfile?: { id: string; preferredCurrency: string };
  }>(MY_ACCOUNTS_PAYABLE_QUERY, {
    fetchPolicy: 'cache-and-network'
  });

  const { data: receivablesData, loading: loadingReceivables, refetch: refetchReceivables } = useQuery<{
    myAccountsReceivable: AccountReceivableItem[];
    myCategories: Category[];
    myCostCenters: CostCenter[];
    myProfile?: { id: string; preferredCurrency: string };
  }>(MY_ACCOUNTS_RECEIVABLE_QUERY, {
    fetchPolicy: 'cache-and-network'
  });
  const didSyncSeries = useRef(false);
  const [syncSeries] = useMutation(gql`mutation SyncFinancialSeries { syncFinancialSeries }`);
  useEffect(() => {
    if (modalOnly || didSyncSeries.current) return;
    didSyncSeries.current = true;
    void Promise.resolve(syncSeries()).then(() => {
      if (isPayable) void refetchPayables(); else void refetchReceivables();
    }).catch(() => undefined);
  }, [syncSeries, isPayable, refetchPayables, refetchReceivables, modalOnly]);

  const directMutationOptions = {
    refetchQueries: ['FinancialAccounts', 'DashboardSummary', 'MyTransactions', 'CashFlow', 'PeriodComparison', 'CategoryAnalysis'],
    onCompleted: () => closeModal(),
    onError: (error: Error) => setErrorMessage(error.message)
  };
  const [createIncome, { loading: creatingIncome }] = useMutation(CREATE_INCOME, directMutationOptions);
  const [createExpense, { loading: creatingExpense }] = useMutation(CREATE_EXPENSE, directMutationOptions);

  // Mutations - Payables
  const [createPayable, { loading: creatingPayable }] = useMutation(CREATE_ACCOUNT_PAYABLE, {
    refetchQueries: ['FinancialAccounts', 'MyAccountsPayable', 'DashboardSummary'],
    onCompleted: () => {
      closeModal();
      void refetchPayables();
    },
    onError: (err) => setErrorMessage(err.message)
  });

  const [updatePayable, { loading: updatingPayable }] = useMutation(UPDATE_ACCOUNT_PAYABLE, {
    refetchQueries: ['FinancialAccounts', 'MyAccountsPayable', 'DashboardSummary'],
    onCompleted: () => {
      closeModal();
      void refetchPayables();
    },
    onError: (err) => setErrorMessage(err.message)
  });

  const [markPayablePaid, { loading: markingPayablePaid }] = useMutation(MARK_ACCOUNT_PAYABLE_PAID, {
    refetchQueries: ['FinancialAccounts', 'MyAccountsPayable', 'DashboardSummary'],
    onCompleted: () => void refetchPayables(),
    onError: (err) => setActionError(err.message)
  });

  const [deletePayable] = useMutation(DELETE_ACCOUNT_PAYABLE, {
    refetchQueries: ['FinancialAccounts', 'MyAccountsPayable', 'DashboardSummary'],
    onCompleted: () => void refetchPayables(),
    onError: (err) => setActionError(err.message)
  });

  // Mutations - Receivables
  const [createReceivable, { loading: creatingReceivable }] = useMutation(CREATE_ACCOUNT_RECEIVABLE, {
    refetchQueries: ['FinancialAccounts', 'MyAccountsReceivable', 'DashboardSummary'],
    onCompleted: () => {
      closeModal();
      void refetchReceivables();
    },
    onError: (err) => setErrorMessage(err.message)
  });

  const [updateReceivable, { loading: updatingReceivable }] = useMutation(UPDATE_ACCOUNT_RECEIVABLE, {
    refetchQueries: ['FinancialAccounts', 'MyAccountsReceivable', 'DashboardSummary'],
    onCompleted: () => {
      closeModal();
      void refetchReceivables();
    },
    onError: (err) => setErrorMessage(err.message)
  });

  const [markReceivableReceived, { loading: markingReceivableReceived }] = useMutation(MARK_ACCOUNT_RECEIVABLE_RECEIVED, {
    refetchQueries: ['FinancialAccounts', 'MyAccountsReceivable', 'DashboardSummary'],
    onCompleted: () => void refetchReceivables(),
    onError: (err) => setActionError(err.message)
  });

  const [deleteReceivable] = useMutation(DELETE_ACCOUNT_RECEIVABLE, {
    refetchQueries: ['FinancialAccounts', 'MyAccountsReceivable', 'DashboardSummary'],
    onCompleted: () => void refetchReceivables(),
    onError: (err) => setActionError(err.message)
  });

  const currencyString =
    (isPayable
      ? payablesData?.myProfile?.preferredCurrency
      : receivablesData?.myProfile?.preferredCurrency) ?? 'BRL';
  const currency: SupportedCurrency =
    currencyString === 'USD' || currencyString === 'EUR' ? currencyString : 'BRL';
  const previousCurrency = useRef<SupportedCurrency>('BRL');
  useEffect(() => {
    const previous = previousCurrency.current;
    if (previous === currency) return;
    setDueDate((value) => {
      const iso = parseRegionalDateToISO(value, previous);
      return iso ? formatISOToRegionalDate(iso, currency) : value;
    });
    previousCurrency.current = currency;
  }, [currency]);

  const allCategories = (isPayable ? payablesData?.myCategories : receivablesData?.myCategories) ?? [];
  const categories = useMemo(() => {
    return allCategories.filter((c) =>
      isPayable ? c.type === 'EXPENSE' || c.type === 'BOTH' : c.type === 'INCOME' || c.type === 'BOTH'
    );
  }, [allCategories, isPayable]);

  const costCenters = (isPayable ? payablesData?.myCostCenters : receivablesData?.myCostCenters) ?? [];

  // Metrics
  const payablesList = payablesData?.myAccountsPayable ?? [];
  const receivablesList = receivablesData?.myAccountsReceivable ?? [];

  const pendingPayablesTotal = useMemo(() => {
    return payablesList
      .filter((p) => p.status === 'PENDING' || p.status === 'OVERDUE')
      .reduce((acc, curr) => acc + Number(curr.amount), 0);
  }, [payablesList]);

  const pendingReceivablesTotal = useMemo(() => {
    return receivablesList
      .filter((r) => r.status === 'PENDING' || r.status === 'OVERDUE')
      .reduce((acc, curr) => acc + Number(curr.amount), 0);
  }, [receivablesList]);

  const projectedBalance = pendingReceivablesTotal - pendingPayablesTotal;

  // Filtered List for active tab
  const activeItems = useMemo(() => {
    const list = isPayable ? payablesList : receivablesList;
    return list.filter((item) => {
      // Status filter
      if (statusFilter === 'PENDING' && item.status !== 'PENDING' && item.status !== 'OVERDUE') {
        return false;
      }
      if (statusFilter === 'SETTLED') {
        if (isPayable && item.status !== 'PAID') return false;
        if (!isPayable && item.status !== 'RECEIVED') return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const cat = allCategories.find((c) => c.id === item.categoryId);
        const matchDesc = item.description.toLowerCase().includes(query);
        const matchCat = cat?.name.toLowerCase().includes(query) ?? false;
        if (!matchDesc && !matchCat) return false;
      }

      return true;
    });
  }, [isPayable, payablesList, receivablesList, statusFilter, searchQuery, allCategories]);

  const openNewModal = () => {
    setEditingId(null);
    setDescription('');
    setAmount('');
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    setDueDate(formatISOToRegionalDate(`${y}-${m}-${d}`, currency));
    setCategoryId(categories[0]?.id ?? '');
    setCostCenterId('');
    setFinancialAccountIds([]);
    setSchedule(newAccountSchedule());
    setSeriesEdit(null); setFutureScope(false); seriesOperation.current = null;
    setReminderOffsetDays(null);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditPayable = (item: AccountPayableItem) => {
    setEditingId(item.id);
    setDescription(item.description);
    setAmount(item.amount);
    setDueDate(formatISOToRegionalDate(item.dueDate.split('T')[0] ?? '', currency));
    setCategoryId(item.categoryId);
    setCostCenterId(item.costCenterId ?? '');
    setFinancialAccountIds(item.financialAccountId ? [item.financialAccountId] : []);
    setSeriesEdit(item.seriesId ? { id: item.seriesId, number: item.installmentNumber ?? 1 } : null); setFutureScope(false);
    setReminderOffsetDays(item.reminderOffsetDays ?? null);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditReceivable = (item: AccountReceivableItem) => {
    setEditingId(item.id);
    setDescription(item.description);
    setAmount(item.amount);
    setDueDate(formatISOToRegionalDate(item.dueDate.split('T')[0] ?? '', currency));
    setCategoryId(item.categoryId);
    setCostCenterId(item.costCenterId ?? '');
    setFinancialAccountIds(item.financialAccountId ? [item.financialAccountId] : []);
    setSeriesEdit(item.seriesId ? { id: item.seriesId, number: item.installmentNumber ?? 1 } : null); setFutureScope(false);
    setReminderOffsetDays(item.reminderOffsetDays ?? null);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setErrorMessage(null);
    onClose?.();
  };

  const directEntry = !editingId && schedule.mode === 'ONCE' && schedule.effective;
  const submitLabel = editingId
    ? isPayable ? 'Atualizar Conta a Pagar' : 'Atualizar Conta a Receber'
    : directEntry ? isPayable ? 'Registrar pagamento' : 'Registrar recebimento'
    : isPayable ? 'Agendar Conta a Pagar' : 'Agendar Conta a Receber';

  const formValid = validText(description, 120) && !!decimal(amount) && !!categoryId && !!parseRegionalDateToISO(dueDate, currency) && (editingId ? true : validSchedule(schedule));
  const handleSubmit = async () => {
    if (!formValid || savingRef.current || isSubmitting) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (!validText(description, 120)) {
        setErrorMessage('Informe uma descrição.');
        return;
      }
      if (!decimal(amount)) {
        setErrorMessage('Informe um valor numérico positivo.');
        return;
      }
      if (!categoryId) {
        setErrorMessage('Selecione uma categoria.');
        return;
      }

      const isoDueDate = parseRegionalDateToISO(dueDate, currency);
      if (!isoDueDate) {
        setErrorMessage('Informe uma data de vencimento válida.');
        return;
      }

      setErrorMessage(null);
      const dueDateISO = new Date(isoDueDate).toISOString();
      if (editingId && seriesEdit && futureScope) {
        await updateSeries({ variables: { input: { id: seriesEdit.id, fromNumber: seriesEdit.number, reminderOffsetDays, financialAccountId: financialAccountIds[0], categoryId, costCenterId: costCenterId || undefined, description: description.trim(), amount: decimal(amount)!, dueDate: isoDueDate } } });
        return;
      }
      if (directEntry) {
        const create = isPayable ? createExpense : createIncome;
        await create({ variables: { input: {
          description: description.trim(), amount: decimal(amount)!, occurredAt: dueDateISO,
          categoryId, financialAccountId: financialAccountIds[0] || undefined, costCenterId: costCenterId || undefined
        } } });
        return;
      }
      if (!editingId && schedule.mode !== 'ONCE') {
        await createSeries({ variables: { input: {
          operationId: seriesOperation.current ?? (seriesOperation.current = randomUUID()),
          financialAccountId: financialAccountIds[0] || undefined,
          categoryId, costCenterId: costCenterId || undefined, reminderOffsetDays,
          description: description.trim(), amount: decimal(amount)!, dueDate: isoDueDate,
          type: isPayable ? 'EXPENSE' : 'INCOME',
          schedule: scheduleInput(schedule),
          ...(schedule.effective ? { effectiveDate: schedule.effectiveDate } : {}), overrides: schedule.overrides
        } } });
        return;
      }

      if (isPayable) {
        if (editingId) {
          await updatePayable({
            variables: {
              input: {
                id: editingId,
                description: description.trim(),
                amount: decimal(amount)!,
                dueDate: dueDateISO,
                categoryId,
                financialAccountId: financialAccountIds[0],
                costCenterId: costCenterId || undefined,
                reminderOffsetDays: reminderOffsetDays ?? null
              }
            }
          });
        } else {
          await createPayable({
            variables: {
              input: {
                description: description.trim(),
                amount: decimal(amount)!,
                dueDate: dueDateISO,
                categoryId,
                financialAccountId: financialAccountIds[0],
                costCenterId: costCenterId || undefined,
                reminderOffsetDays: reminderOffsetDays ?? null
              }
            }
          });
        }
      } else {
        if (editingId) {
          await updateReceivable({
            variables: {
              input: {
                id: editingId,
                description: description.trim(),
                amount: decimal(amount)!,
                dueDate: dueDateISO,
                categoryId,
                financialAccountId: financialAccountIds[0],
                costCenterId: costCenterId || undefined,
                reminderOffsetDays: reminderOffsetDays ?? null
              }
            }
          });
        } else {
          await createReceivable({
            variables: {
              input: {
                description: description.trim(),
                amount: decimal(amount)!,
                dueDate: dueDateISO,
                categoryId,
                financialAccountId: financialAccountIds[0],
                costCenterId: costCenterId || undefined,
                reminderOffsetDays: reminderOffsetDays ?? null
              }
            }
          });
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível salvar o lançamento.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleMarkSettled = async (id: string) => {
    if (settlingRef.current || markingPayablePaid || markingReceivableReceived) return;
    settlingRef.current = true;
    setSettling(true);
    setActionError(null);
    const nowISO = new Date().toISOString();
    try {
      if (isPayable) {
        await markPayablePaid({ variables: { id, paidAt: nowISO } });
      } else {
        await markReceivableReceived({ variables: { id, receivedAt: nowISO } });
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível dar baixa na conta. Tente novamente.');
    } finally {
      settlingRef.current = false;
      setSettling(false);
    }
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    try {
      if (isPayable) {
        await deletePayable({ variables: { id } });
      } else {
        await deleteReceivable({ variables: { id } });
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível excluir a conta. Tente novamente.');
    }
  };

  const markingSettled = settling || markingPayablePaid || markingReceivableReceived;
  const isSubmitting = saving || creatingIncome || creatingExpense || creatingSeries || (isPayable ? creatingPayable || updatingPayable : creatingReceivable || updatingReceivable);

  return (
    <View style={modalOnly ? undefined : styles.container}>
      {!modalOnly && <>
      {actionError && (
        <View style={[styles.errorBox, { backgroundColor: theme.expenseBadge }]}>
          <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.errorText, { color: theme.expense }]}>{actionError}</Text>
        </View>
      )}
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.eyebrow, { color: isPayable ? theme.expense : theme.income }]}>
              {isPayable ? 'COMPROMISSOS FINANCEIROS' : 'RECEITAS PROGRAMADAS'}
            </Text>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: theme.textPrimary }]}
            >
              {isPayable ? 'Contas a Pagar' : 'Contas a Receber'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Controle unificado de obrigações e recebimentos futuros.
            </Text>
          </View>

          {/* New Account Button */}
          <Pressable
            accessibilityLabel={isPayable ? 'Nova Conta a Pagar' : 'Nova Conta a Receber'}
            accessibilityRole="button"
            onPress={openNewModal}
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: isPayable ? theme.expense : theme.income,
                opacity: pressed ? 0.85 : 1
              }
            ]}
          >
            <Plus color="#FFFFFF" size={18} strokeWidth={2.5} />
            <Text style={styles.actionButtonText}>
              {isPayable ? 'Nova Conta a Pagar' : 'Nova Conta a Receber'}
            </Text>
          </Pressable>
        </View>

        {/* Tab Switcher & Metrics */}
        <View style={styles.tabBarWrap}>
          <View
            style={[
              styles.tabPillContainer,
              { backgroundColor: theme.bgElevated, borderColor: theme.borderElevated }
            ]}
          >
            <Pressable
              accessibilityLabel="Aba Contas a Pagar"
              accessibilityRole="button"
              onPress={() => {
                setActiveTab('PAYABLE');
                setSearchQuery('');
              }}
              style={[
                styles.tabPill,
                isPayable && { backgroundColor: theme.expense }
              ]}
            >
              <Text
                style={[
                  styles.tabPillText,
                  { color: isPayable ? '#FFFFFF' : theme.textSecondary, fontWeight: isPayable ? '700' : '500' }
                ]}
              >
                {`A Pagar (${payablesList.length})`}
              </Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Aba Contas a Receber"
              accessibilityRole="button"
              onPress={() => {
                setActiveTab('RECEIVABLE');
                setSearchQuery('');
              }}
              style={[
                styles.tabPill,
                !isPayable && { backgroundColor: theme.income }
              ]}
            >
              <Text
                style={[
                  styles.tabPillText,
                  { color: !isPayable ? '#FFFFFF' : theme.textSecondary, fontWeight: !isPayable ? '700' : '500' }
                ]}
              >
                {`A Receber (${receivablesList.length})`}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* 3 Metric Cards */}
        <View style={styles.metricsRow}>
          <Card style={styles.metricCard} variant="surface">
            <View style={styles.metricHeader}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                Total a Pagar (Pendente)
              </Text>
              <ArrowDownRight color={theme.expense} size={16} />
            </View>
            <Text style={[styles.metricValue, { color: theme.expense }]}>
              {formatCurrency(pendingPayablesTotal.toString(), currency)}
            </Text>
            <Text style={[styles.metricSub, { color: theme.textMuted }]}>
              {payablesList.filter((p) => p.status === 'PENDING').length} pendentes
            </Text>
          </Card>

          <Card style={styles.metricCard} variant="surface">
            <View style={styles.metricHeader}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                Total a Receber (Pendente)
              </Text>
              <ArrowUpRight color={theme.income} size={16} />
            </View>
            <Text style={[styles.metricValue, { color: theme.income }]}>
              {formatCurrency(pendingReceivablesTotal.toString(), currency)}
            </Text>
            <Text style={[styles.metricSub, { color: theme.textMuted }]}>
              {receivablesList.filter((r) => r.status === 'PENDING').length} previstos
            </Text>
          </Card>

          <Card style={styles.metricCard} variant="surface">
            <View style={styles.metricHeader}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                Balanço Previsto
              </Text>
              <WalletCards
                color={projectedBalance >= 0 ? theme.income : theme.expense}
                size={16}
              />
            </View>
            <Text
              style={[
                styles.metricValue,
                { color: projectedBalance >= 0 ? theme.income : theme.expense }
              ]}
            >
              {formatCurrency(projectedBalance.toString(), currency)}
            </Text>
            <Text style={[styles.metricSub, { color: theme.textMuted }]}>
              Resultado projetado
            </Text>
          </Card>
        </View>
      </View>

      {/* Filter and Search Bar */}
      <Card style={styles.filterCard} variant="surface">
        <View style={styles.filterRow}>
          <View style={styles.filterChips}>
            {(['ALL', 'PENDING', 'SETTLED'] as const).map((sf) => {
              const isActive = statusFilter === sf;
              const label =
                sf === 'ALL'
                  ? 'Todos'
                  : sf === 'PENDING'
                  ? 'Pendentes'
                  : isPayable
                  ? 'Pagos'
                  : 'Recebidos';

              return (
                <Pressable
                  key={sf}
                  accessibilityLabel={`Filtrar status ${label}`}
                  accessibilityRole="button"
                  onPress={() => setStatusFilter(sf)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isActive ? theme.brandAI : theme.bgElevated,
                      borderColor: isActive ? theme.brandAI : theme.borderElevated
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: isActive ? '#FFFFFF' : theme.textSecondary, fontWeight: isActive ? '700' : '500' }
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View
            style={[
              styles.searchBox,
              { backgroundColor: theme.bgElevated, borderColor: theme.borderElevated }
            ]}
          >
            <Search color={theme.textMuted} size={16} />
            <TextInput
              accessibilityLabel={`Buscar contas a ${isPayable ? 'pagar' : 'receber'}`}
              onChangeText={setSearchQuery}
              placeholder={`Buscar por descrição ou categoria...`}
              placeholderTextColor={theme.textMuted}
              style={[styles.searchInput, { color: theme.textPrimary }]}
              value={searchQuery}
            />
          </View>
        </View>
      </Card>

      {/* List */}
      {(isPayable ? loadingPayables : loadingReceivables) && activeItems.length === 0 ? (
        <ActivityIndicator color={theme.income} size="large" style={{ marginTop: 24 }} />
      ) : activeItems.length === 0 ? (
        <Card style={styles.emptyCard} variant="surface">
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {`Nenhuma conta a ${isPayable ? 'pagar' : 'receber'} encontrada.`}
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {activeItems.map((item) => {
            const cat = allCategories.find((c) => c.id === item.categoryId);
            const isSettled = isPayable ? item.status === 'PAID' : item.status === 'RECEIVED';
            const isOverdue = item.status === 'OVERDUE';

            return (
              <Card
                key={item.id}
                style={[styles.itemCard, !isDesktop && styles.itemCardMobile]}
                variant="surface"
              >
                {isDesktop ? (
                  <>
                    <View style={styles.itemLeft}>
                      <View
                        style={[
                          styles.iconWrap,
                          {
                            backgroundColor: isPayable ? theme.expenseBadge : theme.incomeBadge
                          }
                        ]}
                      >
                        {isPayable ? (
                          <ArrowDownRight color={theme.expense} size={20} />
                        ) : (
                          <ArrowUpRight color={theme.income} size={20} />
                        )}
                      </View>

                      <View style={styles.itemInfo}>
                        <Text style={[styles.itemDesc, { color: theme.textPrimary }]}>
                          {item.description}{item.installmentNumber ? ` (${item.installmentNumber}/${item.installmentTotal ?? 'mensal'})` : ''}
                        </Text>

                        <View style={styles.itemMetaRow}>
                          {cat && (
                            <View
                              style={[
                                styles.catPill,
                                { backgroundColor: `${cat.color}25`, borderColor: cat.color }
                              ]}
                            >
                              <Tag color={cat.color} size={11} style={{ marginRight: 3 }} />
                              <Text style={[styles.itemCat, { color: cat.color }]}>
                                {cat.name}
                              </Text>
                            </View>
                          )}

                          <Badge
                            icon={isSettled ? CheckCircle2 : isOverdue ? AlertCircle : Clock}
                            label={isSettled ? (isPayable ? 'Pago' : 'Recebido') : isOverdue ? 'Atrasado' : 'Pendente'}
                            tone={isSettled ? 'income' : isOverdue ? 'expense' : 'neutral'}
                          />

                          <Text style={[styles.itemDate, { color: theme.textMuted }]}>
                            • Vence {formatDate(item.dueDate, currency)}
                          </Text>

                          {item.reminderOffsetDays !== null && item.reminderOffsetDays !== undefined && (
                            <Text style={[styles.itemReminder, { color: theme.brandAI }]}>
                              🔔 {item.reminderOffsetDays === 0 ? 'No dia' : `${item.reminderOffsetDays}d antes`}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>

                    <View style={styles.itemRight}>
                      <Text
                        style={[
                          styles.itemAmount,
                          { color: isPayable ? theme.expense : theme.income }
                        ]}
                      >
                        {formatCurrency(item.amount, currency)}
                      </Text>

                      <View style={styles.itemActions}>
                        {!isSettled && (
                          <Pressable
                            accessibilityLabel={
                              isPayable
                                ? `Marcar ${item.description} como pago`
                                : `Marcar ${item.description} como recebida`
                            }
                            accessibilityRole="button"
                            accessibilityState={{ busy: markingSettled, disabled: markingSettled }}
                            disabled={markingSettled}
                            onPress={() => void handleMarkSettled(item.id)}
                            style={({ pressed }) => [
                              styles.settleButton,
                              {
                                backgroundColor: theme.incomeBadge,
                                borderColor: theme.income,
                                opacity: markingSettled ? 0.5 : pressed ? 0.7 : 1
                              }
                            ]}
                          >
                            <Check color={theme.income} size={14} />
                            <Text style={[styles.settleButtonText, { color: theme.income }]}>
                              Dar Baixa
                            </Text>
                          </Pressable>
                        )}

                        <Pressable
                          accessibilityLabel={`Editar ${item.description}`}
                          accessibilityRole="button"
                          onPress={() => (isPayable ? openEditPayable(item as AccountPayableItem) : openEditReceivable(item as AccountReceivableItem))}
                          style={({ pressed }) => [
                            styles.iconActionButton,
                            {
                              backgroundColor: theme.bgElevated,
                              borderColor: theme.borderElevated,
                              opacity: pressed ? 0.7 : 1
                            }
                          ]}
                        >
                          <Pencil color={theme.textSecondary} size={15} />
                        </Pressable>

                        <Pressable
                          accessibilityLabel={`Excluir ${item.description}`}
                          accessibilityRole="button"
                          onPress={() => void handleDelete(item.id)}
                          style={({ pressed }) => [
                            styles.iconActionButton,
                            {
                              backgroundColor: theme.bgElevated,
                              borderColor: theme.borderElevated,
                              opacity: pressed ? 0.7 : 1
                            }
                          ]}
                        >
                          <Trash2 color={theme.expense} size={15} />
                        </Pressable>
                      </View>
                    </View>
                  </>
                ) : (
                  <View style={styles.mobileCardContent}>
                    {/* Top Row: Icon + Description + Amount */}
                    <View style={styles.mobileTopRow}>
                      <View style={styles.mobileTitleGroup}>
                        <View
                          style={[
                            styles.iconWrap,
                            {
                              backgroundColor: isPayable ? theme.expenseBadge : theme.incomeBadge
                            }
                          ]}
                        >
                          {isPayable ? (
                            <ArrowDownRight color={theme.expense} size={20} />
                          ) : (
                            <ArrowUpRight color={theme.income} size={20} />
                          )}
                        </View>

                        <View style={styles.mobileDescWrap}>
                          <Text style={[styles.itemDesc, { color: theme.textPrimary }]}>
                            {item.description}{item.installmentNumber ? ` (${item.installmentNumber}/${item.installmentTotal ?? 'mensal'})` : ''}
                          </Text>
                          <Text style={[styles.itemDate, { color: theme.textMuted }]}>
                            Vence {formatDate(item.dueDate, currency)}
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={[
                          styles.itemAmount,
                          { color: isPayable ? theme.expense : theme.income }
                        ]}
                      >
                        {formatCurrency(item.amount, currency)}
                      </Text>
                    </View>

                    {/* Middle Row: Badges */}
                    <View style={styles.itemMetaRow}>
                      {cat && (
                        <View
                          style={[
                            styles.catPill,
                            { backgroundColor: `${cat.color}25`, borderColor: cat.color }
                          ]}
                        >
                          <Tag color={cat.color} size={11} style={{ marginRight: 3 }} />
                          <Text style={[styles.itemCat, { color: cat.color }]}>
                            {cat.name}
                          </Text>
                        </View>
                      )}

                      <Badge
                        icon={isSettled ? CheckCircle2 : isOverdue ? AlertCircle : Clock}
                        label={isSettled ? (isPayable ? 'Pago' : 'Recebido') : isOverdue ? 'Atrasado' : 'Pendente'}
                        tone={isSettled ? 'income' : isOverdue ? 'expense' : 'neutral'}
                      />

                      {item.reminderOffsetDays !== null && item.reminderOffsetDays !== undefined && (
                        <Text style={[styles.itemReminder, { color: theme.brandAI }]}>
                          🔔 {item.reminderOffsetDays === 0 ? 'No dia' : `${item.reminderOffsetDays}d antes`}
                        </Text>
                      )}
                    </View>

                    {/* Bottom Row: Actions */}
                    <View
                      style={[
                        styles.mobileActionsRow,
                        { borderTopColor: theme.borderElevated }
                      ]}
                    >
                      {!isSettled && (
                        <Pressable
                          accessibilityLabel={
                            isPayable
                              ? `Marcar ${item.description} como pago`
                              : `Marcar ${item.description} como recebida`
                          }
                          accessibilityRole="button"
                          accessibilityState={{ busy: markingSettled, disabled: markingSettled }}
                          disabled={markingSettled}
                          onPress={() => void handleMarkSettled(item.id)}
                          style={({ pressed }) => [
                            styles.settleButton,
                            styles.mobileSettleButton,
                            {
                              backgroundColor: theme.incomeBadge,
                              borderColor: theme.income,
                              opacity: markingSettled ? 0.5 : pressed ? 0.7 : 1
                            }
                          ]}
                        >
                          <Check color={theme.income} size={14} />
                          <Text style={[styles.settleButtonText, { color: theme.income }]}>
                            Dar Baixa
                          </Text>
                        </Pressable>
                      )}

                      <View style={styles.mobileRightActions}>
                        <Pressable
                          accessibilityLabel={`Editar ${item.description}`}
                          accessibilityRole="button"
                          onPress={() => (isPayable ? openEditPayable(item as AccountPayableItem) : openEditReceivable(item as AccountReceivableItem))}
                          style={({ pressed }) => [
                            styles.iconActionButton,
                            {
                              backgroundColor: theme.bgElevated,
                              borderColor: theme.borderElevated,
                              opacity: pressed ? 0.7 : 1
                            }
                          ]}
                        >
                          <Pencil color={theme.textSecondary} size={15} />
                        </Pressable>

                        <Pressable
                          accessibilityLabel={`Excluir ${item.description}`}
                          accessibilityRole="button"
                          onPress={() => void handleDelete(item.id)}
                          style={({ pressed }) => [
                            styles.iconActionButton,
                            {
                              backgroundColor: theme.bgElevated,
                              borderColor: theme.borderElevated,
                              opacity: pressed ? 0.7 : 1
                            }
                          ]}
                        >
                          <Trash2 color={theme.expense} size={15} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      )}

      </>}

      {/* Floating Modal for Creation / Editing */}
      <ThemedModal
        maxWidth={520}
        onClose={closeModal}
        dismissDisabled={isSubmitting}
        subtitle={
          editingId
            ? 'Altere os dados da conta abaixo.'
            : directEntry ? 'Este lançamento efetivado aparecerá no Extrato.'
            : `Preencha os dados para programar uma nova conta a ${isPayable ? 'pagar' : 'receber'}.`
        }
        title={
          editingId
            ? isPayable
              ? 'Editar Conta a Pagar'
              : 'Editar Conta a Receber'
            : isPayable
            ? 'Nova Conta a Pagar'
            : 'Nova Conta a Receber'
        }
        visible={isModalOpen}
      >
        <View style={styles.modalForm}>
          {errorMessage && (
            <View style={[styles.errorBox, { backgroundColor: theme.expenseBadge, borderColor: theme.expense }]}>
              <AlertCircle color={theme.expense} size={16} />
              <Text style={[styles.errorText, { color: theme.expense }]}>{errorMessage}</Text>
            </View>
          )}

          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Descrição</Text>
            <TextInput
              accessibilityLabel={isPayable ? 'Descrição da conta a pagar' : 'Descrição da conta a receber'}
              maxLength={120} onChangeText={setDescription}
              placeholder={isPayable ? 'Ex: Aluguel, Internet...' : 'Ex: Consultoria, Venda...'}
              placeholderTextColor={theme.textMuted}
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.bgElevated,
                  borderColor: theme.borderElevated,
                  color: theme.textPrimary
                }
              ]}
              value={description}
            />
          </View>

          {/* Amount and Due Date */}
          <View style={styles.formRow}>
            <View style={[styles.formGroup, styles.amountField]}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Valor ({currency})</Text>
              <TextInput
                accessibilityLabel={isPayable ? 'Valor da conta a pagar' : 'Valor da conta a receber'}
                moneyDigits={10}
                onChangeText={setAmount}
                placeholder="Ex: 350.00"
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.textInput,
                  styles.amountInput,
                  {
                    backgroundColor: theme.bgElevated,
                    borderColor: theme.borderElevated,
                    color: theme.textPrimary
                  }
                ]}
                value={amount}
              />
            </View>

            <View style={[styles.formGroup, styles.dateField]}>
              <DatePickerInput
                currency={currency}
                label={directEntry ? "Data do lançamento" : "Vencimento"}
                onChangeText={setDueDate}
                value={dueDate}
              />
            </View>
          </View>

          {/* Categories */}
          <Select
            label="Categoria"
            value={categoryId}
            onChange={setCategoryId}
            options={categories.map(category => ({ value: category.id, label: category.name }))}
            placeholder={categories.length ? 'Selecione uma categoria' : 'Nenhuma categoria disponível'}
          />
          {editingId && seriesEdit && <View>
            <ToggleButton label="Aplicar a esta e próximas pendentes" accessibilityLabel="Aplicar a esta e proximas pendentes" value={futureScope} onChange={setFutureScope} activeText="Esta e proximas pendentes" inactiveText="Somente esta parcela" />
            <Button title="Cancelar esta e proximas pendentes" variant="danger" disabled={isSubmitting} onPress={() => void cancelSeries({ variables: { id: seriesEdit.id, fromNumber: seriesEdit.number } })} style={{ minHeight: 48 }} />
          </View>}
          {!editingId && <CommitmentSchedule value={schedule} singleEntry onChange={(next) => setSchedule(next.mode === schedule.mode ? next : { ...next, effective: next.mode === 'ONCE', effectiveDate: defaultSchedule().effectiveDate, overrides: [] })} amount={amount} dueDate={parseRegionalDateToISO(dueDate, currency) ?? ''} />}
          <FinancialAccountSelector value={financialAccountIds} onChange={setFinancialAccountIds} />

          {/* Cost Centers */}
          {costCenters.length > 0 && (
            <Select
              label="Centro de Custo"
              value={costCenterId}
              onChange={setCostCenterId}
              options={[{ value: '', label: 'Nenhum' }, ...costCenters.map(cc => ({ value: cc.id, label: cc.name }))]}
            />
          )}

          {!directEntry && <>
          {/* Reminder Offset */}
          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Lembrete de Vencimento</Text>
            <View style={styles.chipsRow}>
              {reminderOptions.map((opt) => {
                const isSelected = reminderOffsetDays === opt.value;
                return (
                  <Pressable
                    key={opt.label}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setReminderOffsetDays(opt.value)}
                    style={[
                      styles.selectableChip,
                      {
                        backgroundColor: isSelected ? theme.brandAIBadge : theme.bgElevated,
                        borderColor: isSelected ? theme.brandAI : theme.borderElevated
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        { color: isSelected ? theme.brandAI : theme.textSecondary, fontWeight: isSelected ? '700' : '500' }
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          </>}

          {/* Modal Actions */}

          <View style={styles.modalActions}>
            <Pressable
              accessibilityRole="button"
              onPress={closeModal}
              disabled={isSubmitting}
              style={[styles.cancelButton, { borderColor: theme.borderElevated }]}
            >
              <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancelar</Text>
            </Pressable>

            <Pressable
              accessibilityLabel={submitLabel}
              accessibilityRole="button"
              disabled={isSubmitting || creatingSeries || !formValid}
              onPress={() => void handleSubmit()}
              style={({ pressed }) => [
                styles.submitButton,
                {
                  backgroundColor: isPayable ? theme.expense : theme.income,
                  opacity: (isSubmitting || !formValid) ? 0.6 : pressed ? 0.85 : 1
                }
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {submitLabel}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </ThemedModal>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 16
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
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
  catPill: {
    maxWidth: '100%',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  chipLabel: {
    fontSize: 12
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  container: {
    gap: 18
  },
  emptyCard: {
    alignItems: 'center',
    padding: 36
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic'
  },
  errorBox: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 10
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500'
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4
  },
  filterCard: {
    padding: 12
  },
  filterChip: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  filterChipText: {
    fontSize: 13
  },
  filterChips: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: 6
  },
  filterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between'
  },
  formGroup: {
    gap: 4
  },
  formRow: {
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: 12
  },
  amountField: {
    width: 96,
    maxWidth: '100%'
  },
  amountInput: {
    minHeight: 44
  },
  dateField: {
    flex: 1,
    minWidth: 160
  },
  header: {
    gap: 14
  },
  headerTextWrap: {
    minWidth: 0,
    flexShrink: 1,
    flex: 1,
    gap: 4
  },
  headerTitleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between'
  },
  iconActionButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42
  },
  itemActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6
  },
  itemAmount: {
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    fontWeight: '800'
  },
  itemCard: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14
  },
  itemCardMobile: {
    alignItems: 'stretch',
    flexDirection: 'column',
    padding: 12
  },
  mobileCardContent: {
    gap: 10,
    width: '100%'
  },
  mobileTopRow: {
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%'
  },
  mobileTitleGroup: {
    flexBasis: 160,
    minWidth: 0,
    flexShrink: 1,
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10
  },
  mobileDescWrap: {
    flex: 1,
    gap: 2
  },
  mobileActionsRow: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 2
  },
  mobileSettleButton: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 8
  },
  mobileRightActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6
  },
  itemCat: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700'
  },
  itemDate: {
    fontSize: 12
  },
  itemDesc: {
    fontSize: 15,
    fontWeight: '700'
  },
  itemInfo: {
    flex: 1,
    gap: 4
  },
  itemLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    marginRight: 12
  },
  itemMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  itemReminder: {
    fontSize: 12,
    fontWeight: '600'
  },
  itemRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12
  },
  list: {
    gap: 10
  },
  metricCard: {
    flexBasis: 180,
    flexGrow: 1,
    gap: 4,
    padding: 14
  },
  metricHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600'
  },
  metricSub: {
    fontSize: 11,
    marginTop: 2
  },
  metricValue: {
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    marginTop: 2
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  modalActions: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: 10,
    marginTop: 8
  },
  modalForm: {
    gap: 14
  },
  searchBox: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 240,
    flexDirection: 'row',
    flexGrow: 1,
    gap: 8,
    minHeight: 38,
    paddingHorizontal: 10
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 6
  },
  selectableChip: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  settleButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    height: 36,
    paddingHorizontal: 10
  },
  settleButtonText: {
    fontSize: 12,
    fontWeight: '700'
  },
  submitButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 2,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20
  },
  tabBarWrap: {
    flexDirection: 'row'
  },
  tabPill: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  tabPillContainer: {
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    padding: 4
  },
  tabPillText: {
    fontSize: 13
  },
  textInput: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 42,
    paddingHorizontal: 12
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4
  }
});
