import { fireEvent, render, screen } from '@testing-library/react-native';
import { DashboardShell } from '../src/components/DashboardShell';

describe('MoneyHub dashboard shell', () => {
  test('renders the product and financial summary', async () => {
    await render(<DashboardShell />);

    expect(screen.getByText('MoneyHub')).toBeOnTheScreen();
    expect(screen.getByText('Dashboard financeiro')).toBeOnTheScreen();
    expect(screen.getByText('Saldo previsto')).toBeOnTheScreen();
    expect(screen.getAllByText('R$ 0,00')).toHaveLength(3);
  });

  test('changes the active section from the navigation', async () => {
    await render(<DashboardShell />);
    await fireEvent.press(screen.getByRole('button', { name: 'Agenda' }));

    expect(screen.getByRole('header', { name: 'Agenda' })).toBeOnTheScreen();
    expect(screen.getByText('O conteudo de Agenda estara disponivel em breve.'))
      .toBeOnTheScreen();
  });
});
