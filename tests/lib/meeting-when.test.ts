import { describe, it, expect } from 'vitest';
import { describeMeetingWhen } from '../../src/lib/meeting-when';

describe('describeMeetingWhen', () => {
  it('labels today as "Today · <date>" and buckets it as upcoming', () => {
    const result = describeMeetingWhen('2026-07-15', '2026-07-15');
    expect(result.bucket).toBe('upcoming');
    expect(result.label).toBe('Today · Jul 15');
  });

  it('labels the day after today as "Tomorrow · <date>"', () => {
    const result = describeMeetingWhen('2026-07-16', '2026-07-15');
    expect(result.bucket).toBe('upcoming');
    expect(result.label).toBe('Tomorrow · Jul 16');
  });

  it('labels a farther-future date with just the short date', () => {
    const result = describeMeetingWhen('2026-07-30', '2026-07-15');
    expect(result.bucket).toBe('upcoming');
    expect(result.label).toBe('Jul 30');
  });

  it('labels any past date as "Past · <date>"', () => {
    const result = describeMeetingWhen('2026-07-01', '2026-07-15');
    expect(result.bucket).toBe('past');
    expect(result.label).toBe('Past · Jul 1');
  });

  it('handles a year boundary in the short date', () => {
    const result = describeMeetingWhen('2027-01-05', '2026-12-20');
    expect(result.bucket).toBe('upcoming');
    expect(result.label).toBe('Jan 5');
  });
});
