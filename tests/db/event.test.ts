import { describe, it, expect, vi, afterEach } from 'vitest';
import { src } from '../mock-path';
import type { EventInput } from '../../src/lib/event-validation';

type SqlImpl = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;

// Load src/db/event with src/db/client's `sql` replaced by a spy, so no real DB is touched.
async function withMockedSql(impl: SqlImpl) {
  vi.resetModules();
  const sql = vi.fn(impl);
  vi.doMock(src('db/client'), () => ({ sql }));
  const mod = await import('../../src/db/event');
  return { ...mod, sql };
}

const call = (sql: ReturnType<typeof vi.fn>, i: number) =>
  sql.mock.calls[i] as [TemplateStringsArray, ...unknown[]];
const text = (sql: ReturnType<typeof vi.fn>, i: number) => call(sql, i)[0].join('');
const values = (sql: ReturnType<typeof vi.fn>, i: number) => call(sql, i).slice(1);

const row = {
  id: 1,
  slug: '2026-09-12-kickoff',
  date: '2026-09-12',
  title: 'Kickoff',
  time: null,
  location: null,
  created_at: '2026-01-01T00:00:00Z',
};

afterEach(() => {
  vi.doUnmock(src('db/client'));
  vi.resetModules();
});

describe('listEvents', () => {
  it('selects the events newest-date first', async () => {
    const { listEvents, sql } = await withMockedSql(async () => [row]);
    expect(await listEvents()).toEqual([row]);
    expect(text(sql, 0)).toMatch(/FROM events/i);
    expect(text(sql, 0)).toMatch(/ORDER BY date DESC, id DESC/i);
  });
});

describe('getEvent', () => {
  it('returns the row for an existing id', async () => {
    const { getEvent } = await withMockedSql(async () => [row]);
    expect(await getEvent(1)).toEqual(row);
  });

  it('returns null when no row matches', async () => {
    const { getEvent } = await withMockedSql(async () => []);
    expect(await getEvent(999)).toBeNull();
  });
});

describe('insertEvent', () => {
  const base: EventInput = { date: '  2026-09-12  ', title: '  Kickoff  ', time: '', location: '   ' };

  it('trims inputs, stores empty optionals as null, and inserts the computed slug', async () => {
    const { insertEvent, sql } = await withMockedSql(async () => [row]);
    await insertEvent(base);
    expect(text(sql, 0)).toMatch(/INSERT INTO events/i);
    // (slug, date, title, time, location)
    expect(values(sql, 0)).toEqual(['2026-09-12-kickoff', '2026-09-12', 'Kickoff', null, null]);
  });

  it('appends a numeric suffix and retries on a unique-violation', async () => {
    let attempt = 0;
    const { insertEvent, sql } = await withMockedSql(async () => {
      attempt++;
      if (attempt === 1) throw Object.assign(new Error('dup'), { code: '23505' });
      return [row];
    });
    await insertEvent({ date: '2026-09-12', title: 'Kickoff', time: '', location: '' });
    expect(sql).toHaveBeenCalledTimes(2);
    expect(values(sql, 0)[0]).toBe('2026-09-12-kickoff');
    expect(values(sql, 1)[0]).toBe('2026-09-12-kickoff-2');
  });

  it('propagates a non-unique-violation error', async () => {
    const { insertEvent } = await withMockedSql(async () => {
      throw Object.assign(new Error('connection reset'), { code: '08006' });
    });
    await expect(insertEvent({ date: '2026-09-12', title: '', time: '', location: '' })).rejects.toThrow(
      'connection reset',
    );
  });
});

describe('updateEvent', () => {
  const input: EventInput = { date: '2026-10-01', title: 'New Topic', time: '', location: '' };

  it('regenerates the slug and cascades the rename into rsvps', async () => {
    const { updateEvent, sql } = await withMockedSql(async () => [{ ...row, id: 7, slug: '2026-10-01-new-topic' }]);
    await updateEvent(7, input);
    const sqlText = text(sql, 0);
    expect(sqlText).toMatch(/UPDATE events/i);
    expect(sqlText).toMatch(/UPDATE rsvps\s+SET meeting/i);
    expect(values(sql, 0)).toContain('2026-10-01-new-topic');
    expect(values(sql, 0)).toContain(7);
  });

  it('appends a suffix and retries the update on a unique-violation', async () => {
    let attempt = 0;
    const { updateEvent, sql } = await withMockedSql(async () => {
      attempt++;
      if (attempt === 1) throw Object.assign(new Error('dup'), { code: '23505' });
      return [{ ...row, id: 7 }];
    });
    await updateEvent(7, input);
    expect(sql).toHaveBeenCalledTimes(2);
    expect(values(sql, 1)).toContain('2026-10-01-new-topic-2');
  });
});

describe('deleteEvent', () => {
  it('removes the event and its rsvps in a single statement', async () => {
    const { deleteEvent, sql } = await withMockedSql(async () => []);
    await deleteEvent(42);
    expect(sql).toHaveBeenCalledTimes(1);
    const sqlText = text(sql, 0);
    expect(sqlText).toMatch(/DELETE FROM events/i);
    expect(sqlText).toMatch(/DELETE FROM rsvps/i);
    expect(values(sql, 0)).toContain(42);
  });
});
