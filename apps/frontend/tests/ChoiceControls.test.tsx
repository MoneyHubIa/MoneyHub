import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { ToggleButton, ChoiceButton } from '../src/components/ui';

test.each(['light', 'dark'] as const)('toggles Sim/Não with an accessible checked state in %s theme', async mode => {
  function Control() {
    const [value, setValue] = useState(false);
    return <ToggleButton label="Já efetivada" value={value} onChange={setValue} />;
  }
  await render(<ThemeProvider initialMode={mode}><Control /></ThemeProvider>);
  expect(screen.getByRole('switch', { name: 'Já efetivada' })).toHaveProp('accessibilityState', { checked: false, disabled: false });
  expect(screen.getByText('Não')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('switch', { name: 'Já efetivada' }));
  expect(screen.getByRole('switch', { name: 'Já efetivada' })).toHaveProp('accessibilityState', { checked: true, disabled: false });
  expect(screen.getByText('Sim')).toBeOnTheScreen();
});

test('disabled controls preserve selection and never call handlers', async () => {
  const changed = jest.fn();
  await render(<ThemeProvider>
    <ToggleButton label="Conta padrão" value={false} onChange={changed} disabled />
    <ChoiceButton title="Mensal" selected onPress={changed} disabled />
  </ThemeProvider>);
  await fireEvent.press(screen.getByRole('switch', { name: 'Conta padrão' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Mensal' }));
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Mensal' })).toHaveProp('accessibilityState', { selected: true, disabled: true });
});
