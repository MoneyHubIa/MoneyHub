import { fireEvent, render, screen } from '@testing-library/react';
import { App } from '../src/App.jsx';

describe('MoneyHub app shell', () => {
  test('renders the product shell with primary navigation landmarks', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'MoneyHub' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Dashboard financeiro');
  });

  test('selects a sidebar section and updates the main content', () => {
    render(<App />);

    const dashboardButton = screen.getByRole('button', { name: 'Dashboard' });
    const accountsButton = screen.getByRole('button', { name: 'Contas' });

    expect(dashboardButton).toHaveAttribute('aria-current', 'page');

    fireEvent.click(accountsButton);

    expect(accountsButton).toHaveAttribute('aria-current', 'page');
    expect(dashboardButton).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('main')).toHaveTextContent('Contas');
    expect(screen.getByRole('main')).toHaveTextContent(
      'O conteúdo de Contas estará disponível em breve.'
    );
  });
});
