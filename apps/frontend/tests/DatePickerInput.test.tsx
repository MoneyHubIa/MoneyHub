import { fireEvent, render, screen } from '@testing-library/react-native';
import { DatePickerInput } from '../src/components/DatePickerInput';

describe('DatePickerInput', () => {
  test('edits text and selects a calendar date', async () => {
    const onChangeText = jest.fn();
    await render(
      <DatePickerInput
        accessibilityLabel="Data de vencimento"
        label="Vencimento"
        onChangeText={onChangeText}
        value="15/09/2026"
      />
    );

    await fireEvent.changeText(screen.getByLabelText('Data de vencimento'), '16/09/2026');
    expect(onChangeText).toHaveBeenCalledWith('16/09/2026');

    await fireEvent.press(screen.getByRole('button', { name: 'Abrir calendário' }));
    expect(screen.getByText('Setembro 2026')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Mês anterior' }));
    expect(screen.getByText('Agosto 2026')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Próximo mês' }));

    await fireEvent.press(screen.getAllByText('20')[0]!);
    expect(onChangeText).toHaveBeenLastCalledWith('20/09/2026');
  });

  test('selects today and can close without changing the value', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-15T12:00:00.000Z'));
    const onChangeText = jest.fn();
    await render(
      <DatePickerInput label="Date" currency="USD" onChangeText={onChangeText} value="" />
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Abrir calendário' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Concluir' }));
    expect(onChangeText).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Abrir calendário' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Hoje' }));
    expect(onChangeText).toHaveBeenCalledWith('09/15/2026');

    jest.useRealTimers();
  });
});
