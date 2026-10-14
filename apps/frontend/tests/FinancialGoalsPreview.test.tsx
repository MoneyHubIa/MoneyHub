import { render, screen } from '@testing-library/react-native';
import React, { PropsWithChildren } from 'react';
import { FinancialGoalsPreview } from '../src/components/FinancialGoalsPreview';
import { ThemeProvider } from '../src/theme/ThemeContext';

function Wrapper({ children }: PropsWithChildren) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('FinancialGoalsPreview Component', () => {
  test('renders header, preview goals and coming soon notice', async () => {
    await render(<FinancialGoalsPreview />, { wrapper: Wrapper });

    expect(screen.getByRole('header', { name: 'Metas Financeiras' })).toBeOnTheScreen();
    expect(screen.getByText('Reserva de Emergência')).toBeOnTheScreen();
    expect(screen.getByText('Viagem dos Sonhos')).toBeOnTheScreen();
    expect(screen.getByText('Troca de Carro')).toBeOnTheScreen();
    expect(screen.getByText('Em breve')).toBeOnTheScreen();
  });
});
