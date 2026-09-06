import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GraphQLError } from 'graphql';
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  syncAgendaNotifications,
  validateReminderOffsetDays,
  type AgendaNotificationsRepository,
  type Notification,
  type ReminderSourceItem
} from '../../../../src/modules/agenda/notifications/agenda-notifications.js';
import { typeDefs } from '../../../../src/core/graphql/graphql.js';

function verifiedContext(userId = 'user-1') {
  return {
    requestId: `request-${userId}`,
    auth: {
      uid: `firebase-${userId}`,
      email: `${userId}@example.com`,
      emailVerified: true,
      userId,
      profileId: `profile-${userId}`
    }
  };
}

function createRepository(): AgendaNotificationsRepository & {
  store: Notification[];
  reminderItems: ReminderSourceItem[];
} {
  const store: Notification[] = [];
  const reminderItems: ReminderSourceItem[] = [
    {
      source: 'EVENT',
      id: 'event-1',
      userId: 'user-1',
      title: 'Revisar orçamento',
      scheduledDate: new Date('2026-08-30T00:00:00.000Z'),
      reminderOffsetDays: 3
    },
    {
      source: 'PAYABLE',
      id: 'payable-1',
      userId: 'user-1',
      title: 'Aluguel',
      scheduledDate: new Date('2026-08-30T00:00:00.000Z'),
      reminderOffsetDays: 3
    },
    {
      source: 'RECEIVABLE',
      id: 'receivable-1',
      userId: 'user-1',
      title: 'Freelance',
      scheduledDate: new Date('2026-08-30T00:00:00.000Z'),
      reminderOffsetDays: 3
    },
    {
      source: 'PAYABLE',
      id: 'paid-payable',
      userId: 'user-1',
      title: 'Conta quitada',
      scheduledDate: new Date('2026-08-30T00:00:00.000Z'),
      reminderOffsetDays: 3,
      status: 'PAID'
    },
    {
      source: 'RECEIVABLE',
      id: 'received-receivable',
      userId: 'user-1',
      title: 'Valor recebido',
      scheduledDate: new Date('2026-08-30T00:00:00.000Z'),
      reminderOffsetDays: 3,
      status: 'RECEIVED'
    },
    {
      source: 'PAYABLE',
      id: 'deleted-payable',
      userId: 'user-1',
      title: 'Conta removida',
      scheduledDate: new Date('2026-08-30T00:00:00.000Z'),
      reminderOffsetDays: 3,
      deletedAt: new Date('2026-08-01T00:00:00.000Z')
    }
  ];

  return {
    store,
    reminderItems,
    findReminderItems: async ({ userId }) => reminderItems.filter((item) => item.userId === userId),
    upsert: async ({ where, create }) => {
      const existing = store.find(
        (item) =>
          item.userId === where.userId_source_sourceId_occurrenceDate.userId &&
          item.source === where.userId_source_sourceId_occurrenceDate.source &&
          item.sourceId === where.userId_source_sourceId_occurrenceDate.sourceId &&
          item.occurrenceDate.getTime() === where.userId_source_sourceId_occurrenceDate.occurrenceDate.getTime()
      );
      if (existing) return existing;

      const item: Notification = {
        id: `notification-${store.length + 1}`,
        ...create,
        readAt: null,
        createdAt: new Date('2026-08-27T12:00:00.000Z')
      };
      store.push(item);
      return item;
    },
    findMany: async ({ where }) =>
      store.filter((item) => item.userId === where.userId).sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
    findFirst: async ({ where }) =>
      store.find((item) => item.id === where.id && item.userId === where.userId) ?? null,
    update: async ({ where, data }) => {
      const item = store.find((candidate) => candidate.id === where.id);
      if (!item) throw new Error('Notification not found');
      Object.assign(item, data);
      return item;
    },
    updateMany: async ({ where, data }) => {
      const unread = store.filter((item) => item.userId === where.userId && item.readAt === null);
      unread.forEach((item) => Object.assign(item, data));
      return { count: unread.length };
    },
    deleteMany: async ({ where }) => {
      const ids = new Set(where.id.in);
      const remaining = store.filter((item) => item.userId !== where.userId || !ids.has(item.id));
      const count = store.length - remaining.length;
      store.splice(0, store.length, ...remaining);
      return { count };
    }
  };
}

function expectCode(error: unknown, code: string) {
  assert.ok(error instanceof GraphQLError);
  assert.equal(error.extensions.code, code);
}

describe('agenda notifications', () => {
  test('exposes notification queries and explicit sync/read mutations in GraphQL', () => {
    assert.match(typeDefs, /myNotifications: \[Notification!\]!/);
    assert.match(typeDefs, /syncAgendaNotifications\(today: String!\): \[Notification!\]!/);
    assert.match(typeDefs, /markNotificationRead\(id: ID!\): Notification!/);
    assert.match(typeDefs, /markAllNotificationsRead: Int!/);
  });

  test('accepts only configured reminder offsets', () => {
    assert.equal(validateReminderOffsetDays(null), null);
    assert.equal(validateReminderOffsetDays(0), 0);
    assert.equal(validateReminderOffsetDays(1), 1);
    assert.equal(validateReminderOffsetDays(3), 3);
    assert.equal(validateReminderOffsetDays(7), 7);
    assert.throws(() => validateReminderOffsetDays(2));
  });

  test('requires a valid YYYY-MM-DD local day for notification sync', async () => {
    await assert.rejects(
      () => syncAgendaNotifications(verifiedContext(), createRepository(), '2026-08-27T12:00:00.000Z'),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );
  });

  test('sync generates reminders for events and pending accounts only', async () => {
    const repository = createRepository();

    const notifications = await syncAgendaNotifications(
      verifiedContext(),
      repository,
      '2026-08-27'
    );

    assert.deepEqual(
      notifications.map((item) => [item.source, item.sourceId, item.title]),
      [
        ['EVENT', 'event-1', 'Revisar orçamento'],
        ['PAYABLE', 'payable-1', 'Aluguel'],
        ['RECEIVABLE', 'receivable-1', 'Freelance']
      ]
    );
    assert.equal(repository.store.length, 3);
  });

  test('sync creates only reminders matching local day for offsets 0, 1, 3 and 7', async () => {
    const repository = createRepository();
    repository.reminderItems.splice(0, repository.reminderItems.length,
      {
        source: 'EVENT',
        id: 'event-offset-0',
        userId: 'user-1',
        title: 'Hoje',
        scheduledDate: new Date('2026-08-27T00:00:00.000Z'),
        reminderOffsetDays: 0
      },
      {
        source: 'PAYABLE',
        id: 'payable-offset-1',
        userId: 'user-1',
        title: 'Amanha',
        scheduledDate: new Date('2026-08-28T00:00:00.000Z'),
        reminderOffsetDays: 1,
        status: 'PENDING'
      },
      {
        source: 'RECEIVABLE',
        id: 'receivable-offset-3',
        userId: 'user-1',
        title: 'Tres dias',
        scheduledDate: new Date('2026-08-30T00:00:00.000Z'),
        reminderOffsetDays: 3,
        status: 'PENDING'
      },
      {
        source: 'EVENT',
        id: 'event-offset-7',
        userId: 'user-1',
        title: 'Sete dias',
        scheduledDate: new Date('2026-09-03T00:00:00.000Z'),
        reminderOffsetDays: 7
      },
      {
        source: 'PAYABLE',
        id: 'expired-payable',
        userId: 'user-1',
        title: 'Nao criar historico',
        scheduledDate: new Date('2026-08-26T00:00:00.000Z'),
        reminderOffsetDays: 0,
        status: 'PENDING'
      },
      {
        source: 'EVENT',
        id: 'old-weekly-event',
        userId: 'user-1',
        title: 'Serie antiga',
        scheduledDate: new Date('2024-08-29T00:00:00.000Z'),
        reminderOffsetDays: 0,
        recurrenceRule: 'WEEKLY'
      }
    );

    const notifications = await syncAgendaNotifications(verifiedContext(), repository, '2026-08-27');

    assert.deepEqual(
      notifications.map((item) => [item.source, item.sourceId, item.reminderDate.toISOString().slice(0, 10)]),
      [
        ['EVENT', 'event-offset-0', '2026-08-27'],
        ['PAYABLE', 'payable-offset-1', '2026-08-27'],
        ['RECEIVABLE', 'receivable-offset-3', '2026-08-27'],
        ['EVENT', 'event-offset-7', '2026-08-27'],
        ['EVENT', 'old-weekly-event', '2026-08-27']
      ]
    );
    assert.equal(repository.store.length, 5);
  });

  test('sync remains idempotent by source and occurrence', async () => {
    const repository = createRepository();
    const today = '2026-08-27';

    await syncAgendaNotifications(verifiedContext(), repository, today);
    await syncAgendaNotifications(verifiedContext(), repository, today);

    assert.equal(repository.store.length, 3);
  });

  test('sync removes an existing reminder after its calendar event is deleted', async () => {
    const repository = createRepository();
    const today = '2026-08-27';
    await syncAgendaNotifications(verifiedContext(), repository, today);
    repository.reminderItems.splice(repository.reminderItems.findIndex((item) => item.source === 'EVENT'), 1);

    await syncAgendaNotifications(verifiedContext(), repository, today);

    assert.deepEqual(repository.store.map((item) => item.source).sort(), ['PAYABLE', 'RECEIVABLE']);
  });

  test('sync removes an existing reminder after its payable is paid', async () => {
    const repository = createRepository();
    const today = '2026-08-27';
    await syncAgendaNotifications(verifiedContext(), repository, today);
    repository.reminderItems.find((item) => item.id === 'payable-1')!.status = 'PAID';

    await syncAgendaNotifications(verifiedContext(), repository, today);

    assert.deepEqual(repository.store.map((item) => item.source).sort(), ['EVENT', 'RECEIVABLE']);
  });

  test('sync removes an existing reminder after its payable is soft-deleted', async () => {
    const repository = createRepository();
    const today = '2026-08-27';
    await syncAgendaNotifications(verifiedContext(), repository, today);
    repository.reminderItems.find((item) => item.id === 'payable-1')!.deletedAt = new Date('2026-08-27T00:00:00.000Z');

    await syncAgendaNotifications(verifiedContext(), repository, today);

    assert.deepEqual(repository.store.map((item) => item.source).sort(), ['EVENT', 'RECEIVABLE']);
  });

  test('sync removes an existing reminder after its receivable is received', async () => {
    const repository = createRepository();
    const today = '2026-08-27';
    await syncAgendaNotifications(verifiedContext(), repository, today);
    repository.reminderItems.find((item) => item.id === 'receivable-1')!.status = 'RECEIVED';

    await syncAgendaNotifications(verifiedContext(), repository, today);

    assert.deepEqual(repository.store.map((item) => item.source).sort(), ['EVENT', 'PAYABLE']);
  });

  test('lists and marks notifications only for authenticated owner', async () => {
    const repository = createRepository();
    await syncAgendaNotifications(verifiedContext(), repository, '2026-08-27');

    const listed = await listMyNotifications(verifiedContext(), repository);
    assert.equal(listed.length, 3);

    const read = await markNotificationRead(verifiedContext(), listed[0]!.id, repository);
    assert.ok(read.readAt instanceof Date);
    assert.equal(await markAllNotificationsRead(verifiedContext(), repository), 2);

    repository.store.push({
      id: 'notification-other-user',
      userId: 'user-2',
      source: 'EVENT',
      sourceId: 'event-other-user',
      title: 'Privado',
      occurrenceDate: new Date('2026-08-30T00:00:00.000Z'),
      reminderDate: new Date('2026-08-27T00:00:00.000Z'),
      readAt: null,
      createdAt: new Date('2026-08-27T12:00:00.000Z')
    });

    await assert.rejects(
      () => markNotificationRead(verifiedContext(), 'notification-other-user', repository),
      (error) => {
        expectCode(error, 'NOT_FOUND');
        return true;
      }
    );

    await assert.rejects(
      () => listMyNotifications({ requestId: 'request-2', auth: null }, repository),
      (error) => {
        expectCode(error, 'UNAUTHENTICATED');
        return true;
      }
    );
  });

  test('sync scopes matching local-day notifications to each user', async () => {
    const repository = createRepository();
    repository.reminderItems.push({
      source: 'EVENT',
      id: 'event-user-2',
      userId: 'user-2',
      title: 'Privado',
      scheduledDate: new Date('2026-08-27T00:00:00.000Z'),
      reminderOffsetDays: 0
    });

    await syncAgendaNotifications(verifiedContext('user-1'), repository, '2026-08-27');
    await syncAgendaNotifications(verifiedContext('user-2'), repository, '2026-08-27');

    assert.deepEqual(
      repository.store.map((item) => [item.userId, item.sourceId]).sort(),
      [
        ['user-1', 'event-1'],
        ['user-1', 'payable-1'],
        ['user-1', 'receivable-1'],
        ['user-2', 'event-user-2']
      ]
    );
  });
});
