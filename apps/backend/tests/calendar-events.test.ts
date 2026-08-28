import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GraphQLError } from 'graphql';
import {
  createCalendarEvent,
  calendarEventOccurrences,
  deleteCalendarEvent,
  listMyAgenda,
  updateCalendarEvent,
  type CalendarEvent,
  type CalendarEventRepository
} from '../src/calendar-events.js';
import { resolvers, typeDefs } from '../src/graphql.js';

function verifiedContext() {
  return {
    requestId: 'request-1',
    auth: {
      uid: 'firebase-user-1',
      email: 'user@example.com',
      emailVerified: true,
      userId: 'user-1',
      profileId: 'profile-1'
    }
  };
}

function createRepository(): CalendarEventRepository & {
  store: CalendarEvent[];
  findUniqueWheres: Array<{ id: string; userId?: string }>;
} {
  const store: CalendarEvent[] = [
    {
      id: 'event-1',
      userId: 'user-1',
      title: 'Fechar orçamento',
      scheduledDate: new Date('2026-08-05T00:00:00.000Z'),
      recurrenceRule: null,
      recurrenceEndDate: null,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z')
    },
    {
      id: 'event-other-user',
      userId: 'user-2',
      title: 'Privado',
      scheduledDate: new Date('2026-08-10T00:00:00.000Z'),
      recurrenceRule: null,
      recurrenceEndDate: null,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z')
    }
  ];

  const findUniqueWheres: Array<{ id: string; userId?: string }> = [];

  return {
    store,
    findUniqueWheres,
    findMany: async ({ where }) =>
      store.filter((item) =>
        item.userId === where.userId &&
        item.scheduledDate <= where.scheduledDate.lte
      ),
    findUnique: async ({ where }: { where: { id: string; userId?: string } }) => {
      findUniqueWheres.push(where);
      return store.find(
        (item) => item.id === where.id && (where.userId === undefined || item.userId === where.userId)
      ) ?? null;
    },
    create: async ({ data }) => {
      const item: CalendarEvent = {
        id: `event-${store.length + 1}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      store.push(item);
      return item;
    },
    update: async ({ where, data }) => {
      const index = store.findIndex((item) => item.id === where.id);
      if (index === -1) throw new Error('Not found');
      const updated: CalendarEvent = { ...store[index]!, ...data, updatedAt: new Date() };
      store[index] = updated;
      return updated;
    },
    delete: async ({ where }) => {
      const index = store.findIndex((item) => item.id === where.id);
      if (index === -1) throw new Error('Not found');
      const [deleted] = store.splice(index, 1);
      return deleted!;
    },
    findPendingPayables: async ({ where }) => [
      {
        id: 'payable-1',
        description: 'Aluguel',
        dueDate: new Date('2026-08-12T00:00:00.000Z'),
        status: 'PENDING' as const
      }
    ].filter(
      (item) =>
        where.userId === 'user-1' &&
        item.dueDate >= where.dueDate.gte &&
        item.dueDate <= where.dueDate.lte
    ),
    findPendingReceivables: async ({ where }) => [
      {
        id: 'receivable-1',
        description: 'Freelance',
        dueDate: new Date('2026-08-20T00:00:00.000Z'),
        status: 'PENDING' as const
      }
    ].filter(
      (item) =>
        where.userId === 'user-1' &&
        item.dueDate >= where.dueDate.gte &&
        item.dueDate <= where.dueDate.lte
    )
  };
}

function expectCode(error: unknown, code: string) {
  assert.ok(error instanceof GraphQLError);
  assert.equal(error.extensions.code, code);
}

describe('calendar events', () => {
  test('exposes Agenda GraphQL contract', () => {
    assert.match(typeDefs, /type CalendarEvent/);
    assert.match(typeDefs, /type AgendaItem/);
    assert.match(typeDefs, /myAgenda\(input: AgendaRangeInput!\): \[AgendaItem!\]!/);
    assert.match(typeDefs, /createCalendarEvent\(input: CreateCalendarEventInput!\): CalendarEvent!/);
    assert.match(typeDefs, /updateCalendarEvent\(input: UpdateCalendarEventInput!\): CalendarEvent!/);
    assert.match(typeDefs, /deleteCalendarEvent\(id: ID!\): Boolean!/);
  });

  test('serializes Agenda GraphQL dates without ISO datetime suffixes', () => {
    const event: CalendarEvent = {
      id: 'event-1',
      userId: 'user-1',
      title: 'Fechar orÃ§amento',
      scheduledDate: new Date('2026-08-31T00:00:00.000Z'),
      recurrenceRule: 'MONTHLY',
      recurrenceEndDate: new Date('2026-12-31T00:00:00.000Z'),
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z')
    };

    assert.equal(resolvers.CalendarEvent.scheduledDate(event), '2026-08-31');
    assert.equal(resolvers.CalendarEvent.recurrenceEndDate(event), '2026-12-31');
    assert.equal(
      resolvers.AgendaItem.scheduledDate({
        id: 'EVENT:event-1:2026-08-31',
        source: 'EVENT',
        title: 'Fechar orÃ§amento',
        scheduledDate: event.scheduledDate,
        status: 'SCHEDULED'
      }),
      '2026-08-31'
    );
  });

  test('creates date-only event owned by authenticated user', async () => {
    const result = await createCalendarEvent(
      verifiedContext(),
      { title: 'Revisar fluxo de caixa', scheduledDate: '2026-08-18' },
      createRepository()
    );

    assert.equal(result.userId, 'user-1');
    assert.equal(result.title, 'Revisar fluxo de caixa');
    assert.equal(result.scheduledDate.toISOString(), '2026-08-18T00:00:00.000Z');
    assert.equal(result.recurrenceRule, null);
  });

  test('updates entire recurrence series for owner', async () => {
    const repository = createRepository();
    const created = await createCalendarEvent(
      verifiedContext(),
      {
        title: 'Revisão semanal',
        scheduledDate: '2026-08-03',
        recurrenceRule: 'WEEKLY',
        recurrenceEndDate: '2026-08-31'
      },
      repository
    );

    const updated = await updateCalendarEvent(
      verifiedContext(),
      { id: created.id, title: 'Revisão financeira semanal' },
      repository
    );

    assert.equal(updated.title, 'Revisão financeira semanal');
    assert.equal(updated.recurrenceRule, 'WEEKLY');
  });

  test('uses tenant-scoped lookup before update and delete', async () => {
    const repository = createRepository();

    await updateCalendarEvent(
      verifiedContext(),
      { id: 'event-1', title: 'OrÃ§amento fechado' },
      repository
    );
    await deleteCalendarEvent(verifiedContext(), 'event-1', repository);

    assert.deepEqual(repository.findUniqueWheres, [
      { id: 'event-1', userId: 'user-1' },
      { id: 'event-1', userId: 'user-1' }
    ]);
  });

  test('deletes event only when it belongs to authenticated user', async () => {
    const repository = createRepository();
    assert.equal(await deleteCalendarEvent(verifiedContext(), 'event-1', repository), true);
    assert.equal(repository.store.some((item) => item.id === 'event-1'), false);

    await assert.rejects(
      () => deleteCalendarEvent(verifiedContext(), 'event-other-user', repository),
      (error) => {
        expectCode(error, 'NOT_FOUND');
        return true;
      }
    );
  });

  test('expands WEEKLY, MONTHLY and YEARLY occurrences inside requested month', async () => {
    const repository = createRepository();
    await createCalendarEvent(
      verifiedContext(),
      { title: 'Semanal', scheduledDate: '2026-08-03', recurrenceRule: 'WEEKLY' },
      repository
    );
    await createCalendarEvent(
      verifiedContext(),
      { title: 'Mensal', scheduledDate: '2026-06-15', recurrenceRule: 'MONTHLY' },
      repository
    );
    await createCalendarEvent(
      verifiedContext(),
      { title: 'Anual', scheduledDate: '2025-08-25', recurrenceRule: 'YEARLY' },
      repository
    );

    const agenda = await listMyAgenda(
      verifiedContext(),
      { startDate: '2026-08-01', endDate: '2026-08-31' },
      repository
    );

    assert.deepEqual(
      agenda.filter((item) => item.source === 'EVENT').map((item) => [item.title, item.scheduledDate.toISOString()]).sort((left, right) => (left[1] ?? '').localeCompare(right[1] ?? '')),
      [
        ['Fechar orçamento', '2026-08-05T00:00:00.000Z'],
        ['Semanal', '2026-08-03T00:00:00.000Z'],
        ['Semanal', '2026-08-10T00:00:00.000Z'],
        ['Mensal', '2026-08-15T00:00:00.000Z'],
        ['Semanal', '2026-08-17T00:00:00.000Z'],
        ['Semanal', '2026-08-24T00:00:00.000Z'],
        ['Semanal', '2026-08-31T00:00:00.000Z'],
        ['Anual', '2026-08-25T00:00:00.000Z']
      ].sort((left, right) => (left[1] ?? '').localeCompare(right[1] ?? ''))
    );
  });

  test('preserves monthly and yearly recurrence anchor day when calendar supports it', () => {
    const monthly: CalendarEvent = {
      id: 'event-monthly',
      userId: 'user-1',
      title: 'Fechamento mensal',
      scheduledDate: new Date('2026-01-31T00:00:00.000Z'),
      recurrenceRule: 'MONTHLY',
      recurrenceEndDate: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    };
    const yearly: CalendarEvent = {
      ...monthly,
      id: 'event-yearly',
      scheduledDate: new Date('2024-02-29T00:00:00.000Z'),
      recurrenceRule: 'YEARLY'
    };

    assert.deepEqual(
      calendarEventOccurrences(monthly, new Date('2026-01-01T00:00:00.000Z'), new Date('2026-03-31T00:00:00.000Z'))
        .map((value) => value.toISOString().slice(0, 10)),
      ['2026-01-31', '2026-02-28', '2026-03-31']
    );
    assert.deepEqual(
      calendarEventOccurrences(yearly, new Date('2024-01-01T00:00:00.000Z'), new Date('2028-12-31T00:00:00.000Z'))
        .map((value) => value.toISOString().slice(0, 10)),
      ['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']
    );
  });

  test('projects only pending payable and receivable accounts within requested month', async () => {
    const agenda = await listMyAgenda(
      verifiedContext(),
      { startDate: '2026-08-01', endDate: '2026-08-31' },
      createRepository()
    );

    assert.deepEqual(
      agenda.filter((item) => item.source !== 'EVENT').map((item) => [item.source, item.title, item.status]),
      [
        ['PAYABLE', 'Aluguel', 'PENDING'],
        ['RECEIVABLE', 'Freelance', 'PENDING']
      ]
    );
  });

  test('rejects unverified access and invalid local date inputs', async () => {
    const repository = createRepository();
    await assert.rejects(
      () => listMyAgenda({ requestId: 'request-2', auth: null }, { startDate: '2026-08-01', endDate: '2026-08-31' }, repository),
      (error) => {
        expectCode(error, 'UNAUTHENTICATED');
        return true;
      }
    );
    await assert.rejects(
      () => createCalendarEvent(verifiedContext(), { title: 'Com hora', scheduledDate: '2026-08-10T10:00:00Z' }, repository),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );
  });
});
