import { GraphQLError } from 'graphql';
import type { GraphQLContext } from './graphql.js';
import { requireVerifiedUserId } from './financial-categories.js';
import { validateReminderOffsetDays, type ReminderOffsetDays } from './agenda-notifications.js';

export type CalendarRecurrenceRule = 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type AgendaItemSource = 'EVENT' | 'PAYABLE' | 'RECEIVABLE';

export type CalendarEvent = {
  id: string;
  userId: string;
  title: string;
  scheduledDate: Date;
  recurrenceRule: CalendarRecurrenceRule | null;
  recurrenceEndDate: Date | null;
  notes?: string | null;
  reminderOffsetDays?: ReminderOffsetDays;
  createdAt: Date;
  updatedAt: Date;
};

export type AgendaItem = {
  id: string;
  source: AgendaItemSource;
  title: string;
  scheduledDate: Date;
  status: 'SCHEDULED' | 'PENDING';
  notes?: string | null;
};

export type CreateCalendarEventInput = {
  title: string;
  scheduledDate: string;
  recurrenceRule?: CalendarRecurrenceRule | null;
  recurrenceEndDate?: string | null;
  notes?: string | null;
  reminderOffsetDays?: number | null;
};

export type UpdateCalendarEventInput = {
  id: string;
  title?: string;
  scheduledDate?: string;
  recurrenceRule?: CalendarRecurrenceRule | null;
  recurrenceEndDate?: string | null;
  notes?: string | null;
  reminderOffsetDays?: number | null;
};

export type AgendaRangeInput = {
  startDate: string;
  endDate: string;
};

type PendingAccount = {
  id: string;
  description: string;
  dueDate: Date;
  status: 'PENDING';
};

export type CalendarEventRepository = {
  findMany(args: {
    where: { userId: string; scheduledDate: { lte: Date } };
  }): Promise<CalendarEvent[]>;
  findUnique(args: { where: { id: string; userId: string } }): Promise<CalendarEvent | null>;
  create(args: {
    data: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>;
  }): Promise<CalendarEvent>;
  update(args: {
    where: { id: string };
    data: Partial<Pick<CalendarEvent, 'title' | 'scheduledDate' | 'recurrenceRule' | 'recurrenceEndDate' | 'notes' | 'reminderOffsetDays'>>;
  }): Promise<CalendarEvent>;
  delete(args: { where: { id: string } }): Promise<CalendarEvent>;
  findPendingPayables(args: {
    where: { userId: string; status: 'PENDING'; deletedAt: null; dueDate: { gte: Date; lte: Date } };
  }): Promise<PendingAccount[]>;
  findPendingReceivables(args: {
    where: { userId: string; status: 'PENDING'; deletedAt: null; dueDate: { gte: Date; lte: Date } };
  }): Promise<PendingAccount[]>;
};

const validRecurrenceRules = new Set<CalendarRecurrenceRule>(['WEEKLY', 'MONTHLY', 'YEARLY']);
const localDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function calendarError(message: string, code = 'BAD_USER_INPUT'): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}

function parseLocalDate(raw: string, fieldName: string): Date {
  if (!localDatePattern.test(raw)) {
    throw calendarError(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const [year, month, day] = raw.split('-').map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day!));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month! - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw calendarError(`${fieldName} is invalid.`);
  }
  return parsed;
}

function toLocalDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function nextOccurrence(value: Date, rule: CalendarRecurrenceRule, anchorDay: number): Date {
  if (rule === 'WEEKLY') {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + 7));
  }

  const targetYear = rule === 'YEARLY' ? value.getUTCFullYear() + 1 : value.getUTCFullYear();
  const targetMonth = rule === 'YEARLY' ? value.getUTCMonth() : value.getUTCMonth() + 1;
  return new Date(
    Date.UTC(targetYear, targetMonth, Math.min(anchorDay, daysInUtcMonth(targetYear, targetMonth)))
  );
}

export function calendarEventOccurrences(
  event: CalendarEvent,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  if (!event.recurrenceRule) {
    return event.scheduledDate >= rangeStart && event.scheduledDate <= rangeEnd
      ? [new Date(event.scheduledDate)]
      : [];
  }

  const occurrences: Date[] = [];
  let current = new Date(event.scheduledDate);
  const anchorDay = event.scheduledDate.getUTCDate();
  const recurrenceEnd = event.recurrenceEndDate ?? rangeEnd;

  while (current <= rangeEnd && current <= recurrenceEnd) {
    if (current >= rangeStart) occurrences.push(new Date(current));
    current = nextOccurrence(current, event.recurrenceRule, anchorDay);
  }
  return occurrences;
}

function validateTitle(raw: string): string {
  const title = raw?.trim();
  if (!title || title.length > 120) {
    throw calendarError('Event title must contain between 1 and 120 characters.');
  }
  return title;
}

function validateNotes(raw: string | null | undefined): string | null {
  const notes = raw?.trim() || null;
  if (notes && notes.length > 500) {
    throw calendarError('Notes cannot exceed 500 characters.');
  }
  return notes;
}

function validateRecurrence(
  rule: CalendarRecurrenceRule | null | undefined,
  endDate: Date | null | undefined,
  scheduledDate: Date
) {
  if (rule !== null && rule !== undefined && !validRecurrenceRules.has(rule)) {
    throw calendarError('Recurrence rule is invalid.');
  }
  if (endDate && !rule) {
    throw calendarError('Recurrence end date requires a recurrence rule.');
  }
  if (endDate && endDate < scheduledDate) {
    throw calendarError('Recurrence end date cannot precede scheduled date.');
  }
}

export async function createCalendarEvent(
  context: GraphQLContext,
  input: CreateCalendarEventInput,
  repository: CalendarEventRepository
): Promise<CalendarEvent> {
  const userId = requireVerifiedUserId(context);
  const title = validateTitle(input.title);
  const scheduledDate = parseLocalDate(input.scheduledDate, 'Scheduled date');
  const recurrenceRule = input.recurrenceRule ?? null;
  const recurrenceEndDate = input.recurrenceEndDate
    ? parseLocalDate(input.recurrenceEndDate, 'Recurrence end date')
    : null;
  validateRecurrence(recurrenceRule, recurrenceEndDate, scheduledDate);
  const notes = validateNotes(input.notes);
  const reminderOffsetDays = validateReminderOffsetDays(input.reminderOffsetDays);

  return repository.create({
    data: { userId, title, scheduledDate, recurrenceRule, recurrenceEndDate, notes, reminderOffsetDays }
  });
}

export async function updateCalendarEvent(
  context: GraphQLContext,
  input: UpdateCalendarEventInput,
  repository: CalendarEventRepository
): Promise<CalendarEvent> {
  const userId = requireVerifiedUserId(context);
  if (!input.id) throw calendarError('Event ID is required.');

  const existing = await repository.findUnique({ where: { id: input.id, userId } });
  if (!existing) {
    throw calendarError('Calendar event was not found.', 'NOT_FOUND');
  }

  const scheduledDate = input.scheduledDate === undefined
    ? existing.scheduledDate
    : parseLocalDate(input.scheduledDate, 'Scheduled date');
  const recurrenceRule = input.recurrenceRule === undefined
    ? existing.recurrenceRule
    : input.recurrenceRule;
  const recurrenceEndDate = input.recurrenceEndDate === undefined
    ? existing.recurrenceEndDate
    : input.recurrenceEndDate
      ? parseLocalDate(input.recurrenceEndDate, 'Recurrence end date')
      : null;
  validateRecurrence(recurrenceRule, recurrenceEndDate, scheduledDate);

  const data: Parameters<CalendarEventRepository['update']>[0]['data'] = {};
  if (input.title !== undefined) data.title = validateTitle(input.title);
  if (input.scheduledDate !== undefined) data.scheduledDate = scheduledDate;
  if (input.recurrenceRule !== undefined) data.recurrenceRule = recurrenceRule;
  if (input.recurrenceEndDate !== undefined) data.recurrenceEndDate = recurrenceEndDate;
  if (input.notes !== undefined) data.notes = validateNotes(input.notes);
  if (input.reminderOffsetDays !== undefined) {
    data.reminderOffsetDays = validateReminderOffsetDays(input.reminderOffsetDays);
  }
  return repository.update({ where: { id: input.id }, data });
}

export async function deleteCalendarEvent(
  context: GraphQLContext,
  id: string,
  repository: CalendarEventRepository
): Promise<boolean> {
  const userId = requireVerifiedUserId(context);
  if (!id) throw calendarError('Event ID is required.');
  const existing = await repository.findUnique({ where: { id, userId } });
  if (!existing) {
    throw calendarError('Calendar event was not found.', 'NOT_FOUND');
  }
  await repository.delete({ where: { id } });
  return true;
}

export async function listMyAgenda(
  context: GraphQLContext,
  input: AgendaRangeInput,
  repository: CalendarEventRepository
): Promise<AgendaItem[]> {
  const userId = requireVerifiedUserId(context);
  const startDate = parseLocalDate(input.startDate, 'Start date');
  const endDate = parseLocalDate(input.endDate, 'End date');
  if (endDate < startDate) throw calendarError('End date cannot precede start date.');

  const [events, payables, receivables] = await Promise.all([
    repository.findMany({ where: { userId, scheduledDate: { lte: endDate } } }),
    repository.findPendingPayables({
      where: { userId, status: 'PENDING', deletedAt: null, dueDate: { gte: startDate, lte: endDate } }
    }),
    repository.findPendingReceivables({
      where: { userId, status: 'PENDING', deletedAt: null, dueDate: { gte: startDate, lte: endDate } }
    })
  ]);

  const eventItems = events.flatMap((event) =>
    calendarEventOccurrences(event, startDate, endDate).map((scheduledDate) => ({
      id: `EVENT:${event.id}:${toLocalDateKey(scheduledDate)}`,
      source: 'EVENT' as const,
      title: event.title,
      scheduledDate,
      status: 'SCHEDULED' as const,
      notes: event.notes ?? null
    }))
  );
  const payableItems = payables.map((item) => ({
    id: `PAYABLE:${item.id}`,
    source: 'PAYABLE' as const,
    title: item.description,
    scheduledDate: item.dueDate,
    status: 'PENDING' as const,
    notes: null
  }));
  const receivableItems = receivables.map((item) => ({
    id: `RECEIVABLE:${item.id}`,
    source: 'RECEIVABLE' as const,
    title: item.description,
    scheduledDate: item.dueDate,
    status: 'PENDING' as const,
    notes: null
  }));

  return [...eventItems, ...payableItems, ...receivableItems].sort(
    (left, right) => left.scheduledDate.getTime() - right.scheduledDate.getTime() || left.id.localeCompare(right.id)
  );
}
