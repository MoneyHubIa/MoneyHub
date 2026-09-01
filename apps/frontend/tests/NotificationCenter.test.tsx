import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { NotificationCenter } from '../src/components/NotificationCenter';

const mockMarkNotificationRead = jest.fn().mockResolvedValue({ data: {} });
const mockMarkAllNotificationsRead = jest.fn().mockResolvedValue({ data: {} });
const mockRefetch = jest.fn();
const mockOpenSource = jest.fn();
const mockRetrySync = jest.fn();

const mockQuery = {
  data: {
    myNotifications: [
      {
        id: 'notification-1',
        source: 'PAYABLE',
        sourceId: 'payable-1',
        title: 'Conta de luz vence hoje',
        occurrenceDate: '2026-08-30',
        reminderDate: '2026-08-30',
        readAt: null,
        createdAt: '2026-08-30T10:00:00.000Z'
      },
      {
        id: 'notification-2',
        source: 'EVENT',
        sourceId: 'event-1',
        title: 'Reunião de planejamento amanhã',
        occurrenceDate: '2026-08-31',
        reminderDate: '2026-08-30',
        readAt: '2026-08-30T09:00:00.000Z',
        createdAt: '2026-08-30T08:00:00.000Z'
      }
    ]
  },
  loading: false,
  error: undefined as Error | undefined,
  refetch: mockRefetch
};

const mockUseQuery = jest.fn((...args: unknown[]) => {
  void args;
  return mockQuery;
});

jest.mock('@apollo/client/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (document: { definitions?: Array<{ name?: { value?: string } }> }) => {
    const operationName = document.definitions?.[0]?.name?.value;
    return [
      operationName === 'MarkNotificationRead'
        ? mockMarkNotificationRead
        : mockMarkAllNotificationsRead,
      { loading: false }
    ];
  }
}));

describe('NotificationCenter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockQuery, {
      data: {
        myNotifications: [
          {
            id: 'notification-1',
            source: 'PAYABLE',
            sourceId: 'payable-1',
            title: 'Conta de luz vence hoje',
            occurrenceDate: '2026-08-30',
            reminderDate: '2026-08-30',
            readAt: null,
            createdAt: '2026-08-30T10:00:00.000Z'
          },
          {
            id: 'notification-2',
            source: 'EVENT',
            sourceId: 'event-1',
            title: 'Reunião de planejamento amanhã',
            occurrenceDate: '2026-08-31',
            reminderDate: '2026-08-30',
            readAt: '2026-08-30T09:00:00.000Z',
            createdAt: '2026-08-30T08:00:00.000Z'
          }
        ]
      },
      loading: false,
      error: undefined,
      refetch: mockRefetch
    });
  });

  test('shows unread count and notification list after opening it', async () => {
    await render(<NotificationCenter onOpenSource={mockOpenSource} />);

    expect(screen.getByRole('button', { name: 'Notificações, 1 não lida' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Notificações, 1 não lida' }));

    expect(screen.getByRole('header', { name: 'Notificações' })).toBeOnTheScreen();
    expect(screen.getByText('Conta de luz vence hoje')).toBeOnTheScreen();
    expect(screen.getByText('Reunião de planejamento amanhã')).toBeOnTheScreen();
  });

  test('skips notification query until agenda notification sync is ready', async () => {
    await render(<NotificationCenter enabled={false} />);

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: true })
    );
  });

  test('marks one unread notification as read', async () => {
    await render(<NotificationCenter />);
    await fireEvent.press(screen.getByRole('button', { name: 'Notificações, 1 não lida' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Marcar Conta de luz vence hoje como lida' }));

    expect(mockMarkNotificationRead).toHaveBeenCalledWith({
      variables: { id: 'notification-1' }
    });
    expect(mockRefetch).toHaveBeenCalled();
  });

  test('marks all unread notifications as read', async () => {
    await render(<NotificationCenter />);
    await fireEvent.press(screen.getByRole('button', { name: 'Notificações, 1 não lida' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Marcar todas como lidas' }));

    expect(mockMarkAllNotificationsRead).toHaveBeenCalledWith();
    expect(mockRefetch).toHaveBeenCalled();
  });

  test('shows an action error when marking one notification as read fails', async () => {
    mockMarkNotificationRead.mockRejectedValueOnce(new Error('Falha'));
    await render(<NotificationCenter />);
    await fireEvent.press(screen.getByRole('button', { name: 'Notificações, 1 não lida' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Marcar Conta de luz vence hoje como lida' }));

    await waitFor(() => {
      expect(screen.getByText('Não foi possível atualizar notificações.')).toBeOnTheScreen();
    });
  });

  test('opens related agenda source when supplied', async () => {
    await render(<NotificationCenter onOpenSource={mockOpenSource} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Notificações, 1 não lida' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Ver Conta de luz vence hoje na agenda' }));

    expect(mockOpenSource).toHaveBeenCalledWith(expect.objectContaining({
      id: 'notification-1',
      source: 'PAYABLE',
      sourceId: 'payable-1'
    }));
  });

  test('shows loading state', async () => {
    Object.assign(mockQuery, { data: undefined, loading: true, error: undefined });
    await render(<NotificationCenter />);
    await fireEvent.press(screen.getByRole('button', { name: 'Notificações' }));
    expect(screen.getByText('Carregando notificações...')).toBeOnTheScreen();
  });

  test('shows empty state', async () => {
    Object.assign(mockQuery, { data: { myNotifications: [] }, loading: false, error: undefined });
    await render(<NotificationCenter />);
    await fireEvent.press(screen.getByRole('button', { name: 'Notificações' }));
    expect(screen.getByText('Nenhuma notificação por enquanto.')).toBeOnTheScreen();
  });

  test('refreshes notification list after a successful sync retry', async () => {
    const syncedNotification = {
      id: 'notification-synced',
      source: 'EVENT' as const,
      sourceId: 'event-synced',
      title: 'Lembrete sincronizado',
      occurrenceDate: '2026-08-31',
      reminderDate: '2026-08-30',
      readAt: null,
      createdAt: '2026-08-30T11:00:00.000Z'
    };
    Object.assign(mockQuery, { data: { myNotifications: [] }, loading: false, error: undefined });
    const retrySync = jest.fn(async () => {
      Object.assign(mockQuery, { data: { myNotifications: [syncedNotification] } });
    });
    mockRefetch.mockResolvedValueOnce({ data: { myNotifications: [syncedNotification] } });
    const { rerender } = await render(<NotificationCenter syncError onRetrySync={retrySync} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Notificações' }));

    expect(screen.getByLabelText('Falha de sincronização da agenda')).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível sincronizar lembretes da agenda.');
    expect(screen.getByText('Nenhuma notificação por enquanto.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => {
      expect(retrySync).toHaveBeenCalledTimes(1);
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
    await rerender(<NotificationCenter syncError onRetrySync={retrySync} />);

    expect(screen.getByText('Lembrete sincronizado')).toBeOnTheScreen();
  });

  test('shows error state', async () => {
    Object.assign(mockQuery, { data: undefined, loading: false, error: new Error('Falha') });
    await render(<NotificationCenter />);
    await fireEvent.press(screen.getByRole('button', { name: 'Notificações' }));
    expect(screen.getByText('Não foi possível carregar notificações.')).toBeOnTheScreen();
  });
});
