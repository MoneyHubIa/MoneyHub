import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { Badge } from '../src/components/ui/Badge';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { Input } from '../src/components/ui/Input';
import { KpiCard } from '../src/components/ui/KpiCard';
import { ProgressBar } from '../src/components/ui/ProgressBar';
import { ThemedModal } from '../src/components/ui/ThemedModal';
import { ThemeProvider } from '../src/theme/ThemeContext';

describe('UI Primitives', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider>{children}</ThemeProvider>
  );

  describe('Card', () => {
    it('renders card content with proper accessibility and text', async () => {
      await render(
        <Card testID="test-card">
          <Text>Card Content</Text>
        </Card>,
        { wrapper }
      );

      expect(screen.getByText('Card Content')).toBeOnTheScreen();
    });
  });

  describe('KpiCard', () => {
    it('renders KPI title, value and supports masked values', async () => {
      await render(
        <KpiCard
          title="Saldo Atual"
          value="R$ 10.000,00"
          subtext="Saldo projetado: R$ 12.000,00"
          isMasked={false}
        />,
        { wrapper }
      );

      expect(screen.getByText('Saldo Atual')).toBeOnTheScreen();
      expect(screen.getByText('R$ 10.000,00')).toBeOnTheScreen();
      expect(screen.getByText('Saldo projetado: R$ 12.000,00')).toBeOnTheScreen();
    });

    it('renders masked value when isMasked is true', async () => {
      await render(
        <KpiCard
          title="Saldo Atual"
          value="R$ 10.000,00"
          isMasked={true}
        />,
        { wrapper }
      );

      expect(screen.getByText('Saldo Atual')).toBeOnTheScreen();
      expect(screen.getByText('R$ ••••••')).toBeOnTheScreen();
    });
  });

  describe('Badge', () => {
    it('renders semantic badge with label', async () => {
      await render(<Badge label="Receita" tone="income" />, { wrapper });
      expect(screen.getByText('Receita')).toBeOnTheScreen();
    });
  });

  describe('Button', () => {
    it('renders button and responds to press', async () => {
      const onPressMock = jest.fn();
      await render(
        <Button title="Salvar" onPress={onPressMock} variant="primary" />,
        { wrapper }
      );

      const button = screen.getByRole('button', { name: 'Salvar' });
      expect(button).toBeOnTheScreen();
      await fireEvent.press(button);
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    it('shows loading indicator when loading is true', async () => {
      await render(
        <Button title="Salvar" onPress={jest.fn()} loading={true} />,
        { wrapper }
      );

      expect(screen.getByTestId('button-loading')).toBeOnTheScreen();
    });
  });

  describe('ThemedModal', () => {
    it('renders modal with title and close button when visible', async () => {
      const onCloseMock = jest.fn();
      await render(
        <ThemedModal visible={true} onClose={onCloseMock} title="Novo Lançamento">
          <Text>Modal Body Content</Text>
        </ThemedModal>,
        { wrapper }
      );

      expect(screen.getByText('Novo Lançamento')).toBeOnTheScreen();
      expect(screen.getByText('Modal Body Content')).toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: 'Fechar modal' }));
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Input', () => {
    it('renders input with label and handles text changes', async () => {
      const onChangeMock = jest.fn();
      await render(
        <Input
          label="Nome da Conta"
          placeholder="Ex: Aluguel"
          value=""
          onChangeText={onChangeMock}
        />,
        { wrapper }
      );

      expect(screen.getByText('Nome da Conta')).toBeOnTheScreen();
      const input = screen.getByPlaceholderText('Ex: Aluguel');
      await fireEvent.changeText(input, 'Conta de Luz');
      expect(onChangeMock).toHaveBeenCalledWith('Conta de Luz');
    });

    it('displays error message when error prop is provided', async () => {
      await render(
        <Input
          label="Email"
          value=""
          onChangeText={jest.fn()}
          error="Email inválido"
        />,
        { wrapper }
      );

      expect(screen.getByText('Email inválido')).toBeOnTheScreen();
    });
  });

  describe('ProgressBar', () => {
    it('renders progress bar', async () => {
      await render(<ProgressBar progress={0.75} color="#10B981" />, { wrapper });
      expect(screen.getByTestId('progress-bar')).toBeOnTheScreen();
    });
  });
});
