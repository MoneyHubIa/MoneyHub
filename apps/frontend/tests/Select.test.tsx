import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Select } from '../src/components/ui/Select';
import { ThemeProvider } from '../src/theme/ThemeContext';

test('opens, selects, closes, and allows dismissing without changing the value', async () => {
  const changed = jest.fn();
  function Form() {
    const [value, setValue] = useState('ONCE');
    return <Select label="Parcelamento" value={value} onChange={next => { setValue(next); changed(next); }} options={[
      { value: 'ONCE', label: 'Não recorrente' }, { value: 'INSTALLMENTS', label: 'Parcelar ou Repetir' }
    ]} />;
  }
  await render(<ThemeProvider><Form /></ThemeProvider>);
  const selector = screen.getByRole('button', { name: 'Parcelamento' });
  expect(screen.queryByRole('button', { name: 'Parcelar ou Repetir' })).toBeNull();
  await fireEvent.press(selector);
  expect(selector).toHaveProp('accessibilityState', expect.objectContaining({ expanded: true }));
  expect(screen.getByRole('button', { name: 'Não recorrente' })).toHaveProp('accessibilityState', { selected: true });
  expect(screen.getByRole('button', { name: 'Parcelar ou Repetir' })).toHaveProp('accessibilityState', { selected: false });
  await fireEvent.press(screen.getByRole('button', { name: 'Parcelar ou Repetir' }));
  expect(changed).toHaveBeenCalledWith('INSTALLMENTS');
  expect(selector).toHaveProp('accessibilityValue', { text: 'Parcelar ou Repetir' });
  expect(selector).toHaveProp('accessibilityState', expect.objectContaining({ expanded: false }));
  expect(screen.queryByRole('button', { name: 'Não recorrente' })).toBeNull();
  await fireEvent.press(selector);
  await fireEvent.press(selector);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(selector).toHaveProp('accessibilityState', expect.objectContaining({ expanded: false }));
});

test('disables an empty selector with a visible placeholder', async () => {
  const changed = jest.fn();
  await render(<ThemeProvider><Select label="Conta financeira" value="" onChange={changed} options={[]} placeholder="Nenhuma conta disponível" /></ThemeProvider>);
  const selector = screen.getByRole('button', { name: 'Conta financeira' });
  expect(selector).toBeDisabled();
  expect(screen.getByText('Nenhuma conta disponível')).toBeOnTheScreen();
  await fireEvent.press(selector);
  expect(changed).not.toHaveBeenCalled();
});
