import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { AppHeader } from '../src/components/layout/AppHeader';
import { BottomNavBar } from '../src/components/layout/BottomNavBar';
import { QuickActionModal } from '../src/components/layout/QuickActionModal';
import { QuickPills } from '../src/components/layout/QuickPills';
import { Sidebar } from '../src/components/layout/Sidebar';
import { ThemeProvider } from '../src/theme/ThemeContext';

describe('Layout Components', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider>{children}</ThemeProvider>
  );

  describe('Sidebar', () => {
    it('renders 7 primary modules and fires onSelectSection', async () => {
      const onSelectMock = jest.fn();
      await render(
        <Sidebar
          activeSection="dashboard"
          onSelectSection={onSelectMock}
          pendingPayablesCount={3}
          pendingReceivablesCount={1}
          onQuickAction={jest.fn()}
          onLogout={jest.fn()}
        />,
        { wrapper }
      );

      expect(screen.getByText('MoneyHub')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Dashboard' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Transações' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Contas' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Categorias' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Metas' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'MoneyHub IA' })).toBeOnTheScreen();

      // Check badge
      expect(screen.getByText('3')).toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: 'Categorias' }));
      expect(onSelectMock).toHaveBeenCalledWith('financeiro');
    });
  });

  describe('QuickPills', () => {
    it('renders horizontal scrollable pills and selects section', async () => {
      const onSelectMock = jest.fn();
      await render(
        <QuickPills
          activeSection="dashboard"
          onSelectSection={onSelectMock}
        />,
        { wrapper }
      );

      const contasPill = screen.getByRole('button', { name: 'Pílula Contas' });
      expect(contasPill).toBeOnTheScreen();
      await fireEvent.press(contasPill);
      expect(onSelectMock).toHaveBeenCalledWith('a_pagar');
    });
  });

  describe('BottomNavBar', () => {
    it('renders 5 navigation buttons with central + button', async () => {
      const onSelectMock = jest.fn();
      const onOpenModalMock = jest.fn();

      await render(
        <BottomNavBar
          activeSection="dashboard"
          onSelectSection={onSelectMock}
          onOpenQuickAction={onOpenModalMock}
        />,
        { wrapper }
      );

      expect(screen.getByRole('button', { name: 'Início' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Novo lançamento rápido' })).toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: 'Novo lançamento rápido' }));
      expect(onOpenModalMock).toHaveBeenCalledTimes(1);

      await fireEvent.press(screen.getByRole('button', { name: 'Metas' }));
      expect(onSelectMock).toHaveBeenCalledWith('metas');
    });
  });

  describe('AppHeader', () => {
    it('renders title, theme switch and currency selector', async () => {
      const onToggleThemeMock = jest.fn();
      await render(
        <AppHeader
          currentCurrency="BRL"
          onSelectCurrency={jest.fn()}
          onToggleTheme={onToggleThemeMock}
          title="Dashboard Financeiro"
        />,
        { wrapper }
      );

      expect(screen.getByText('Dashboard Financeiro')).toBeOnTheScreen();
      expect(screen.getByText('BRL')).toBeOnTheScreen();

      const themeToggle = screen.getByRole('button', { name: 'Alternar tema de cor' });
      expect(themeToggle).toBeOnTheScreen();
      await fireEvent.press(themeToggle);
      expect(onToggleThemeMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('QuickActionModal', () => {
    it('renders options for fast actions', async () => {
      const onActionMock = jest.fn();
      await render(
        <QuickActionModal
          onClose={jest.fn()}
          onSelectAction={onActionMock}
          visible={true}
        />,
        { wrapper }
      );

      expect(screen.getByText('Nova Conta a Pagar')).toBeOnTheScreen();
      expect(screen.getByText('Nova Conta a Receber')).toBeOnTheScreen();
      expect(screen.getByText('Nova Categoria')).toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: 'Criar Nova Conta a Pagar' }));
      expect(onActionMock).toHaveBeenCalledWith('a_pagar');
    });
  });
});
