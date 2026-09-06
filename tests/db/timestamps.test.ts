import { describe, it, expect } from 'vitest';
import { parseTimestamp, parseDate } from '../../src/db/timestamps';

// The driver hands these parsers raw Postgres text output; every shape below is something it can emit.
describe('parseTimestamp', () => {
  it.each([
    ['2026-08-05 17:52:04.123+00', '2026-08-05T17:52:04.123Z'],
    ['2026-08-05 17:52:04+00', '2026-08-05T17:52:04.000Z'],
    ['2026-08-05 17:52:04.123456+00', '2026-08-05T17:52:04.123Z'],
    ['2026-08-05 17:52:04.123', '2026-08-05T17:52:04.123Z'],
    ['2026-08-05 17:52:04+02', '2026-08-05T15:52:04.000Z'],
    ['1999-12-31 23:59:59.5-05:30', '2000-01-01T05:29:59.500Z'],
  ])('normalizes %s to ISO-8601 UTC', (input, expected) => {
    expect(parseTimestamp(input)).toBe(expected);
  });

  it('returns a string, never a Date — the crash that motivated this parser', () => {
    const result = parseTimestamp('2026-08-05 17:52:04.123+00');
    expect(typeof result).toBe('string');
    expect(result).not.toBeInstanceOf(Date);
    expect(() => result.localeCompare('x')).not.toThrow();
  });

  it('orders lexicographically the same way it orders chronologically', () => {
    const raw = ['2026-08-05 17:52:04.123+00', '2026-08-04 09:00:00+00', '2026-08-05 17:52:04.124+00'];
    const iso = raw.map(parseTimestamp);
    const lexicographic = [...iso].sort((a, b) => b.localeCompare(a));
    const chronological = [...iso].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    expect(lexicographic).toEqual(chronological);
  });

  it.each(['infinity', '-infinity'])('passes %s through untouched', (input) => {
    expect(parseTimestamp(input)).toBe(input);
  });

  it('leaves a bare date alone so DATE semantics are never widened to a timestamp', () => {
    expect(parseTimestamp('2026-09-15')).toBe('2026-09-15');
  });
});

describe('parseDate', () => {
  it.each(['2026-09-15', '2026-12-31'])('keeps %s as a plain YYYY-MM-DD string', (input) => {
    expect(parseDate(input)).toBe(input);
  });

  it('stays comparable as a string, which the events date filter relies on', () => {
    expect(parseDate('2026-09-15') >= '2026-08-05').toBe(true);
    expect(parseDate('2026-07-15') >= '2026-08-05').toBe(false);
  });
});
