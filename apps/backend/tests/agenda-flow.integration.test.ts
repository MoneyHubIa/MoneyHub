import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createAccountPayable,
  type AccountPayable,
  type AccountPayableRepository
} from '../src/accounts-payable.js';
import {
  listMyNotifications,
  syncAgendaNotifications,
  type AgendaNotificationsRepository,
  type Notification
} from '../src/agenda-notifications.js';
import {
  createCalendarEvent,
  listMyAgenda,
  type CalendarEvent,
  type CalendarEventRepository
} from '../src/calendar-events.js';

function verifiedContext(userId: string) {
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

function createAgendaFlowStore() {
  const events: CalendarEvent[] = [];
  const payables: AccountPayable[] = [];
  const notifications: Notification[] = [];

  const eventRepository: CalendarEventRepository = {
    findMany: async ({ where }) =>
      events.filter(
        (event) => event.userId === where.userId && event.scheduledDate <= where.scheduledDate.lte
      ),
    findUnique: async ({ where }) =>
      events.find((event) => event.id === where.id && event.userId === where.userId) ?? null,
    create: async ({ data }) => {
      const event: CalendarEvent = {
        id: `event-${events.length + 1}`,
        ...data,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        updatedAt: new Date('2026-08-01T00:00:00.000Z')
      };
      events.push(event);
      return event;
    },
    update: async () => {
      throw new Error('Not used by agenda flow test.');
    },
    delete: async () => {
      throw new Error('Not used by agenda flow test.');
    },
    findPendingPayables: async ({ where }) =>
      payables
        .filter(
          (payable) =>
            payable.userId === where.userId &&
            payable.status === 'PENDING' &&
            !payable.deletedAt &&
            payable.dueDate >= where.dueDate.gte &&
            payable.dueDate <= where.dueDate.lte
        )
        .map(({ id, description, dueDate }) => ({
          id,
          description,
          dueDate,
          status: 'PENDING' as const
        })),
    findPendingReceivables: async () => []
  };

  const payableRepository: AccountPayableRepository = {
    findMany: async ({ where }) =>
      payables.filter(
        (payable) =>
          payable.userId === where.userId &&
          !payable.deletedAt &&
          (!where.status || payable.status === where.status)
      ),
    findUnique: async ({ where }) => payables.find((payable) => payable.id === where.id) ?? null,
    create: async ({ data }) => {
      const payable: AccountPayable = {
        id: `payable-${payables.length + 1}`,
        ...data,
        status: data.status ?? 'PENDING',
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        updatedAt: new Date('2026-08-01T00:00:00.000Z')
      };
      payables.push(payable);
      return payable;
    },
    update: async () => {
      throw new Error('Not used by agenda flow test.');
    }
  };

  const notificationRepository: AgendaNotificationsRepository = {
    findReminderItems: async ({ userId, throughDate }) => [
      ...events
        .filter((event) => event.userId === userId && event.scheduledDate <= throughDate)
        .map((event) => ({
          source: 'EVENT' as const,
          id: event.id,
          userId: event.userId,
          title: event.title,
          scheduledDate: event.scheduledDate,
          reminderOffsetDays: event.reminderOffsetDays ?? null,
          recurrenceRule: event.recurrenceRule,
          recurrenceEndDate: event.recurrenceEndDate
        })),
      ...payables
        .filter((payable) => payable.userId === userId && payable.dueDate <= throughDate)
        .map((payable) => ({
          source: 'PAYABLE' as const,
          id: payable.id,
          userId: payable.userId,
          title: payable.description,
          scheduledDate: payable.dueDate,
          reminderOffsetDays: payable.reminderOffsetDays ?? null,
          status: payable.status,
          deletedAt: payable.deletedAt ?? null
        }))
    ],
    upsert: async ({ where, create }) => {
      const key = where.userId_source_sourceId_occurrenceDate;
      const existing = notifications.find(
        (notification) =>
          notification.userId === key.userId &&
          notification.source === key.source &&
          notification.sourceId === key.sourceId &&
          notification.occurrenceDate.getTime() === key.occurrenceDate.getTime()
      );
      if (existing) return existing;

      const notification: Notification = {
        id: `notification-${notifications.length + 1}`,
        ...create,
        readAt: null,
        createdAt: new Date('2026-08-27T00:00:00.000Z')
      };
      notifications.push(notification);
      return notification;
    },
    findMany: async ({ where }) => notifications.filter((notification) => notification.userId === where.userId),
    findFirst: async ({ where }) =>
      notifications.find(
        (notification) => notification.id === where.id && notification.userId === where.userId
      ) ?? null,
    update: async () => {
      throw new Error('Not used by agenda flow test.');
    },
    updateMany: async () => ({ count: 0 }),
    deleteMany: async ({ where }) => {
      const ids = new Set(where.id.in);
      const remaining = notifications.filter(
        (notification) => notification.userId !== where.userId || !ids.has(notification.id)
      );
      const count = notifications.length - remaining.length;
      notifications.splice(0, notifications.length, ...remaining);
      return { count };
    }
  };

  return { eventRepository, payableRepository, notificationRepository };
}

test('returns only authenticated owner account, event, and reminders through agenda flow', async () => {
  const owner = verifiedContext('user-1');
  const otherUser = verifiedContext('user-2');
  const { eventRepository, payableRepository, notificationRepository } = createAgendaFlowStore();

  await createAccountPayable(
    owner,
    {
      categoryId: 'category-1',
      description: 'Conta da proprietaria',
      amount: '150.00',
      dueDate: '2026-08-30',
      reminderOffsetDays: 3
    },
    payableRepository
  );
  await createCalendarEvent(
    owner,
    { title: 'Evento da proprietaria', scheduledDate: '2026-08-30', reminderOffsetDays: 3 },
    eventRepository
  );
  await createAccountPayable(
    otherUser,
    {
      categoryId: 'category-2',
      description: 'Conta de outro usuario',
      amount: '250.00',
      dueDate: '2026-08-30',
      reminderOffsetDays: 3
    },
    payableRepository
  );
  await createCalendarEvent(
    otherUser,
    { title: 'Evento de outro usuario', scheduledDate: '2026-08-30', reminderOffsetDays: 3 },
    eventRepository
  );

  const ownerAgenda = await listMyAgenda(
    owner,
    { startDate: '2026-08-01', endDate: '2026-08-31' },
    eventRepository
  );
  const otherUserAgenda = await listMyAgenda(
    otherUser,
    { startDate: '2026-08-01', endDate: '2026-08-31' },
    eventRepository
  );
  await syncAgendaNotifications(owner, notificationRepository, new Date('2026-08-27T00:00:00.000Z'));
  await syncAgendaNotifications(otherUser, notificationRepository, new Date('2026-08-27T00:00:00.000Z'));

  assert.deepEqual(
    ownerAgenda.map((item) => [item.source, item.title]),
    [
      ['EVENT', 'Evento da proprietaria'],
      ['PAYABLE', 'Conta da proprietaria']
    ]
  );
  assert.deepEqual(
    otherUserAgenda.map((item) => [item.source, item.title]),
    [
      ['EVENT', 'Evento de outro usuario'],
      ['PAYABLE', 'Conta de outro usuario']
    ]
  );
  assert.deepEqual(
    (await listMyNotifications(owner, notificationRepository)).map((item) => [item.userId, item.source, item.title]),
    [
      ['user-1', 'EVENT', 'Evento da proprietaria'],
      ['user-1', 'PAYABLE', 'Conta da proprietaria']
    ]
  );
  assert.deepEqual(
    (await listMyNotifications(otherUser, notificationRepository)).map((item) => [item.userId, item.source, item.title]),
    [
      ['user-2', 'EVENT', 'Evento de outro usuario'],
      ['user-2', 'PAYABLE', 'Conta de outro usuario']
    ]
  );
});
