import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ValidatedInput } from '../src/components/ui/ValidatedInput';
import { decimal, integer, isoDate, validEmail } from '../src/utils/validation';
import { parseRegionalDateToISO } from '../src/utils/formatters';
import { CommitmentSchedule, validSchedule, defaultSchedule, scheduleInput } from '../src/components/CommitmentSchedule';
import { ThemeProvider } from '../src/theme/ThemeContext';

test('preserves decimal precision and applies storage limits', () => {
  expect(decimal('9999999999999999,99', 16, true)).toBe('9999999999999999.99');
  expect(decimal('-12,5', 16, true)).toBe('-12.50');
  expect(decimal('0', 16, true)).toBe('0.00');
  for (const invalid of ['0', '-1', 'Infinity', 'NaN', '1e3', '1.234', '1,234.56', '10000000000', '1.']) expect(decimal(invalid)).toBeNull();
  expect(decimal('9999999999.99')).toBe('9999999999.99');
});

test('rejects impossible dates, fractional days and invalid schedule dependencies', () => {
  expect(parseRegionalDateToISO('31/02/2026')).toBeNull();
  expect(parseRegionalDateToISO('29/02/2024')).toBe('2024-02-29');
  expect(isoDate('2026-02-29')).toBe(false);
  expect(integer('1.5', 31)).toBe(false);
  expect(integer('32', 31)).toBe(false);
  expect(validEmail(' user@example.com ')).toBe(true);
  expect(validEmail('user@')).toBe(false);
  expect(validSchedule({ ...defaultSchedule(), mode: 'INSTALLMENTS', first: '3', total: '2' })).toBe(false);
  expect(validSchedule({ ...defaultSchedule(), effective: true, effectiveDate: '' })).toBe(false);
  expect(validSchedule({ ...defaultSchedule(), mode: 'REPEAT', frequency: 'CUSTOM', interval: '0' })).toBe(false);
  const single = { ...defaultSchedule(), frequency: 'CUSTOM', interval: '0' };
  expect(validSchedule(single)).toBe(true);
  expect(scheduleInput(single)).toMatchObject({ frequency: 'MONTHLY', interval: 1 });
});

test('does not mount a preview query with incomplete values', async () => {
  await render(<ThemeProvider><CommitmentSchedule value={defaultSchedule()} onChange={jest.fn()} amount="" dueDate="" /></ThemeProvider>);
  const preview = screen.getByRole('button', { name: 'Conferir parcelas e vencimentos' });
  expect(preview).toBeDisabled();
  await fireEvent.press(preview);
  expect(screen.queryByText('Calculando parcelas...')).toBeNull();
});

test('rejects invalid paste without silently changing the previous amount', async () => {
  function Field() {
    const [value, setValue] = useState('12,50');
    return <ValidatedInput accessibilityLabel="Valor" moneyDigits={10} value={value} onChangeText={setValue} />;
  }
  await render(<Field />);
  for (const invalid of ['abc123', '1e3', '1,234.56', '12.345']) {
    await fireEvent.changeText(screen.getByLabelText('Valor'), invalid);
    expect(screen.getByLabelText('Valor')).toHaveDisplayValue('12,50');
    expect(screen.getByRole('alert')).toBeOnTheScreen();
  }
  await fireEvent.changeText(screen.getByLabelText('Valor'), '25.75');
  expect(screen.getByLabelText('Valor')).toHaveDisplayValue('25.75');
  expect(screen.queryByRole('alert')).toBeNull();
});
