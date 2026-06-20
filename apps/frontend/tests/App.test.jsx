import { render, screen } from '@testing-library/react';
import { App } from '../src/App.jsx';

describe('MoneyHub app shell', () => {
  test('renders the product shell with primary navigation landmarks', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'MoneyHub' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Dashboard financeiro');
  });
});
