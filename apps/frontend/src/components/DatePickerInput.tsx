import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import {
  formatISOToRegionalDate,
  getDatePlaceholder,
  getLocaleForCurrency,
  parseRegionalDateToISO,
  type SupportedCurrency
} from '../utils/formatters';

export type DatePickerInputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  currency?: SupportedCurrency;
  accessibilityLabel?: string;
};

export function DatePickerInput({
  label,
  value,
  onChangeText,
  currency = 'BRL',
  accessibilityLabel
}: DatePickerInputProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const placeholder = getDatePlaceholder(currency);
  const locale = getLocaleForCurrency(currency);

  // Determine current active month in calendar based on value or today
  const [calendarDate, setCalendarDate] = useState(() => {
    const iso = parseRegionalDateToISO(value, currency);
    if (iso) {
      const [y, m] = iso.split('-').map(Number);
      return new Date(y!, (m || 1) - 1, 1);
    }
    return new Date();
  });

  const monthYearTitle = useMemo(() => {
    const monthName = calendarDate.toLocaleDateString(locale, { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const year = calendarDate.getFullYear();
    return `${capitalizedMonth} ${year}`;
  }, [calendarDate, locale]);

  const weekDayNames = useMemo(() => {
    // Generate Sunday through Saturday localized abbreviations
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(2026, 7, 2 + i);
      const name = d.toLocaleDateString(locale, { weekday: 'narrow' });
      days.push(name.toUpperCase());
    }
    return days;
  }, [locale]);

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const totalCells: Array<{
      day: number;
      monthType: 'prev' | 'current' | 'next';
      iso: string;
    }> = [];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, day);
      const mm = String(prevDate.getMonth() + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      totalCells.push({
        day,
        monthType: 'prev',
        iso: `${prevDate.getFullYear()}-${mm}-${dd}`
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      totalCells.push({
        day,
        monthType: 'current',
        iso: `${year}-${mm}-${dd}`
      });
    }

    // Next month padding to fill complete weeks (up to 35 or 42)
    const remaining = (7 - (totalCells.length % 7)) % 7;
    for (let day = 1; day <= remaining; day++) {
      const nextDate = new Date(year, month + 1, day);
      const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      totalCells.push({
        day,
        monthType: 'next',
        iso: `${nextDate.getFullYear()}-${mm}-${dd}`
      });
    }

    return totalCells;
  }, [calendarDate]);

  const handlePrevMonth = () => {
    setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSelectDate = (iso: string) => {
    const formatted = formatISOToRegionalDate(iso, currency);
    onChangeText(formatted);
    setCalendarOpen(false);
  };

  const handleSelectToday = () => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayIso = `${now.getFullYear()}-${mm}-${dd}`;
    handleSelectDate(todayIso);
  };

  const selectedIso = useMemo(() => {
    return parseRegionalDateToISO(value, currency);
  }, [value, currency]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label} ({placeholder})
      </Text>

      <View style={styles.inputWrapper}>
        <TextInput
          accessibilityLabel={accessibilityLabel || label}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={value}
        />
        <Pressable
          accessibilityLabel="Abrir calendário"
          accessibilityRole="button"
          onPress={() => {
            const iso = parseRegionalDateToISO(value, currency);
            if (iso) {
              const [y, m] = iso.split('-').map(Number);
              setCalendarDate(new Date(y!, (m || 1) - 1, 1));
            }
            setCalendarOpen(true);
          }}
          style={styles.calendarButton}
        >
          <CalendarIcon color="#0f766e" size={18} />
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setCalendarOpen(false)}
        transparent
        visible={calendarOpen}
      >
        <Pressable onPress={() => setCalendarOpen(false)} style={styles.modalOverlay}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{monthYearTitle}</Text>
              <View style={styles.navButtons}>
                <Pressable
                  accessibilityLabel="Mês anterior"
                  accessibilityRole="button"
                  onPress={handlePrevMonth}
                  style={styles.iconButton}
                >
                  <ChevronLeft color="#334155" size={18} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Próximo mês"
                  accessibilityRole="button"
                  onPress={handleNextMonth}
                  style={styles.iconButton}
                >
                  <ChevronRight color="#334155" size={18} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Fechar calendário"
                  accessibilityRole="button"
                  onPress={() => setCalendarOpen(false)}
                  style={styles.iconButton}
                >
                  <X color="#64748b" size={18} />
                </Pressable>
              </View>
            </View>

            <View style={styles.weekRow}>
              {weekDayNames.map((d, index) => (
                <Text key={index} style={styles.weekDayText}>
                  {d}
                </Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {calendarDays.map((item, index) => {
                const isSelected = selectedIso === item.iso;
                const isCurrentMonth = item.monthType === 'current';

                return (
                  <Pressable
                    key={index}
                    accessibilityRole="button"
                    onPress={() => handleSelectDate(item.iso)}
                    style={[
                      styles.dayCell,
                      isSelected && styles.dayCellSelected,
                      !isCurrentMonth && styles.dayCellInactive
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !isCurrentMonth && styles.dayTextInactive,
                        isSelected && styles.dayTextSelected
                      ]}
                    >
                      {item.day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalFooter}>
              <Pressable
                accessibilityRole="button"
                onPress={handleSelectToday}
                style={styles.todayButton}
              >
                <Text style={styles.todayButtonText}>Hoje</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setCalendarOpen(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>Concluir</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { color: '#334155', fontSize: 13, fontWeight: '600' },
  inputWrapper: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row'
  },
  input: {
    color: '#0f172a',
    flex: 1,
    fontSize: 14,
    minHeight: 42,
    paddingHorizontal: 12
  },
  calendarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    maxWidth: 340,
    padding: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    width: '100%'
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700'
  },
  navButtons: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4
  },
  iconButton: {
    borderRadius: 4,
    padding: 6
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4
  },
  weekDayText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    width: 36
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 4
  },
  dayCell: {
    alignItems: 'center',
    borderRadius: 6,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  dayCellInactive: {
    opacity: 0.35
  },
  dayCellSelected: {
    backgroundColor: '#0f766e'
  },
  dayText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '500'
  },
  dayTextInactive: {
    color: '#94a3b8'
  },
  dayTextSelected: {
    color: '#ffffff',
    fontWeight: '700'
  },
  modalFooter: {
    alignItems: 'center',
    borderTopColor: '#f1f5f9',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 10
  },
  todayButton: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  todayButtonText: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '600'
  },
  closeButton: {
    backgroundColor: '#0f766e',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600'
  }
});
