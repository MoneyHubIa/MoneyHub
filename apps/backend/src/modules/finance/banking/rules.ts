import { GraphQLError } from 'graphql';

export function invalid(message: string): never {
  throw new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
}

export function cents(value: string, signed = false): bigint {
  if (!(signed ? /^-?\d{1,16}(\.\d{1,2})?$/ : /^\d{1,10}(\.\d{1,2})?$/).test(value)) invalid('Valor monetário inválido.');
  const negative = value.startsWith('-');
  const [whole = '0', fraction = ''] = value.replace('-', '').split('.');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (!signed && result <= 0n) invalid('Valor deve ser positivo.');
  return negative ? -result : result;
}

export function money(value: bigint): string {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

export function allocate(amount: bigint, available: bigint[]): bigint[] {
  const total = available.reduce((sum, value) => sum + value, 0n);
  if (amount <= 0n || amount > total) invalid('Pagamento excede saldo da fatura.');
  const result = available.map(value => amount * value / total);
  let remainder = amount - result.reduce((sum, value) => sum + value, 0n);
  for (let index = 0; remainder && index < result.length; index++) {
    if (result[index]! < available[index]!) { result[index] = result[index]! + 1n; remainder--; }
  }
  return result;
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

export function day(value: string): Date {
  const result = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(result.getTime()) || result.toISOString().slice(0, 10) !== value) invalid('Data inválida.');
  return result;
}

export type Schedule = { mode: 'ONCE' | 'INSTALLMENTS' | 'REPEAT' | 'FIXED'; first: number; total: number; frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM'; interval?: number; unit?: 'DAYS' | 'WEEKS' | 'MONTHS' };
export function installments(amount: string, dueDate: string, schedule: Schedule) {
  const value = cents(amount);
  const start = day(dueDate);
  const { first, total } = schedule;
  if (!Number.isInteger(first) || !Number.isInteger(total) || first < 1 || total < first || total > 1200) invalid('Parcelas devem estar entre 1 e 1200.');
  const interval = schedule.interval ?? 1;
  if (!Number.isInteger(interval) || interval < 1 || interval > 1200) invalid('Intervalo inválido.');
  const frequencies = { DAILY: ['DAYS', 1], WEEKLY: ['DAYS', 7], MONTHLY: ['MONTHS', 1], QUARTERLY: ['MONTHS', 3], YEARLY: ['MONTHS', 12], CUSTOM: [schedule.unit ?? 'DAYS', interval] } as const;
  const [unit, step] = frequencies[schedule.frequency];
  const result = [];
  for (let index = first; index <= total; index++) {
    const offset = (index - first) * step;
    let date: Date;
    if (unit === 'MONTHS') {
      date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1));
      date.setUTCDate(Math.min(start.getUTCDate(), new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()));
    } else date = new Date(start.getTime() + offset * (unit === 'WEEKS' ? 7 : 1) * 86400000);
    const part = schedule.mode === 'INSTALLMENTS' ? value / BigInt(total) + (BigInt(index) <= value % BigInt(total) ? 1n : 0n) : value;
    if (part <= 0n) invalid('Valor insuficiente para número de parcelas.');
    result.push({ number: index, amount: money(part), dueDate: date });
  }
  return result;
}

function easter(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451), n = h + l - 7 * m + 114;
  return new Date(Date.UTC(year, Math.floor(n / 31) - 1, n % 31 + 1));
}
export function nextBusinessDay(date: Date): Date {
  const result = new Date(date);
  for (;;) {
    const md = result.toISOString().slice(5, 10);
    const goodFriday = new Date(easter(result.getUTCFullYear()).getTime() - 2 * 86400000).toISOString().slice(0, 10);
    if (![0, 6].includes(result.getUTCDay()) && !['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'].includes(md) && result.toISOString().slice(0, 10) !== goodFriday) return result;
    result.setUTCDate(result.getUTCDate() + 1);
  }
}

export function statementDates(year: number, month: number, dueDay: number, closingDay: number, dynamicDays: number | null, business: boolean) {
  const due = new Date(Date.UTC(year, month, Math.min(dueDay, new Date(Date.UTC(year, month + 1, 0)).getUTCDate())));
  let closing: Date;
  if (dynamicDays !== null) closing = new Date(due.getTime() - dynamicDays * 86400000);
  else {
    const closingMonth = closingDay >= dueDay ? month - 1 : month;
    closing = new Date(Date.UTC(year, closingMonth, Math.min(closingDay, new Date(Date.UTC(year, closingMonth + 1, 0)).getUTCDate())));
  }
  return { closing, due: business ? nextBusinessDay(due) : due };
}
