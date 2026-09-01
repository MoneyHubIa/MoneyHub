import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Agenda } from '../src/components/Agenda';

const mockCreateCalendarEvent = jest.fn().mockResolvedValue({ data: {} });
const mockUpdateCalendarEvent = jest.fn().mockResolvedValue({ data: {} });
const mockDeleteCalendarEvent = jest.fn().mockResolvedValue({ data: {} });
const mockAgendaRefetch = jest.fn().mockResolvedValue({ data: {} });
type MockAgendaItem = {
  id: string;
  source: 'EVENT' | 'PAYABLE' | 'RECEIVABLE';
  title: string;
  scheduledDate: string;
  status: string;
  notes?: string | null;
  recurrenceRule?: 'WEEKLY' | 'MONTHLY' | 'YEARLY' | null;
  recurrenceEndDate?: string | null;
  reminderOffsetDays?: number | null;
};

let mockAgendaItems: MockAgendaItem[] = [
  {
    id: 'EVENT:event-1:2026-08-18',
    source: 'EVENT' as const,
    title: 'Reunião de planejamento',
    scheduledDate: '2026-08-18',
    status: 'SCHEDULED',
    notes: null,
    recurrenceRule: null,
    recurrenceEndDate: null,
    reminderOffsetDays: null
  },
  {
    id: 'PAYABLE:payable-1',
    source: 'PAYABLE' as const,
    title: 'Conta de luz',
    scheduledDate: '2026-08-18',
    status: 'PENDING'
  }
];
let mockAgendaQueryError: Error | undefined;

jest.mock('@apollo/client/react', () => ({
  useQuery: () => ({
    data: {
      myAgenda: mockAgendaItems
    },
    loading: false,
    error: mockAgendaQueryError,
    refetch: mockAgendaRefetch
  }),
  useMutation: (document: { definitions?: Array<{ name?: { value?: string } }> }) => {
    const operationName = document.definitions?.[0]?.name?.value;
    const mutation = operationName === 'CreateCalendarEvent'
      ? mockCreateCalendarEvent
      : operationName === 'UpdateCalendarEvent'
        ? mockUpdateCalendarEvent
        : mockDeleteCalendarEvent;
    return [mutation, { loading: false }];
  }
}));

describe('Agenda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-18T12:00:00.000Z'));
    mockAgendaItems = [
      {
        id: 'EVENT:event-1:2026-08-18',
        source: 'EVENT',
        title: 'Reunião de planejamento',
        scheduledDate: '2026-08-18',
        status: 'SCHEDULED',
        notes: null,
        recurrenceRule: null,
        recurrenceEndDate: null,
        reminderOffsetDays: null
      },
      {
        id: 'PAYABLE:payable-1',
        source: 'PAYABLE',
        title: 'Conta de luz',
        scheduledDate: '2026-08-18',
        status: 'PENDING'
      }
    ];
    mockAgendaQueryError = undefined;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('shows monthly calendar, source markers, and selected-day items', async () => {
    await render(<Agenda />);

    expect(screen.getByRole('header', { name: 'Agenda financeira' })).toBeOnTheScreen();
    expect(screen.getByText('Agosto de 2026')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '18 de agosto de 2026' })).toBeOnTheScreen();
    expect(screen.getByText('Reunião de planejamento')).toBeOnTheScreen();
    expect(screen.getByText('Conta de luz')).toBeOnTheScreen();
    expect(screen.getByText('Evento')).toBeOnTheScreen();
    expect(screen.getByText('Conta a pagar')).toBeOnTheScreen();
  });

  test('shows a recoverable myAgenda error and retries the query', async () => {
    mockAgendaQueryError = new Error('Agenda indisponível');
    await render(<Agenda />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar a agenda.');
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(mockAgendaRefetch).toHaveBeenCalledTimes(1);
  });

  test('retries a failed event mutation without discarding form data', async () => {
    mockCreateCalendarEvent.mockRejectedValueOnce(new Error('Falha temporária'));
    await render(<Agenda />);

    await fireEvent.changeText(screen.getByLabelText('Título do evento'), 'Renovar seguro');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar evento' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Falha temporária');
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    await waitFor(() => {
      expect(mockCreateCalendarEvent).toHaveBeenCalledTimes(2);
    });
  });

  test('submits event form without time using selected recurrence and reminder', async () => {
    await render(<Agenda />);

    await fireEvent.changeText(screen.getByLabelText('Título do evento'), 'Renovar seguro');
    await fireEvent.changeText(screen.getByLabelText('Data do evento'), '20/08/2026');
    await fireEvent.changeText(screen.getByLabelText('Notas do evento'), 'Apólice anual');
    await fireEvent.press(screen.getByRole('button', { name: 'Mensal' }));
    await fireEvent.press(screen.getByRole('button', { name: '3 dias antes' }));
    await fireEvent.changeText(screen.getByLabelText('Fim da recorrência'), '20/12/2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar evento' }));

    expect(mockCreateCalendarEvent).toHaveBeenCalledWith({
      variables: {
        input: {
          title: 'Renovar seguro',
          scheduledDate: '2026-08-20',
          recurrenceRule: 'MONTHLY',
          recurrenceEndDate: '2026-12-20',
          notes: 'Apólice anual',
          reminderOffsetDays: 3
        }
      }
    });
  });

  test('preserves recurring-series anchor when editing a future occurrence without changing date', async () => {
    mockAgendaItems = [{
      id: 'EVENT:event-42:2026-08-20',
      source: 'EVENT',
      title: 'Renovar seguro',
      scheduledDate: '2026-08-20',
      status: 'SCHEDULED',
      notes: 'Apólice anual',
      recurrenceRule: 'MONTHLY',
      recurrenceEndDate: '2026-12-20',
      reminderOffsetDays: 3
    }];
    await render(<Agenda />);

    await fireEvent.press(screen.getByRole('button', { name: '20 de agosto de 2026' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Editar Renovar seguro' }));

    expect(screen.getByLabelText('Fim da recorrência')).toHaveProp('value', '20/12/2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Atualizar evento' }));

    expect(mockUpdateCalendarEvent).toHaveBeenCalledWith({
      variables: {
        input: {
          id: 'event-42',
          title: 'Renovar seguro',
          recurrenceRule: 'MONTHLY',
          recurrenceEndDate: '2026-12-20',
          notes: 'Apólice anual',
          reminderOffsetDays: 3
        }
      }
    });
  });

  test('moves recurring-series anchor when date changes from a future occurrence', async () => {
    mockAgendaItems = [{
      id: 'EVENT:event-42:2026-08-20',
      source: 'EVENT',
      title: 'Renovar seguro',
      scheduledDate: '2026-08-20',
      status: 'SCHEDULED',
      notes: null,
      recurrenceRule: 'MONTHLY',
      recurrenceEndDate: '2026-12-20',
      reminderOffsetDays: null
    }];
    await render(<Agenda />);

    await fireEvent.press(screen.getByRole('button', { name: '20 de agosto de 2026' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Editar Renovar seguro' }));

    expect(screen.getByText('Alterar data move a âncora de toda a série.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Data do evento'), '25/08/2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Atualizar evento' }));

    expect(mockUpdateCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({
      variables: expect.objectContaining({
        input: expect.objectContaining({ scheduledDate: '2026-08-25' })
      })
    }));
  });

  test('updates scheduled date when editing a non-recurring event', async () => {
    await render(<Agenda />);

    await fireEvent.press(screen.getByRole('button', { name: 'Editar Reunião de planejamento' }));
    await fireEvent.changeText(screen.getByLabelText('Data do evento'), '20/08/2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Atualizar evento' }));

    expect(mockUpdateCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({
      variables: expect.objectContaining({
        input: expect.objectContaining({ scheduledDate: '2026-08-20' })
      })
    }));
  });

  test('submits occurrence date when converting a recurring occurrence to non-recurring', async () => {
    mockAgendaItems = [{
      id: 'EVENT:event-42:2026-08-20',
      source: 'EVENT',
      title: 'Renovar seguro',
      scheduledDate: '2026-08-20',
      status: 'SCHEDULED',
      notes: null,
      recurrenceRule: 'MONTHLY',
      recurrenceEndDate: '2026-12-20',
      reminderOffsetDays: null
    }];
    await render(<Agenda />);

    await fireEvent.press(screen.getByRole('button', { name: '20 de agosto de 2026' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Editar Renovar seguro' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sem recorrência' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Atualizar evento' }));

    expect(mockUpdateCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({
      variables: expect.objectContaining({
        input: expect.objectContaining({
          scheduledDate: '2026-08-20',
          recurrenceRule: null,
          recurrenceEndDate: null
        })
      })
    }));
  });

  test('deletes whole recurring series using base event ID from occurrence', async () => {
    mockAgendaItems = [{
      id: 'EVENT:event-42:2026-08-18',
      source: 'EVENT',
      title: 'Renovar seguro',
      scheduledDate: '2026-08-18',
      status: 'SCHEDULED',
      notes: null,
      recurrenceRule: 'MONTHLY',
      recurrenceEndDate: null,
      reminderOffsetDays: null
    }];
    await render(<Agenda />);

    await fireEvent.press(screen.getByRole('button', { name: 'Excluir Renovar seguro' }));

    expect(mockDeleteCalendarEvent).toHaveBeenCalledWith({ variables: { id: 'event-42' } });
  });

  test('retries only agenda refetch when delete succeeds but refresh fails', async () => {
    mockAgendaRefetch.mockRejectedValueOnce(new Error('Agenda indisponível'));
    await render(<Agenda />);

    await fireEvent.press(screen.getByRole('button', { name: 'Excluir Reunião de planejamento' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Agenda indisponível');
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));

    await waitFor(() => {
      expect(mockAgendaRefetch).toHaveBeenCalledTimes(2);
    });
    expect(mockDeleteCalendarEvent).toHaveBeenCalledTimes(1);
  });

  test('selects valid day in new month after month navigation', async () => {
    await render(<Agenda />);

    await fireEvent.press(screen.getByRole('button', { name: 'Próximo mês' }));

    expect(screen.getByRole('header', { name: 'Compromissos em 1 de setembro de 2026' })).toBeOnTheScreen();
  });
});
