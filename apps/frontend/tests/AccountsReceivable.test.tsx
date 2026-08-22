import { fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { AccountsReceivable } from '../src/components/AccountsReceivable';
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

const mockCreateReceivable = jest.fn();
const mockMarkReceived = jest.fn();
const mockDeleteReceivable = jest.fn();

jest.mock('@apollo/client/react', () => ({
  useQuery: () => ({
    data: {
      myAccountsReceivable: [
        {
          id: 'receivable-1',
          categoryId: 'cat-1',
          costCenterId: null,
          description: 'Consultoria Contábil',
          amount: '4500.00',
          dueDate: '2026-08-30T00:00:00.000Z',
          status: 'PENDING',
          receivedAt: null,
          createdAt: '2026-08-01T00:00:00.000Z'
        },
        {
          id: 'receivable-2',
          categoryId: 'cat-1',
          costCenterId: null,
          description: 'Desenvolvimento de App',
          amount: '12000.00',
          dueDate: '2026-08-10T00:00:00.000Z',
          status: 'RECEIVED',
          receivedAt: '2026-08-10T14:00:00.000Z',
          createdAt: '2026-08-01T00:00:00.000Z'
        }
      ],
      myCategories: [
        {
          id: 'cat-1',
          name: 'Serviços Prestados',
          type: 'INCOME',
          color: '#059669'
        }
      ],
      myCostCenters: [],
      myProfile: {
        id: 'profile-1',
        preferredCurrency: 'BRL'
      }
    },
    loading: false,
    refetch: jest.fn()
  }),
  useMutation: (mutation: any) => {
    return [mockCreateReceivable, { loading: false }];
  }
}));

describe('AccountsReceivable component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders header, KPIs, form, and account items', async () => {
    await render(<AccountsReceivable />, { wrapper: Wrapper });

    expect(screen.getByRole('header', { name: 'Contas a Receber' })).toBeOnTheScreen();
    expect(screen.getByText('Total a Receber (Pendente)')).toBeOnTheScreen();
    expect(screen.getAllByText('R$ 4.500,00')).toHaveLength(2);
    expect(screen.getByText('Consultoria Contábil')).toBeOnTheScreen();
    expect(screen.getByText('Desenvolvimento de App')).toBeOnTheScreen();
    expect(screen.getByText('Pendente')).toBeOnTheScreen();
    expect(screen.getByText('Recebido')).toBeOnTheScreen();
  });

  test('shows validation error when submitting empty form', async () => {
    await render(<AccountsReceivable />, { wrapper: Wrapper });

    await fireEvent.press(screen.getByRole('button', { name: 'Agendar Conta a Receber' }));

    expect(screen.getByText('Informe uma descrição.')).toBeOnTheScreen();
  });

  test('submits valid form with category and amount', async () => {
    await render(<AccountsReceivable />, { wrapper: Wrapper });

    await fireEvent.changeText(
      screen.getByLabelText('Descrição da conta a receber'),
      'Projeto Freelance'
    );
    await fireEvent.changeText(screen.getByLabelText('Valor da conta a receber'), '1500');
    const categoryTags = screen.getAllByText('Serviços Prestados');
    expect(categoryTags[0]).toBeDefined();
    await fireEvent.press(categoryTags[0]!);

    await fireEvent.press(screen.getByRole('button', { name: 'Agendar Conta a Receber' }));

    expect(mockCreateReceivable).toHaveBeenCalled();
  });
});
