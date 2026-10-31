export function validText(value: string, max: number): boolean {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

export function validEmail(value: string): boolean {
  return value.trim().length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function decimal(value: string, digits = 10, signed = false): string | null {
  const normalized = value.trim().replace(',', '.');
  if (!new RegExp(`^${signed ? '-?' : ''}\\d{1,${digits}}(?:\\.\\d{1,2})?$`).test(normalized)) return null;
  if (!signed && !/[1-9]/.test(normalized)) return null;
  const [whole = '0', fraction = ''] = normalized.split('.');
  return `${whole.replace(/^(-?)0+(?=\d)/, '$1')}.${fraction.padEnd(2, '0')}`;
}

export function integer(value: string, max = 1200): boolean {
  return /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max;
}

export function isoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
