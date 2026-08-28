import { fireEvent, render, screen } from '@testing-library/react-native';
import { Agenda } from '../src/components/Agenda';

const mockCreateCalendarEvent = jest.fn().mockResolvedValue({ data: {} });

jest.mock('@apollo/client/react', () => ({
  useQuery: () => ({
    data: {
      myAgenda: [
        {
          id: 'event-1',
          source: 'EVENT',
          title: 'Reunião de planejamento',
          scheduledDate: '2026-08-18',
          status: 'SCHEDULED'
        },
        {
          id: 'payable-1',
          source: 'PAYABLE',
          title: 'Conta de luz',
          scheduledDate: '2026-08-18',
          status: 'PENDING'
        }
      ]
    },
    loading: false,
    refetch: jest.fn()
  }),
  useMutation: (document: { definitions?: Array<{ name?: { value?: string } }> }) => {
    const operationName = document.definitions?.[0]?.name?.value;
    return [operationName === 'CreateCalendarEvent' ? mockCreateCalendarEvent : jest.fn(), { loading: false }];
  }
}));

describe('Agenda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-18T12:00:00.000Z'));
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
});
