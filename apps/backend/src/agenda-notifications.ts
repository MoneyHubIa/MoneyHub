import { GraphQLError } from 'graphql';
import type { GraphQLContext } from './graphql.js';
import { calendarEventOccurrences, type CalendarRecurrenceRule } from './calendar-events.js';
import { requireVerifiedUserId } from './financial-categories.js';

export type ReminderOffsetDays = 0 | 1 | 3 | 7 | null;
export type NotificationSource = 'EVENT' | 'PAYABLE' | 'RECEIVABLE';

export type ReminderSourceItem = {
  source: NotificationSource;
  id: string;
  userId: string;
  title: string;
  scheduledDate: Date;
  reminderOffsetDays: ReminderOffsetDays;
  recurrenceRule?: CalendarRecurrenceRule | null;
  recurrenceEndDate?: Date | null;
  status?: string;
  deletedAt?: Date | null;
};

export type Notification = {
  id: string;
  userId: string;
  source: NotificationSource;
  sourceId: string;
  title: string;
  occurrenceDate: Date;
  reminderDate: Date;
  readAt: Date | null;
  createdAt: Date;
};

type NotificationUniqueKey = {
  userId: string;
  source: NotificationSource;
  sourceId: string;
  occurrenceDate: Date;
};

export type AgendaNotificationsRepository = {
  findReminderItems(args: { userId: string; throughDate: Date }): Promise<ReminderSourceItem[]>;
  upsert(args: {
    where: { userId_source_sourceId_occurrenceDate: NotificationUniqueKey };
    create: Omit<Notification, 'id' | 'readAt' | 'createdAt'>;
    update: Record<string, never>;
  }): Promise<Notification>;
  findMany(args: { where: { userId: string } }): Promise<Notification[]>;
  findFirst(args: { where: { id: string; userId: string } }): Promise<Notification | null>;
  update(args: { where: { id: string }; data: { readAt: Date } }): Promise<Notification>;
  updateMany(args: { where: { userId: string; readAt: null }; data: { readAt: Date } }): Promise<{ count: number }>;
};

const validReminderOffsets = new Set<Exclude<ReminderOffsetDays, null>>([0, 1, 3, 7]);

export function agendaNotificationError(message: string, code = 'BAD_USER_INPUT'): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}

export function validateReminderOffsetDays(value: number | null | undefined): ReminderOffsetDays {
  if (value === null || value === undefined) return null;
  if (!validReminderOffsets.has(value as Exclude<ReminderOffsetDays, null>)) {
    throw agendaNotificationError('Reminder offset must be null, 0, 1, 3 or 7 days.');
  }
  return value as Exclude<ReminderOffsetDays, null>;
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + days));
}

function reminderDate(occurrenceDate: Date, offsetDays: Exclude<ReminderOffsetDays, null>): Date {
  return addUtcDays(occurrenceDate, -offsetDays);
}

function occurrenceDates(item: ReminderSourceItem, throughDate: Date): Date[] {
  if (item.source !== 'EVENT' || !item.recurrenceRule) {
    return [startOfUtcDay(item.scheduledDate)];
  }

  return calendarEventOccurrences(
    {
      id: item.id,
      userId: item.userId,
      title: item.title,
      scheduledDate: startOfUtcDay(item.scheduledDate),
      recurrenceRule: item.recurrenceRule,
      recurrenceEndDate: item.recurrenceEndDate ? startOfUtcDay(item.recurrenceEndDate) : null,
      createdAt: throughDate,
      updatedAt: throughDate
    },
    startOfUtcDay(item.scheduledDate),
    throughDate
  );
}

function isEligible(item: ReminderSourceItem): boolean {
  if (item.reminderOffsetDays === null || item.reminderOffsetDays === undefined) return false;
  if (item.source !== 'EVENT' && ((item.status !== undefined && item.status !== 'PENDING') || item.deletedAt)) return false;
  return true;
}

export async function syncAgendaNotifications(
  context: GraphQLContext,
  repository: AgendaNotificationsRepository,
  now = new Date()
): Promise<Notification[]> {
  const userId = requireVerifiedUserId(context);
  const today = startOfUtcDay(now);
  const throughDate = addUtcDays(today, 7);
  const items = await repository.findReminderItems({ userId, throughDate });
  const notifications: Notification[] = [];

  for (const item of items) {
    if (!isEligible(item)) continue;
    const offsetDays = validateReminderOffsetDays(item.reminderOffsetDays);
    if (offsetDays === null) continue;

    for (const occurrenceDate of occurrenceDates(item, throughDate)) {
      const normalizedOccurrenceDate = startOfUtcDay(occurrenceDate);
      const dueOn = reminderDate(normalizedOccurrenceDate, offsetDays);
      if (dueOn > today) continue;

      notifications.push(
        await repository.upsert({
          where: {
            userId_source_sourceId_occurrenceDate: {
              userId,
              source: item.source,
              sourceId: item.id,
              occurrenceDate: normalizedOccurrenceDate
            }
          },
          create: {
            userId,
            source: item.source,
            sourceId: item.id,
            title: item.title,
            occurrenceDate: normalizedOccurrenceDate,
            reminderDate: dueOn
          },
          update: {}
        })
      );
    }
  }

  return notifications;
}

export async function listMyNotifications(
  context: GraphQLContext,
  repository: AgendaNotificationsRepository
): Promise<Notification[]> {
  const userId = requireVerifiedUserId(context);
  return repository.findMany({ where: { userId } });
}

export async function markNotificationRead(
  context: GraphQLContext,
  id: string,
  repository: AgendaNotificationsRepository
): Promise<Notification> {
  const userId = requireVerifiedUserId(context);
  if (!id) throw agendaNotificationError('Notification ID is required.');

  const notification = await repository.findFirst({ where: { id, userId } });
  if (!notification) throw agendaNotificationError('Notification was not found.', 'NOT_FOUND');
  if (notification.readAt) return notification;

  return repository.update({ where: { id }, data: { readAt: new Date() } });
}

export async function markAllNotificationsRead(
  context: GraphQLContext,
  repository: AgendaNotificationsRepository
): Promise<number> {
  const userId = requireVerifiedUserId(context);
  const result = await repository.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() }
  });
  return result.count;
}
