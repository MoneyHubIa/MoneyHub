export type SupportedCurrency = 'BRL' | 'USD' | 'EUR' | string;

export function getLocaleForCurrency(currency: SupportedCurrency = 'BRL'): string {
  switch (currency.toUpperCase()) {
    case 'USD':
      return 'en-US';
    case 'EUR':
      return 'de-DE';
    case 'BRL':
    default:
      return 'pt-BR';
  }
}

export function getCurrencySymbol(currency: SupportedCurrency = 'BRL'): string {
  switch (currency.toUpperCase()) {
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'BRL':
    default:
      return 'R$';
  }
}

export function getDatePlaceholder(currency: SupportedCurrency = 'BRL'): string {
  switch (currency.toUpperCase()) {
    case 'USD':
      return 'MM/DD/YYYY';
    case 'BRL':
    case 'EUR':
    default:
      return 'DD/MM/AAAA';
  }
}

/**
 * Formats a date according to the currency / region locale.
 * e.g.,
 * - BRL: DD/MM/YYYY (22/08/2026)
 * - USD: MM/DD/YYYY (08/22/2026)
 * - EUR: DD.MM.YYYY or DD/MM/YYYY (22.08.2026)
 */
export function formatDate(
  dateInput: string | Date | number | undefined | null,
  currency: SupportedCurrency = 'BRL',
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '';

  try {
    const date = typeof dateInput === 'object' && dateInput instanceof Date
      ? dateInput
      : new Date(dateInput);

    if (isNaN(date.getTime())) {
      return String(dateInput);
    }

    const locale = getLocaleForCurrency(currency);
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'UTC',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      ...options
    };

    return new Intl.DateTimeFormat(locale, defaultOptions).format(date);
  } catch {
    return String(dateInput);
  }
}

/**
 * Formats a currency amount with symbol and regional number separators.
 * e.g.,
 * - BRL: R$ 1.500,00
 * - USD: $ 1,500.00
 * - EUR: € 1.500,00
 */
export function formatCurrency(
  amountInput: string | number | undefined | null,
  currency: SupportedCurrency = 'BRL'
): string {
  const num = Number(amountInput ?? 0);
  if (isNaN(num)) {
    return `${getCurrencySymbol(currency)} 0,00`;
  }

  const locale = getLocaleForCurrency(currency);
  const symbol = getCurrencySymbol(currency);

  const formattedNumber = num.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return `${symbol} ${formattedNumber}`;
}

/**
 * Formats an ISO string (YYYY-MM-DD or full ISO) to localized date string (DD/MM/AAAA or MM/DD/YYYY).
 */
export function formatISOToRegionalDate(
  isoDateStr: string | undefined | null,
  currency: SupportedCurrency = 'BRL'
): string {
  if (!isoDateStr) return '';
  const clean = isoDateStr.split('T')[0] ?? isoDateStr;
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0]?.length === 4) {
    const [y, m, d] = parts;
    if (currency.toUpperCase() === 'USD') {
      return `${m}/${d}/${y}`;
    }
    return `${d}/${m}/${y}`;
  }
  return formatDate(isoDateStr, currency);
}

/**
 * Parses a regional date string (e.g. DD/MM/AAAA, DD-MM-AAAA, or MM/DD/YYYY for USD) to ISO YYYY-MM-DD.
 */
export function parseRegionalDateToISO(
  dateStr: string | undefined | null,
  currency: SupportedCurrency = 'BRL'
): string | null {
  if (!dateStr || !dateStr.trim()) return null;
  const trimmed = dateStr.trim();

  // If already ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    if (m! >= 1 && m! <= 12 && d! >= 1 && d! <= 31 && y! >= 1900 && y! <= 2100) {
      return trimmed;
    }
    return null;
  }

  // Matches separator /, -, or .
  const parts = trimmed.split(/[/.-]/);
  if (parts.length !== 3) return null;

  let day: number;
  let month: number;
  let year: number;

  if (currency.toUpperCase() === 'USD') {
    // MM/DD/YYYY
    month = Number(parts[0]);
    day = Number(parts[1]);
    year = Number(parts[2]);
  } else {
    // DD/MM/YYYY
    day = Number(parts[0]);
    month = Number(parts[1]);
    year = Number(parts[2]);
  }

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (year < 100) {
    year += 2000;
  }

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1900 || year > 2100) return null;

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

