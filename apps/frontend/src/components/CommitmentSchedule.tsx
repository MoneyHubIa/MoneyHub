import { Button, ChoiceButton, NumberStepper, Select, ToggleButton } from './ui';
import { decimal, integer, isoDate } from '../utils/validation';
import { ValidatedInput as TextInput } from './ui/ValidatedInput';
import React, { useState } from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

type Override = { number: number; amount?: string; dueDate?: string; effectiveDate?: string | null };
export type CommitmentScheduleValue = { mode: string; first: string; total: string; frequency: string; interval: string; unit: string; effective: boolean; effectiveDate: string; overrides?: Override[] };
export const defaultSchedule = (): CommitmentScheduleValue => ({ mode: 'ONCE', first: '1', total: '1', frequency: 'MONTHLY', interval: '1', unit: 'MONTHS', effective: false, effectiveDate: new Date().toISOString().slice(0, 10) });
export function validSchedule(value: CommitmentScheduleValue): boolean {
  const repeated = ['INSTALLMENTS', 'REPEAT'].includes(value.mode);
  return (!repeated || (integer(value.first) && integer(value.total) && Number(value.first) <= Number(value.total))) && (!repeated || value.frequency !== 'CUSTOM' || integer(value.interval)) && (!value.effective || isoDate(value.effectiveDate)) && (value.overrides ?? []).every(o => (o.amount === undefined || !!decimal(o.amount)) && (o.dueDate === undefined || isoDate(o.dueDate)) && (o.effectiveDate == null || isoDate(o.effectiveDate)));
}

export function scheduleInput(value: CommitmentScheduleValue) {
  const repeated = ['INSTALLMENTS', 'REPEAT'].includes(value.mode);
  return { mode: value.mode, first: repeated ? Number(value.first) : 1, total: repeated ? Number(value.total) : value.mode === 'FIXED' ? 12 : 1, frequency: repeated ? value.frequency : 'MONTHLY', interval: repeated && value.frequency === 'CUSTOM' ? Number(value.interval) : 1, unit: repeated && value.frequency === 'CUSTOM' ? value.unit : 'MONTHS' };
}

export function CommitmentSchedule({ value, onChange, amount, dueDate, singleEntry = false }: { singleEntry?: boolean; value: CommitmentScheduleValue; onChange: (v: CommitmentScheduleValue) => void; amount: string; dueDate: string }) {
  const { theme } = useTheme();
  const [preview, setPreview] = useState(false);
  const field = (key: keyof CommitmentScheduleValue, label: string) => <View><Text style={{ color: theme.textSecondary }}>{label}</Text><TextInput integerOnly={['first', 'total', 'interval'].includes(key)} maxLength={key === 'effectiveDate' ? 10 : undefined} accessibilityLabel={label} value={String(value[key])} onChangeText={text => onChange({ ...value, [key]: text })} style={{ minHeight: 44, color: theme.textPrimary, borderWidth: 1, borderColor: theme.borderElevated, padding: 12, borderRadius: 8 }} /></View>;
  const choices = (key: 'unit', options: string[][]) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{options.map(([id, label]) => <ChoiceButton key={id} title={label!} selected={value[key] === id} onPress={() => onChange({ ...value, [key]: id! })} />)}</View>;
  return <View style={{ gap: 12 }}>
    <Select label="Parcelamento" value={value.mode} onChange={mode => onChange({ ...value, mode })} options={[
      { value: 'ONCE', label: 'Não recorrente' },
      { value: 'INSTALLMENTS', label: 'Parcelar ou Repetir' },
      { value: 'FIXED', label: 'Fixa mensal' }
    ]} />
    {['INSTALLMENTS', 'REPEAT'].includes(value.mode) && <>
      <NumberStepper label="Parcela inicial" value={value.first} onChange={first => onChange({ ...value, first })} />
      <NumberStepper label="Total de parcelas" value={value.total} onChange={total => onChange({ ...value, total })} />
      <View style={styles.compactField}>
        <Select compact label="Frequência" value={value.frequency} onChange={frequency => onChange({ ...value, frequency })} options={[
          { value: 'DAILY', label: 'Diário' },
          { value: 'WEEKLY', label: 'Semanal' },
          { value: 'MONTHLY', label: 'Mensal' },
          { value: 'QUARTERLY', label: 'Trimestral' },
          { value: 'YEARLY', label: 'Anual' },
          { value: 'CUSTOM', label: 'Personalizar' }
        ]} />
      </View>
    </>}
    {value.mode !== 'ONCE' && <Text style={{ color: theme.textSecondary }}>{value.mode === 'INSTALLMENTS' ? 'Valor informado será dividido pelo total de parcelas.' : 'Valor informado será repetido em cada vencimento.'}</Text>}
    {['INSTALLMENTS', 'REPEAT'].includes(value.mode) && value.frequency === 'CUSTOM' && <>{field('interval', 'Intervalo')}{choices('unit', [['DAYS', 'Dias'], ['WEEKS', 'Semanas'], ['MONTHS', 'Meses']])}</>}
    <ToggleButton compact singleLineLabel accessibilityLabel="Já efetivada" label={`Já efetivada${value.mode !== 'ONCE' ? value.mode === 'FIXED' ? ' (primeira ocorrência)' : ' (ocorrências geradas)' : ''}`} value={value.effective} onChange={effective => onChange({ ...value, effective })} />
    {value.effective && !(singleEntry && value.mode === 'ONCE') && field('effectiveDate', 'Data de efetivação (YYYY-MM-DD)')}
    {!(singleEntry && value.mode === 'ONCE') && <Button title="Conferir parcelas e vencimentos" variant="secondary" disabled={!decimal(amount) || !isoDate(dueDate) || !validSchedule(value)} onPress={() => setPreview(p => !p)} style={{ minHeight: 48 }} />}
    {!(singleEntry && value.mode === 'ONCE') && preview && !!decimal(amount) && isoDate(dueDate) && validSchedule(value) && <SchedulePreview value={value} onChange={onChange} amount={amount} dueDate={dueDate} />}
  </View>;
}

const styles = StyleSheet.create({
  compactField: { width: 136, maxWidth: '100%', alignSelf: 'flex-start' }
});

function SchedulePreview({ value, onChange, amount, dueDate }: { value: CommitmentScheduleValue; onChange: (v: CommitmentScheduleValue) => void; amount: string; dueDate: string }) {
  const { theme } = useTheme();
  const { data, error, loading } = useQuery<{ previewCommitmentSeries: { number: number; amount: string; dueDate: string }[] }>(gql`query PreviewCommitmentSeries($amount:String!, $dueDate:String!, $schedule:ScheduleInput!) { previewCommitmentSeries(amount:$amount,dueDate:$dueDate,schedule:$schedule) { number amount dueDate } }`, {
    variables: { amount: decimal(amount), dueDate, schedule: scheduleInput(value) }
  });
  const update = (number: number, patch: Omit<Override, 'number'>) => {
    const overrides = value.overrides ?? [];
    onChange({ ...value, overrides: [...overrides.filter(o => o.number !== number), { ...overrides.find(o => o.number === number), number, ...patch }] });
  };
  return <View style={{ gap: 12 }}>
    {loading && <Text style={{ color: theme.textSecondary }}>Calculando parcelas...</Text>}
    {error && <Text accessibilityRole="alert" style={{ color: theme.expense }}>{error.message}</Text>}
    {data?.previewCommitmentSeries.map(part => {
      const override = value.overrides?.find(o => o.number === part.number);
      return <View key={part.number} style={{ gap: 6 }}>
        <Text style={{ color: theme.textPrimary }}>Parcela {part.number}</Text>
        <TextInput moneyDigits={10} accessibilityLabel={`Valor da parcela ${part.number}`} value={override?.amount ?? part.amount} onChangeText={text => update(part.number, { amount: text.replace(',', '.') })} style={{ color: theme.textPrimary, minHeight: 44, borderWidth: 1, borderColor: theme.borderElevated, padding: 12 }} />
        <TextInput maxLength={10} accessibilityLabel={`Vencimento da parcela ${part.number}`} value={override?.dueDate ?? part.dueDate} onChangeText={text => update(part.number, { dueDate: text })} style={{ color: theme.textPrimary, minHeight: 44, borderWidth: 1, borderColor: theme.borderElevated, padding: 12 }} />
        <ToggleButton label="Efetivada" accessibilityLabel={`Parcela ${part.number} efetivada`} value={override?.effectiveDate !== undefined ? override.effectiveDate !== null : value.effective} onChange={effective => update(part.number, { effectiveDate: effective ? value.effectiveDate : null })} />
      </View>;
    })}
  </View>;
}
