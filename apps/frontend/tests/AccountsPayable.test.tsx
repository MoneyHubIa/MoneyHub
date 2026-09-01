import { fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { AccountsPayable } from '../src/components/AccountsPayable';
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

const mockCreatePayable = jest.fn();
const mockUpdatePayable = jest.fn();
const mockMarkPaid = jest.fn();
const mockDeletePayable = jest.fn();

type MutationDocument = {
  definitions: Array<{ name?: { value?: string } }>;
};

jest.mock('@apollo/client/react', () => ({
  useQuery: () => ({
    data: {
      myAccountsPayable: [
        {
          id: 'payable-1',
          categoryId: 'cat-1',
          costCenterId: null,
          description: 'Aluguel do escritório',
          amount: '2500.00',
          dueDate: '2026-08-30T00:00:00.000Z',
          status: 'PENDING',
          paidAt: null,
          reminderOffsetDays: 3,
          createdAt: '2026-08-01T00:00:00.000Z'
        },
        {
          id: 'payable-2',
          categoryId: 'cat-1',
          costCenterId: null,
          description: 'Internet Fibra',
          amount: '150.00',
          dueDate: '2026-08-10T00:00:00.000Z',
          status: 'PAID',
          paidAt: '2026-08-10T14:00:00.000Z',
          createdAt: '2026-08-01T00:00:00.000Z'
        }
      ],
      myCategories: [
        {
          id: 'cat-1',
          name: 'Moradia',
          type: 'EXPENSE',
          color: '#0f766e'
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
  useMutation: (mutation: MutationDocument) => {
    const mutationName = mutation.definitions[0]?.name?.value;
    if (mutationName === 'UpdateAccountPayable') return [mockUpdatePayable, { loading: false }];
    if (mutationName === 'MarkAccountPayablePaid') return [mockMarkPaid, { loading: false }];
    if (mutationName === 'DeleteAccountPayable') return [mockDeletePayable, { loading: false }];
    return [mockCreatePayable, { loading: false }];
  }
}));

describe('AccountsPayable component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders header, KPIs, form, and account items', async () => {
    await render(<AccountsPayable />, { wrapper: Wrapper });

    expect(screen.getByRole('header', { name: 'Contas a Pagar' })).toBeOnTheScreen();
    expect(screen.getByText('Total a Pagar (Pendente)')).toBeOnTheScreen();
    expect(screen.getAllByText('R$ 2.500,00')).toHaveLength(2);
    expect(screen.getByText('Aluguel do escritório')).toBeOnTheScreen();
    expect(screen.getByText('Internet Fibra')).toBeOnTheScreen();
    expect(screen.getByText('Pendente')).toBeOnTheScreen();
    expect(screen.getByText('Pago')).toBeOnTheScreen();
  });

  test('shows validation error when submitting empty form', async () => {
    await render(<AccountsPayable />, { wrapper: Wrapper });

    await fireEvent.press(screen.getByRole('button', { name: 'Agendar Conta a Pagar' }));

    expect(screen.getByText('Informe uma descrição.')).toBeOnTheScreen();
  });

  test('sends selected reminder offset when creating an account payable', async () => {
    await render(<AccountsPayable />, { wrapper: Wrapper });

    await fireEvent.changeText(
      screen.getByLabelText('Descrição da conta a pagar'),
      'Conta de Energia'
    );
    await fireEvent.changeText(screen.getByLabelText('Valor da conta a pagar'), '350');
    const categoryTags = screen.getAllByText('Moradia');
    expect(categoryTags[0]).toBeDefined();
    await fireEvent.press(categoryTags[0]!);
    await fireEvent.press(screen.getByRole('button', { name: '7 dias antes' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Agendar Conta a Pagar' }));

    expect(mockCreatePayable).toHaveBeenCalledWith(expect.objectContaining({
      variables: expect.objectContaining({
        input: expect.objectContaining({ reminderOffsetDays: 7 })
      })
    }));
  });

  test('keeps saved reminder offset when updating an account payable', async () => {
    await render(<AccountsPayable />, { wrapper: Wrapper });

    await fireEvent.press(screen.getByRole('button', { name: 'Editar Aluguel do escritório' }));

    expect(screen.getByRole('button', { name: '3 dias antes' }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true })
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Atualizar Conta a Pagar' }));

    expect(mockUpdatePayable).toHaveBeenCalledWith(expect.objectContaining({
      variables: expect.objectContaining({
        input: expect.objectContaining({ id: 'payable-1', reminderOffsetDays: 3 })
      })
    }));
  });
});
