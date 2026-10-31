import { defaultSchedule, scheduleInput, validSchedule } from '../src/components/CommitmentSchedule';

describe('commitment schedule validation and normalization', () => {
  it('accepts one-time schedules and validates repeated/custom schedules', () => {
    expect(validSchedule(defaultSchedule())).toBe(true);
    expect(validSchedule({ ...defaultSchedule(), mode: 'INSTALLMENTS', first: '2', total: '3' })).toBe(true);
    expect(validSchedule({ ...defaultSchedule(), mode: 'REPEAT', first: '4', total: '3' })).toBe(false);
    expect(validSchedule({ ...defaultSchedule(), mode: 'REPEAT', frequency: 'CUSTOM', interval: '0' })).toBe(false);
  });

  it('validates effective dates and installment overrides', () => {
    expect(validSchedule({ ...defaultSchedule(), effective: true, effectiveDate: '2026-02-30' })).toBe(false);
    expect(validSchedule({ ...defaultSchedule(), overrides: [{ number: 1, amount: '1.001' }] })).toBe(false);
    expect(validSchedule({ ...defaultSchedule(), overrides: [{ number: 1, dueDate: '2026-02-30' }] })).toBe(false);
    expect(validSchedule({ ...defaultSchedule(), overrides: [{ number: 1, effectiveDate: 'invalid' }] })).toBe(false);
    expect(validSchedule({ ...defaultSchedule(), overrides: [{ number: 1, amount: '2.50', dueDate: '2026-02-28', effectiveDate: null }] })).toBe(true);
  });

  it('normalizes fields that only apply to repeated schedules', () => {
    expect(scheduleInput({ ...defaultSchedule(), mode: 'ONCE', first: '4', total: '8', frequency: 'CUSTOM', interval: '5', unit: 'WEEKS' })).toEqual({ mode: 'ONCE', first: 1, total: 1, frequency: 'MONTHLY', interval: 1, unit: 'MONTHS' });
    expect(scheduleInput({ ...defaultSchedule(), mode: 'FIXED', first: '4', total: '8' })).toEqual({ mode: 'FIXED', first: 1, total: 12, frequency: 'MONTHLY', interval: 1, unit: 'MONTHS' });
    expect(scheduleInput({ ...defaultSchedule(), mode: 'REPEAT', frequency: 'CUSTOM', interval: '2', unit: 'WEEKS' })).toEqual({ mode: 'REPEAT', first: 1, total: 1, frequency: 'CUSTOM', interval: 2, unit: 'WEEKS' });
    expect(scheduleInput({ ...defaultSchedule(), mode: 'INSTALLMENTS', frequency: 'MONTHLY', interval: '4', unit: 'WEEKS' })).toEqual({ mode: 'INSTALLMENTS', first: 1, total: 1, frequency: 'MONTHLY', interval: 1, unit: 'MONTHS' });
  });
});
