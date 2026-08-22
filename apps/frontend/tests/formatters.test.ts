import {
  formatCurrency,
  formatDate,
  formatISOToRegionalDate,
  getCurrencySymbol,
  getDatePlaceholder,
  getLocaleForCurrency,
  parseRegionalDateToISO
} from '../src/utils/formatters';

describe('formatters utility', () => {
  describe('getLocaleForCurrency', () => {
    test('maps currencies to appropriate regional locales', () => {
      expect(getLocaleForCurrency('BRL')).toBe('pt-BR');
      expect(getLocaleForCurrency('USD')).toBe('en-US');
      expect(getLocaleForCurrency('EUR')).toBe('de-DE');
      expect(getLocaleForCurrency('unknown')).toBe('pt-BR');
    });
  });

  describe('getCurrencySymbol', () => {
    test('returns correct currency symbols', () => {
      expect(getCurrencySymbol('BRL')).toBe('R$');
      expect(getCurrencySymbol('USD')).toBe('$');
      expect(getCurrencySymbol('EUR')).toBe('€');
      expect(getCurrencySymbol('other')).toBe('R$');
    });
  });

  describe('getDatePlaceholder', () => {
    test('returns regional date input placeholder', () => {
      expect(getDatePlaceholder('BRL')).toBe('DD/MM/AAAA');
      expect(getDatePlaceholder('USD')).toBe('MM/DD/YYYY');
      expect(getDatePlaceholder('EUR')).toBe('DD/MM/AAAA');
    });
  });

  describe('formatDate', () => {
    const isoDate = '2026-08-05T00:00:00.000Z';

    test('formats BRL dates in DD/MM/YYYY order', () => {
      const formatted = formatDate(isoDate, 'BRL');
      expect(formatted).toBe('05/08/2026');
    });

    test('formats USD dates in MM/DD/YYYY order', () => {
      const formatted = formatDate(isoDate, 'USD');
      expect(formatted).toBe('08/05/2026');
    });

    test('formats EUR dates in DD.MM.YYYY order', () => {
      const formatted = formatDate(isoDate, 'EUR');
      // de-DE produces 05.08.2026 or localized equivalent
      expect(formatted).toMatch(/05[./]08[./]2026/);
    });

    test('gracefully handles invalid date string', () => {
      expect(formatDate('invalid-date', 'BRL')).toBe('invalid-date');
      expect(formatDate(null, 'BRL')).toBe('');
      expect(formatDate(undefined, 'BRL')).toBe('');
    });
  });

  describe('formatCurrency', () => {
    test('formats BRL currency with R$ and comma decimals', () => {
      const formatted = formatCurrency('1250.50', 'BRL');
      // pt-BR uses dot for thousands and comma for decimals
      expect(formatted).toBe('R$ 1.250,50');
    });

    test('formats USD currency with $ and dot decimals', () => {
      const formatted = formatCurrency('1250.50', 'USD');
      // en-US uses comma for thousands and dot for decimals
      expect(formatted).toBe('$ 1,250.50');
    });

    test('formats EUR currency with €', () => {
      const formatted = formatCurrency('1250.50', 'EUR');
      expect(formatted).toMatch(/€ 1[.,]250[.,]50/);
    });

    test('handles zero and null amounts gracefully', () => {
      expect(formatCurrency(0, 'BRL')).toBe('R$ 0,00');
      expect(formatCurrency(null, 'USD')).toBe('$ 0.00');
      expect(formatCurrency(undefined, 'BRL')).toBe('R$ 0,00');
    });
  });

  describe('formatISOToRegionalDate', () => {
    test('formats ISO strings to localized display format', () => {
      expect(formatISOToRegionalDate('2026-08-22', 'BRL')).toBe('22/08/2026');
      expect(formatISOToRegionalDate('2026-08-22', 'USD')).toBe('08/22/2026');
      expect(formatISOToRegionalDate('2026-08-22T10:00:00.000Z', 'BRL')).toBe('22/08/2026');
      expect(formatISOToRegionalDate('', 'BRL')).toBe('');
    });
  });

  describe('parseRegionalDateToISO', () => {
    test('parses Brazilian DD/MM/YYYY and DD-MM-YYYY dates to ISO', () => {
      expect(parseRegionalDateToISO('22/08/2026', 'BRL')).toBe('2026-08-22');
      expect(parseRegionalDateToISO('22-08-2026', 'BRL')).toBe('2026-08-22');
      expect(parseRegionalDateToISO('05/01/2026', 'BRL')).toBe('2026-01-05');
    });

    test('parses American MM/DD/YYYY and MM-DD-YYYY dates to ISO', () => {
      expect(parseRegionalDateToISO('08/22/2026', 'USD')).toBe('2026-08-22');
      expect(parseRegionalDateToISO('08-22-2026', 'USD')).toBe('2026-08-22');
      expect(parseRegionalDateToISO('01/05/2026', 'USD')).toBe('2026-01-05');
    });

    test('accepts direct ISO YYYY-MM-DD format', () => {
      expect(parseRegionalDateToISO('2026-08-22', 'BRL')).toBe('2026-08-22');
    });

    test('rejects invalid dates and letters', () => {
      expect(parseRegionalDateToISO('32/08/2026', 'BRL')).toBe(null);
      expect(parseRegionalDateToISO('22/13/2026', 'BRL')).toBe(null);
      expect(parseRegionalDateToISO('invalid', 'BRL')).toBe(null);
      expect(parseRegionalDateToISO('', 'BRL')).toBe(null);
    });
  });
});

