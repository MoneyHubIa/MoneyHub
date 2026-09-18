import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { CostCenters } from '../src/components/CostCenters';

const mockCreate = jest.fn();
const mockDelete = jest.fn();
const mockRefetch = jest.fn();
let mockQueryState: {
  data?: { myCostCenters: Array<{
    id: string;
    name: string;
    description?: string | null;
    createdAt: string;
  }> };
  loading: boolean;
};
let mockCreateCallbacks: { onCompleted(): void; onError(error: Error): void };
let mockDeleteCallbacks: { onCompleted(): void; onError(error: Error): void };

jest.mock('@apollo/client/react', () => ({
  useQuery: () => ({ ...mockQueryState, refetch: mockRefetch }),
  useMutation: (documentValue: unknown, callbacks: typeof mockCreateCallbacks) => {
    const document = documentValue as {
      definitions?: Array<{ name?: { value?: string } }>;
    };
    if (document.definitions?.[0]?.name?.value === 'CreateCostCenter') {
      mockCreateCallbacks = callbacks;
      return [mockCreate, { loading: false }];
    }
    mockDeleteCallbacks = callbacks;
    return [mockDelete, { loading: false }];
  }
}));

describe('CostCenters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateCallbacks = undefined as unknown as typeof mockCreateCallbacks;
    mockDeleteCallbacks = undefined as unknown as typeof mockDeleteCallbacks;
    mockQueryState = {
      loading: false,
      data: {
        myCostCenters: [{
          id: 'center-1',
          name: 'Operações',
          description: 'Custos operacionais',
          createdAt: '2026-09-01T00:00:00.000Z'
        }]
      }
    };
    mockCreate.mockResolvedValue({ data: { createCostCenter: { id: 'center-2' } } });
    mockDelete.mockResolvedValue({ data: { deleteCostCenter: true } });
  });

  test('renders centers and validates empty names', async () => {
    await render(<CostCenters />);
    expect(screen.getByRole('header', { name: 'Centros de Custo' })).toBeOnTheScreen();
    expect(screen.getByText('Operações')).toBeOnTheScreen();
    expect(screen.getByText('Custos operacionais')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar Centro de Custo' }));

    expect(screen.getByText('Informe o nome do centro de custo.')).toBeOnTheScreen();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('creates a trimmed center and refreshes after completion', async () => {
    await render(<CostCenters />);
    await fireEvent.changeText(screen.getByLabelText('Nome do centro de custo'), '  Projeto X  ');
    await fireEvent.changeText(screen.getByLabelText('Descrição do centro de custo'), '  Expansão  ');

    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar Centro de Custo' }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({
      variables: {
        input: { name: 'Projeto X', description: 'Expansão' }
      }
    }));
    await act(() => mockCreateCallbacks.onCompleted());
    expect(mockRefetch).toHaveBeenCalled();
  });

  test('deletes a center and surfaces mutation errors', async () => {
    await render(<CostCenters />);

    await fireEvent.press(screen.getByLabelText('Excluir centro de custo Operações'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith({
      variables: { id: 'center-1' }
    }));
    await act(() => mockDeleteCallbacks.onCompleted());
    expect(mockRefetch).toHaveBeenCalled();

    await act(() => mockCreateCallbacks.onError(new Error('Centro duplicado')));
    expect(screen.getByText('Centro duplicado')).toBeOnTheScreen();
  });

  test('renders loading and empty states', async () => {
    mockQueryState = { loading: true };
    const view = await render(<CostCenters />);
    expect(screen.queryByText('Nenhum centro de custo cadastrado ainda.')).not.toBeOnTheScreen();

    mockQueryState = { loading: false, data: { myCostCenters: [] } };
    await view.rerender(<CostCenters />);
    expect(screen.getByText('Nenhum centro de custo cadastrado ainda.')).toBeOnTheScreen();
  });
});
