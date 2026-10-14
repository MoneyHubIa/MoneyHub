import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Button, Text, View } from 'react-native';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { tokens } from '../src/theme/tokens';

function ThemeProbe() {
  const { mode, isDark, theme, toggleTheme, setThemeMode } = useTheme();
  return (
    <View>
      <Text testID="mode">{mode}</Text>
      <Text testID="isDark">{isDark ? 'dark-yes' : 'dark-no'}</Text>
      <Text testID="bgPrimary">{theme.bgPrimary}</Text>
      <Text testID="bgSurface">{theme.bgSurface}</Text>
      <Text testID="income">{theme.income}</Text>
      <Text testID="expense">{theme.expense}</Text>
      <Button title="Toggle" onPress={toggleTheme} />
      <Button title="SetLight" onPress={() => setThemeMode('light')} />
      <Button title="SetDark" onPress={() => setThemeMode('dark')} />
    </View>
  );
}

describe('ThemeContext', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('provides dark mode by default when no value stored', async () => {
    await render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByText('dark')).toBeOnTheScreen();
    expect(screen.getByText('dark-yes')).toBeOnTheScreen();
    expect(screen.getByText('#0B0F19')).toBeOnTheScreen();
    expect(screen.getByText('#111827')).toBeOnTheScreen();
    expect(screen.getByText('#10B981')).toBeOnTheScreen();
    expect(screen.getByText('#F43F5E')).toBeOnTheScreen();
  });

  it('toggles theme to light mode and persists to AsyncStorage', async () => {
    await render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Toggle' }));

    await waitFor(() => {
      expect(screen.getByText('light')).toBeOnTheScreen();
    });

    expect(screen.getByText('dark-no')).toBeOnTheScreen();
    expect(screen.getByText('#F8FAFC')).toBeOnTheScreen();
    expect(screen.getByText('#FFFFFF')).toBeOnTheScreen();

    const stored = await AsyncStorage.getItem('@moneyhub:theme_mode');
    expect(stored).toBe('light');
  });

  it('sets theme mode explicitly', async () => {
    await render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await fireEvent.press(screen.getByRole('button', { name: 'SetLight' }));
    await waitFor(() => {
      expect(screen.getByText('light')).toBeOnTheScreen();
    });

    await fireEvent.press(screen.getByRole('button', { name: 'SetDark' }));
    await waitFor(() => {
      expect(screen.getByText('dark')).toBeOnTheScreen();
    });
  });

  it('loads existing stored theme mode on initialization', async () => {
    await AsyncStorage.setItem('@moneyhub:theme_mode', 'light');

    await render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('light')).toBeOnTheScreen();
    });

    expect(screen.getByText('dark-no')).toBeOnTheScreen();
    expect(screen.getByText(tokens.light.bgPrimary)).toBeOnTheScreen();
  });
});
