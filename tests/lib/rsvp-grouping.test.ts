import { describe, it, expect } from 'vitest';
import { groupRsvpsByMeeting } from '../../src/lib/rsvp-grouping';
import type { RsvpRow } from '../../src/db/schema';

function row(overrides: Partial<RsvpRow>): RsvpRow {
  return {
    id: 1,
    name: 'Ada',
    email: 'ada@example.com',
    meeting: 'Kickoff',
    status: 'pending',
    created_at: '2026-07-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('groupRsvpsByMeeting', () => {
  it('returns an empty array for no rows', () => {
    expect(groupRsvpsByMeeting([])).toEqual([]);
  });

  it('groups a single meeting into one group', () => {
    const rows = [
      row({ id: 1, name: 'Ada', meeting: 'Kickoff', created_at: '2026-07-01T10:00:00.000Z' }),
      row({ id: 2, name: 'Grace', meeting: 'Kickoff', created_at: '2026-07-02T10:00:00.000Z' }),
    ];

    const groups = groupRsvpsByMeeting(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0].meeting).toBe('Kickoff');
    expect(groups[0].rsvps.map((r) => r.id)).toEqual([2, 1]);
  });

  it('orders rows newest-first within a group regardless of input order', () => {
    const rows = [
      row({ id: 1, meeting: 'Kickoff', created_at: '2026-07-01T10:00:00.000Z' }),
      row({ id: 2, meeting: 'Kickoff', created_at: '2026-07-03T10:00:00.000Z' }),
      row({ id: 3, meeting: 'Kickoff', created_at: '2026-07-02T10:00:00.000Z' }),
    ];

    const groups = groupRsvpsByMeeting(rows);

    expect(groups[0].rsvps.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it('orders meetings by their most-recent RSVP, newest meeting first', () => {
    const rows = [
      row({ id: 1, meeting: 'Kickoff', created_at: '2026-07-01T10:00:00.000Z' }),
      row({ id: 2, meeting: 'Finale', created_at: '2026-07-10T10:00:00.000Z' }),
      row({ id: 3, meeting: 'Midterm', created_at: '2026-07-05T10:00:00.000Z' }),
    ];

    const groups = groupRsvpsByMeeting(rows);

    expect(groups.map((g) => g.meeting)).toEqual(['Finale', 'Midterm', 'Kickoff']);
  });

  it('ranks a meeting by its newest RSVP, not by its row count', () => {
    const rows = [
      row({ id: 1, meeting: 'Busy', created_at: '2026-07-01T10:00:00.000Z' }),
      row({ id: 2, meeting: 'Busy', created_at: '2026-07-02T10:00:00.000Z' }),
      row({ id: 3, meeting: 'Recent', created_at: '2026-07-09T10:00:00.000Z' }),
    ];

    const groups = groupRsvpsByMeeting(rows);

    expect(groups.map((g) => g.meeting)).toEqual(['Recent', 'Busy']);
  });

  it('keeps identical timestamps in stable input order', () => {
    const ts = '2026-07-01T10:00:00.000Z';
    const rows = [
      row({ id: 1, meeting: 'Kickoff', created_at: ts }),
      row({ id: 2, meeting: 'Kickoff', created_at: ts }),
      row({ id: 3, meeting: 'Kickoff', created_at: ts }),
    ];

    const groups = groupRsvpsByMeeting(rows);

    expect(groups[0].rsvps.map((r) => r.id)).toEqual([1, 2, 3]);
  });
});
