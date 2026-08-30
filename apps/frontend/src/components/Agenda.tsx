import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { ChevronLeft, ChevronRight, Pencil, PlusCircle, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { DatePickerInput } from './DatePickerInput';
import { formatISOToRegionalDate, parseRegionalDateToISO } from '../utils/formatters';

const MY_AGENDA_QUERY = gql`
  query MyAgenda($input: AgendaRangeInput!) {
    myAgenda(input: $input) {
      id
      source
      title
      scheduledDate
      status
      notes
      recurrenceRule
      recurrenceEndDate
      reminderOffsetDays
    }
  }
`;

const CREATE_CALENDAR_EVENT = gql`
  mutation CreateCalendarEvent($input: CreateCalendarEventInput!) {
    createCalendarEvent(input: $input) {
      id
      title
      scheduledDate
    }
  }
`;

const UPDATE_CALENDAR_EVENT = gql`
  mutation UpdateCalendarEvent($input: UpdateCalendarEventInput!) {
    updateCalendarEvent(input: $input) {
      id
      title
      scheduledDate
    }
  }
`;

const DELETE_CALENDAR_EVENT = gql`
  mutation DeleteCalendarEvent($id: ID!) {
    deleteCalendarEvent(id: $id)
  }
`;

type AgendaItem = {
  id: string;
  source: 'EVENT' | 'PAYABLE' | 'RECEIVABLE';
  title: string;
  scheduledDate: string;
  status: string;
  notes?: string | null;
  recurrenceRule?: RecurrenceRule;
  recurrenceEndDate?: string | null;
  reminderOffsetDays?: number | null;
};

type RecurrenceRule = 'WEEKLY' | 'MONTHLY' | 'YEARLY' | null;

const recurrenceOptions: Array<{ label: string; value: RecurrenceRule }> = [
  { label: 'Sem recorrência', value: null },
  { label: 'Semanal', value: 'WEEKLY' },
  { label: 'Mensal', value: 'MONTHLY' },
  { label: 'Anual', value: 'YEARLY' }
];

const reminderOptions: Array<{ label: string; value: number | null }> = [
  { label: 'Sem lembrete', value: null },
  { label: 'No dia', value: 0 },
  { label: '1 dia antes', value: 1 },
  { label: '3 dias antes', value: 3 },
  { label: '7 dias antes', value: 7 }
];

function toIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function dateForIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year!, (month ?? 1) - 1, day ?? 1);
}

function monthRange(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  return {
    startDate: `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`,
    endDate: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(new Date(year, monthIndex + 1, 0).getDate()).padStart(2, '0')}`
  };
}

function monthTitle(month: Date): string {
  const value = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function dayTitle(iso: string): string {
  return dateForIso(iso).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function sourceLabel(source: AgendaItem['source']): string {
  if (source === 'PAYABLE') return 'Conta a pagar';
  if (source === 'RECEIVABLE') return 'Conta a receber';
  return 'Evento';
}

function calendarEventIdFromAgendaId(id: string): string {
  return /^EVENT:(.+):\d{4}-\d{2}-\d{2}$/.exec(id)?.[1] ?? id;
}

export function Agenda() {
  const today = useMemo(() => new Date(), []);
  const [activeMonth, setActiveMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(today));
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(() => formatISOToRegionalDate(toIsoDate(today), 'BRL'));
  const [notes, setNotes] = useState('');
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(null);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [reminderOffsetDays, setReminderOffsetDays] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const range = useMemo(() => monthRange(activeMonth), [activeMonth]);
  const { data, loading, refetch } = useQuery<{ myAgenda: AgendaItem[] }>(MY_AGENDA_QUERY, {
    variables: { input: range },
    fetchPolicy: 'cache-and-network'
  });
  const [createCalendarEvent, { loading: creating }] = useMutation(CREATE_CALENDAR_EVENT, {
    onCompleted: () => resetForm(),
    onError: (error) => setErrorMessage(error.message)
  });
  const [updateCalendarEvent, { loading: updating }] = useMutation(UPDATE_CALENDAR_EVENT, {
    onCompleted: () => resetForm(),
    onError: (error) => setErrorMessage(error.message)
  });
  const [deleteCalendarEvent, { loading: deleting }] = useMutation(DELETE_CALENDAR_EVENT, {
    onCompleted: () => refetch(),
    onError: (error) => setErrorMessage(error.message)
  });

  const items = data?.myAgenda ?? [];
  const selectedItems = items.filter((item) => item.scheduledDate === selectedDate);
  const datesWithItems = new Set(items.map((item) => item.scheduledDate));
  const monthDays = useMemo(() => {
    const year = activeMonth.getFullYear();
    const month = activeMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const dayCount = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: firstDay + dayCount }, (_, index) => {
      if (index < firstDay) return null;
      const day = index - firstDay + 1;
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    });
  }, [activeMonth]);

  function resetForm() {
    setTitle('');
    setEventDate(formatISOToRegionalDate(selectedDate, 'BRL'));
    setNotes('');
    setRecurrenceRule(null);
    setRecurrenceEndDate('');
    setReminderOffsetDays(null);
    setEditingId(null);
    setErrorMessage(null);
    refetch();
  }

  async function handleSave() {
    const scheduledDate = parseRegionalDateToISO(eventDate, 'BRL');
    const endDate = recurrenceEndDate
      ? parseRegionalDateToISO(recurrenceEndDate, 'BRL')
      : null;
    if (!title.trim()) {
      setErrorMessage('Informe um título para o evento.');
      return;
    }
    if (!scheduledDate) {
      setErrorMessage('Informe uma data válida.');
      return;
    }
    if (recurrenceRule && recurrenceEndDate && !endDate) {
      setErrorMessage('Informe um fim de recorrência válido.');
      return;
    }
    if (!recurrenceRule && recurrenceEndDate) {
      setErrorMessage('Selecione uma recorrência para informar o fim.');
      return;
    }

    setErrorMessage(null);
    if (editingId) {
      await updateCalendarEvent({
        variables: {
          input: {
            id: editingId,
            title: title.trim(),
            scheduledDate,
            recurrenceRule,
            recurrenceEndDate: endDate,
            notes: notes.trim() || null,
            reminderOffsetDays
          }
        }
      });
      return;
    }
    await createCalendarEvent({
      variables: {
        input: {
          title: title.trim(),
          scheduledDate,
          recurrenceRule,
          recurrenceEndDate: endDate,
          notes: notes.trim() || null,
          reminderOffsetDays
        }
      }
    });
  }

  function handleSelectDate(iso: string) {
    setSelectedDate(iso);
    setEventDate(formatISOToRegionalDate(iso, 'BRL'));
  }

  function handleEdit(item: AgendaItem) {
    setEditingId(calendarEventIdFromAgendaId(item.id));
    setTitle(item.title);
    setEventDate(formatISOToRegionalDate(item.scheduledDate, 'BRL'));
    setNotes(item.notes ?? '');
    setRecurrenceRule(item.recurrenceRule ?? null);
    setRecurrenceEndDate(item.recurrenceEndDate ? formatISOToRegionalDate(item.recurrenceEndDate, 'BRL') : '');
    setReminderOffsetDays(item.reminderOffsetDays ?? null);
    setSelectedDate(item.scheduledDate);
    setErrorMessage(null);
  }

  function handleChangeMonth(offset: number) {
    setActiveMonth((value) => {
      const month = new Date(value.getFullYear(), value.getMonth() + offset, 1);
      setSelectedDate(toIsoDate(month));
      setEventDate(formatISOToRegionalDate(toIsoDate(month), 'BRL'));
      return month;
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Planejamento financeiro</Text>
        <Text accessibilityRole="header" style={styles.title}>Agenda financeira</Text>
        <Text style={styles.subtitle}>Eventos, contas a pagar e contas a receber em um calendário mensal.</Text>
      </View>

      <View style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <Pressable accessibilityLabel="Mês anterior" accessibilityRole="button" onPress={() => handleChangeMonth(-1)} style={styles.iconButton}>
            <ChevronLeft color="#334155" size={20} />
          </Pressable>
          <Text accessibilityRole="header" style={styles.monthTitle}>{monthTitle(activeMonth)}</Text>
          <Pressable accessibilityLabel="Próximo mês" accessibilityRole="button" onPress={() => handleChangeMonth(1)} style={styles.iconButton}>
            <ChevronRight color="#334155" size={20} />
          </Pressable>
        </View>
        <View style={styles.weekRow}>
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekDay}>{day}</Text>)}
        </View>
        <View style={styles.daysGrid}>
          {monthDays.map((iso, index) => iso ? (
            <Pressable
              accessibilityLabel={dayTitle(iso)}
              accessibilityRole="button"
              key={iso}
              onPress={() => handleSelectDate(iso)}
              style={[styles.dayCell, selectedDate === iso && styles.dayCellSelected]}
            >
              <Text style={[styles.dayNumber, selectedDate === iso && styles.dayNumberSelected]}>{dateForIso(iso).getDate()}</Text>
              {datesWithItems.has(iso) ? <View accessibilityLabel="Possui compromissos" style={styles.dayMarker} /> : null}
            </Pressable>
          ) : <View key={`blank-${index}`} style={styles.dayCell} />)}
        </View>
      </View>

      <View style={styles.dayListCard}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Compromissos em {dayTitle(selectedDate)}</Text>
        {loading ? <ActivityIndicator color="#0f766e" size="small" /> : selectedItems.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum compromisso neste dia.</Text>
        ) : (
          <View style={styles.itemsList}>
            {selectedItems.map((item) => (
              <View key={`${item.source}-${item.id}`} style={styles.agendaItem}>
                <View style={styles.itemCopy}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={[styles.sourceBadge, item.source === 'EVENT' ? styles.eventBadge : item.source === 'PAYABLE' ? styles.payableBadge : styles.receivableBadge]}>{sourceLabel(item.source)}</Text>
                </View>
                {item.source === 'EVENT' ? <View style={styles.itemActions}>
                  <Pressable accessibilityLabel={`Editar ${item.title}`} accessibilityRole="button" onPress={() => handleEdit(item)} style={styles.smallButton}><Pencil color="#0f766e" size={16} /></Pressable>
                  <Pressable accessibilityLabel={`Excluir ${item.title}`} accessibilityRole="button" disabled={deleting} onPress={() => deleteCalendarEvent({ variables: { id: calendarEventIdFromAgendaId(item.id) } })} style={styles.smallButton}><Trash2 color="#dc2626" size={16} /></Pressable>
                </View> : null}
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>{editingId ? 'Editar evento' : 'Novo evento'}</Text>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Título</Text>
          <TextInput accessibilityLabel="Título do evento" onChangeText={setTitle} placeholder="Ex: Renovar seguro" placeholderTextColor="#94a3b8" style={styles.input} value={title} />
        </View>
        <DatePickerInput accessibilityLabel="Data do evento" label="Data" onChangeText={setEventDate} value={eventDate} />
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Notas</Text>
          <TextInput accessibilityLabel="Notas do evento" multiline onChangeText={setNotes} placeholder="Ex: Apólice, instruções ou contexto" placeholderTextColor="#94a3b8" style={[styles.input, styles.notesInput]} value={notes} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Recorrência</Text>
          <View style={styles.optionRow}>{recurrenceOptions.map((option) => <Pressable accessibilityRole="button" key={option.label} onPress={() => { setRecurrenceRule(option.value); if (!option.value) setRecurrenceEndDate(''); }} style={[styles.optionButton, recurrenceRule === option.value && styles.optionButtonSelected]}><Text style={[styles.optionText, recurrenceRule === option.value && styles.optionTextSelected]}>{option.label}</Text></Pressable>)}</View>
        </View>
        {recurrenceRule ? <DatePickerInput accessibilityLabel="Fim da recorrência" label="Fim da recorrência" onChangeText={setRecurrenceEndDate} value={recurrenceEndDate} /> : null}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Lembrete</Text>
          <View style={styles.optionRow}>{reminderOptions.map((option) => <Pressable accessibilityRole="button" key={option.label} onPress={() => setReminderOffsetDays(option.value)} style={[styles.optionButton, reminderOffsetDays === option.value && styles.optionButtonSelected]}><Text style={[styles.optionText, reminderOffsetDays === option.value && styles.optionTextSelected]}>{option.label}</Text></Pressable>)}</View>
        </View>
        <Pressable accessibilityRole="button" disabled={creating || updating} onPress={handleSave} style={[styles.submitButton, (creating || updating) && styles.submitButtonDisabled]}>
          {creating || updating ? <ActivityIndicator color="#ffffff" size="small" /> : <><PlusCircle color="#ffffff" size={18} /><Text style={styles.submitButtonText}>{editingId ? 'Atualizar evento' : 'Salvar evento'}</Text></>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20 }, header: { gap: 8 }, eyebrow: { color: '#0f766e', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }, title: { color: '#0f172a', fontSize: 30, fontWeight: '700' }, subtitle: { color: '#64748b', fontSize: 16, lineHeight: 24 },
  calendarCard: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: 8, borderWidth: 1, gap: 12, padding: 16 }, calendarHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, iconButton: { borderRadius: 6, padding: 8 }, monthTitle: { color: '#0f172a', fontSize: 18, fontWeight: '700' }, weekRow: { flexDirection: 'row' }, weekDay: { color: '#64748b', flex: 1, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' }, dayCell: { alignItems: 'center', flexBasis: '14.2857%', minHeight: 54, paddingTop: 8 }, dayCellSelected: { backgroundColor: '#ccfbf1', borderRadius: 6 }, dayNumber: { color: '#0f172a', fontSize: 14, fontWeight: '600' }, dayNumberSelected: { color: '#0f766e', fontWeight: '800' }, dayMarker: { backgroundColor: '#0f766e', borderRadius: 3, height: 6, marginTop: 5, width: 6 },
  dayListCard: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: 8, borderWidth: 1, gap: 12, padding: 16 }, sectionTitle: { color: '#0f172a', fontSize: 18, fontWeight: '700' }, emptyText: { color: '#64748b', fontSize: 14 }, itemsList: { gap: 8 }, agendaItem: { alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 6, flexDirection: 'row', justifyContent: 'space-between', padding: 12 }, itemCopy: { gap: 5, flex: 1 }, itemTitle: { color: '#0f172a', fontSize: 15, fontWeight: '600' }, sourceBadge: { alignSelf: 'flex-start', borderRadius: 4, fontSize: 11, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2 }, eventBadge: { backgroundColor: '#ccfbf1', color: '#0f766e' }, payableBadge: { backgroundColor: '#fee2e2', color: '#b91c1c' }, receivableBadge: { backgroundColor: '#dcfce7', color: '#15803d' }, itemActions: { flexDirection: 'row', gap: 4 }, smallButton: { padding: 6 },
  formCard: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: 8, borderWidth: 1, gap: 14, padding: 16 }, errorText: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderRadius: 6, borderWidth: 1, color: '#b91c1c', padding: 10 }, inputGroup: { gap: 6 }, label: { color: '#334155', fontSize: 13, fontWeight: '600' }, input: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1', borderRadius: 6, borderWidth: 1, color: '#0f172a', fontSize: 14, minHeight: 42, paddingHorizontal: 12 }, notesInput: { minHeight: 82, paddingTop: 10, textAlignVertical: 'top' }, optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, optionButton: { borderColor: '#cbd5e1', borderRadius: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 }, optionButtonSelected: { backgroundColor: '#0f766e', borderColor: '#0f766e' }, optionText: { color: '#475569', fontSize: 12, fontWeight: '600' }, optionTextSelected: { color: '#ffffff' }, submitButton: { alignItems: 'center', backgroundColor: '#0f766e', borderRadius: 6, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 44, paddingHorizontal: 16 }, submitButtonDisabled: { opacity: 0.65 }, submitButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' }
});
