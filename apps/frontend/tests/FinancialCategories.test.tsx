import { fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { FinancialCategories } from '../src/components/FinancialCategories';
import { AuthProvider } from '../src/providers/AuthProvider';
import type { AuthService } from '../src/services/authService';

const mockService: AuthService = {
  register: jest.fn(),
  resendEmailVerification: jest.fn(),
  refreshEmailVerification: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  getIdToken: jest.fn(),
  observeSession: (callback) => {
    callback({
      uid: 'firebase-uid',
      email: 'person@example.com',
      emailVerified: true
    });
    return () => undefined;
  }
};

function Wrapper({ children }: PropsWithChildren) {
  return <AuthProvider service={mockService}>{children}</AuthProvider>;
}

const mockCreateCategory = jest.fn();

jest.mock('@apollo/client/react', () => ({
  useQuery: () => ({
    data: {
      myCategories: [
        {
          id: 'cat-1',
          name: 'Alimentação',
          type: 'EXPENSE',
          color: '#0f766e',
          icon: 'tag',
          createdAt: '2026-08-01T00:00:00.000Z'
        },
        {
          id: 'cat-2',
          name: 'Salário',
          type: 'INCOME',
          color: '#2563eb',
          icon: 'tag',
          createdAt: '2026-08-01T00:00:00.000Z'
        }
      ]
    },
    loading: false,
    refetch: jest.fn()
  }),
  useMutation: () => {
    return [mockCreateCategory, { loading: false }];
  }
}));

describe('FinancialCategories component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders header, form and existing categories', async () => {
    await render(<FinancialCategories />, { wrapper: Wrapper });

    expect(screen.getByRole('header', { name: 'Categorias Financeiras' })).toBeOnTheScreen();
    expect(screen.getByText('Nova Categoria')).toBeOnTheScreen();
    expect(screen.getByText('Alimentação')).toBeOnTheScreen();
    expect(screen.getByText('Salário')).toBeOnTheScreen();
  });

  test('starts editing when clicking edit button', async () => {
    await render(<FinancialCategories />, { wrapper: Wrapper });

    await fireEvent.press(screen.getByLabelText('Editar categoria Alimentação'));

    expect(screen.getByText('Editar Categoria')).toBeOnTheScreen();
    expect(screen.getByText('Salvar Alterações')).toBeOnTheScreen();
    expect(screen.getByText('Cancelar')).toBeOnTheScreen();
  });

  test('cancels edit mode and restores form', async () => {
    await render(<FinancialCategories />, { wrapper: Wrapper });

    await fireEvent.press(screen.getByLabelText('Editar categoria Alimentação'));
    expect(screen.getByText('Editar Categoria')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByText('Nova Categoria')).toBeOnTheScreen();
  });
});
