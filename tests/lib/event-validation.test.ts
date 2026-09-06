import { describe, it, expect } from 'vitest';
import { validateEvent, slugifyEvent, extractTime, type EventInput } from '../../src/lib/event-validation';
import { MAX_TITLE, MAX_TIME, MAX_LOCATION } from '../../src/lib/limits';

const valid: EventInput = {
  date: '2026-09-12',
  title: 'Kickoff & journal club intro',
  time: '6:00 PM',
  location: 'Chamberlin Hall 2103',
};

const fields = (input: EventInput): string[] => validateEvent(input).map((e) => e.field);

describe('validateEvent — date', () => {
  it('flags a missing date', () => {
    expect(fields({ ...valid, date: '' })).toContain('date');
  });

  it('flags a whitespace-only date', () => {
    expect(fields({ ...valid, date: '   ' })).toContain('date');
  });

  it('flags a non-ISO format (slashes)', () => {
    expect(fields({ ...valid, date: '09/12/2026' })).toContain('date');
  });

  it('flags a non-zero-padded ISO date', () => {
    expect(fields({ ...valid, date: '2026-9-12' })).toContain('date');
  });

  it('flags a calendar-invalid date (month 13, day 40)', () => {
    expect(fields({ ...valid, date: '2026-13-40' })).toContain('date');
  });

  it('flags a calendar-invalid day (Feb 30)', () => {
    expect(fields({ ...valid, date: '2026-02-30' })).toContain('date');
  });

  it('accepts a valid ISO date with surrounding whitespace', () => {
    expect(fields({ ...valid, date: '  2026-09-12  ' })).not.toContain('date');
  });
});

describe('validateEvent — required fields', () => {
  it('flags a missing title', () => {
    expect(fields({ ...valid, title: '' })).toContain('title');
  });

  it('flags a whitespace-only title', () => {
    expect(fields({ ...valid, title: '   ' })).toContain('title');
  });

  it('flags a missing time', () => {
    expect(fields({ ...valid, time: '' })).toContain('time');
  });

  it('flags a missing location', () => {
    expect(fields({ ...valid, location: '' })).toContain('location');
  });

  it('flags an over-length title', () => {
    expect(fields({ ...valid, title: 'a'.repeat(MAX_TITLE + 1) })).toContain('title');
  });

  it('flags an over-length time', () => {
    expect(fields({ ...valid, time: 'a'.repeat(MAX_TIME + 1) })).toContain('time');
  });

  it('flags an over-length location', () => {
    expect(fields({ ...valid, location: 'a'.repeat(MAX_LOCATION + 1) })).toContain('location');
  });

  it('accepts a title exactly at the cap', () => {
    expect(fields({ ...valid, title: 'a'.repeat(MAX_TITLE) })).not.toContain('title');
  });
});

describe('validateEvent — valid input', () => {
  it('returns no errors for a fully valid event', () => {
    expect(validateEvent(valid)).toEqual([]);
  });

  it('flags every field when only whitespace is given', () => {
    expect(fields({ date: '', title: '', time: '', location: '' })).toEqual(
      expect.arrayContaining(['date', 'title', 'time', 'location']),
    );
  });
});

describe('slugifyEvent', () => {
  it('returns the date alone when the title is empty', () => {
    expect(slugifyEvent('2026-09-12', '')).toBe('2026-09-12');
  });

  it('returns the date alone when the title is whitespace-only', () => {
    expect(slugifyEvent('2026-09-12', '   ')).toBe('2026-09-12');
  });

  it('appends a kebab-cased title', () => {
    expect(slugifyEvent('2026-09-12', 'Kickoff')).toBe('2026-09-12-kickoff');
  });

  it('lowercases and maps non-alphanumerics to hyphens', () => {
    expect(slugifyEvent('2026-09-12', 'Kickoff & Journal Club Intro')).toBe('2026-09-12-kickoff-journal-club-intro');
  });

  it('collapses repeated separators and trims leading/trailing hyphens', () => {
    expect(slugifyEvent('2026-09-12', '  --Hello,   World!!  ')).toBe('2026-09-12-hello-world');
  });

  it('is deterministic for the same input', () => {
    expect(slugifyEvent('2026-09-12', 'Kickoff')).toBe(slugifyEvent('2026-09-12', 'Kickoff'));
  });
});

describe('extractTime', () => {
  it('prefers explicit time field if provided', () => {
    const form = new FormData();
    form.append('time', '6:00 PM');
    expect(extractTime(form)).toBe('6:00 PM');
  });

  it('combines time_val and time_ampm', () => {
    const form = new FormData();
    form.append('time_val', '6:00');
    form.append('time_ampm', 'PM');
    expect(extractTime(form)).toBe('6:00 PM');
  });

  it('handles AM correctly', () => {
    const form = new FormData();
    form.append('time_val', '10:30');
    form.append('time_ampm', 'AM');
    expect(extractTime(form)).toBe('10:30 AM');
  });

  it('does not duplicate AM/PM if typed in time_val', () => {
    const form = new FormData();
    form.append('time_val', '6:00 PM');
    form.append('time_ampm', 'PM');
    expect(extractTime(form)).toBe('6:00 PM');
  });

  it('returns empty string if time_val is empty', () => {
    const form = new FormData();
    form.append('time_val', '  ');
    form.append('time_ampm', 'PM');
    expect(extractTime(form)).toBe('');
  });
});

