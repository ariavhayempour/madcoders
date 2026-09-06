import { describe, it, expect } from 'vitest';
import {
  parseMonthParam,
  resolveFocusMonth,
  shiftMonth,
  monthParam,
  buildMonthCells,
  eventsInMonth,
  groupByDate,
  nearestUpcoming,
} from '../../src/lib/meeting-calendar';
import type { MeetingView } from '../../src/lib/split-meetings';

const TODAY = '2050-06-15';

describe('parseMonthParam', () => {
  it('parses a valid YYYY-MM param', () => {
    expect(parseMonthParam('2050-03')).toEqual({ year: 2050, month: 2 });
  });

  it('rejects malformed or out-of-range input', () => {
    expect(parseMonthParam(null)).toBeNull();
    expect(parseMonthParam(undefined)).toBeNull();
    expect(parseMonthParam('')).toBeNull();
    expect(parseMonthParam('2050-3')).toBeNull();
    expect(parseMonthParam('2050-13')).toBeNull();
    expect(parseMonthParam('not-a-month')).toBeNull();
  });
});

describe('resolveFocusMonth', () => {
  const events: MeetingView[] = [
    { id: 'past', date: '2050-01-10' },
    { id: 'future', date: '2050-08-20' },
  ];

  it('prefers a valid ?month= param over any event', () => {
    expect(resolveFocusMonth('2099-12', events, TODAY)).toEqual({ year: 2099, month: 11 });
  });

  it('falls back to the month of the nearest upcoming event', () => {
    expect(resolveFocusMonth(null, events, TODAY)).toEqual({ year: 2050, month: 7 });
  });

  it('falls back to the current month when nothing is upcoming', () => {
    const allPast: MeetingView[] = [{ id: 'past', date: '2050-01-10' }];
    expect(resolveFocusMonth(null, allPast, TODAY)).toEqual({ year: 2050, month: 5 });
  });

  it('falls back to the current month when there are no events at all', () => {
    expect(resolveFocusMonth(undefined, [], TODAY)).toEqual({ year: 2050, month: 5 });
  });

  it('ignores a malformed param and falls through to the event-based default', () => {
    expect(resolveFocusMonth('garbage', events, TODAY)).toEqual({ year: 2050, month: 7 });
  });
});

describe('shiftMonth', () => {
  it('moves forward within a year', () => {
    expect(shiftMonth(2050, 5, 1)).toEqual({ year: 2050, month: 6 });
  });

  it('rolls over into the next year', () => {
    expect(shiftMonth(2050, 11, 1)).toEqual({ year: 2051, month: 0 });
  });

  it('rolls back into the previous year', () => {
    expect(shiftMonth(2050, 0, -1)).toEqual({ year: 2049, month: 11 });
  });
});

describe('monthParam', () => {
  it('formats as zero-padded YYYY-MM', () => {
    expect(monthParam(2050, 0)).toBe('2050-01');
    expect(monthParam(2050, 11)).toBe('2050-12');
  });
});

describe('buildMonthCells', () => {
  it('covers full weeks starting on Sunday and marks today', () => {
    const cells = buildMonthCells(2050, 5, TODAY); // June 2050, starts on a Wednesday
    expect(cells.length % 7).toBe(0);
    expect(new Date(`${cells[0].iso}T00:00:00Z`).getUTCDay()).toBe(0); // grid starts on a Sunday
    expect(cells.some((c) => c.iso === TODAY && c.isToday)).toBe(true);
    const inMonthDays = cells.filter((c) => c.inMonth).map((c) => c.day);
    expect(inMonthDays).toEqual(Array.from({ length: 30 }, (_, i) => i + 1)); // June has 30 days
  });

  it('trims trailing weeks that are entirely next-month, down to a 4-week floor', () => {
    // February 2026 starts on a Sunday and has 28 days — an exact 4-week grid with two spillover weeks trimmed.
    const cells = buildMonthCells(2026, 1, TODAY);
    expect(cells.length).toBe(28);
    expect(cells.every((c) => c.inMonth)).toBe(true);
  });

  it('keeps a 5-week grid when the last week is only partially next-month', () => {
    const cells = buildMonthCells(2050, 5, TODAY); // June 2050 spills 2 days into July
    expect(cells.length).toBe(35);
  });
});

describe('eventsInMonth + groupByDate', () => {
  const events: MeetingView[] = [
    { id: 'b', date: '2050-06-20', title: 'Second' },
    { id: 'a', date: '2050-06-05', title: 'First' },
    { id: 'c', date: '2050-06-20', title: 'Also second' },
    { id: 'd', date: '2050-07-01', title: 'Next month' },
  ];

  it('filters to the given month and sorts ascending', () => {
    const june = eventsInMonth(events, 2050, 5);
    expect(june.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('groups same-day meetings together in date order', () => {
    const groups = groupByDate(eventsInMonth(events, 2050, 5));
    expect(groups).toEqual([
      { date: '2050-06-05', items: [events[1]] },
      { date: '2050-06-20', items: [events[0], events[2]] },
    ]);
  });

  it('returns no groups for a month with no events', () => {
    expect(groupByDate(eventsInMonth(events, 2050, 8))).toEqual([]);
  });
});

describe('nearestUpcoming', () => {
  it('picks the soonest event on or after today', () => {
    const events: MeetingView[] = [
      { id: 'past', date: '2050-01-01' },
      { id: 'far', date: '2050-12-01' },
      { id: 'soon', date: '2050-06-16' },
    ];
    expect(nearestUpcoming(events, TODAY)?.id).toBe('soon');
  });

  it('returns undefined when nothing is upcoming', () => {
    expect(nearestUpcoming([{ id: 'past', date: '2050-01-01' }], TODAY)).toBeUndefined();
  });
});
