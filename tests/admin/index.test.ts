import { describe, it, expect, vi, afterEach } from 'vitest';
import { src } from '../mock-path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import type { EventRow, SubmissionRow } from '../../src/db/schema';
import { parseTimestamp } from '../../src/db/timestamps';

// Built through the real parser so the fixture carries production's exact shape, not a hand-written guess.
const submissionRow = (over: Partial<SubmissionRow> = {}): SubmissionRow => ({
  id: 1,
  name: 'Bucky Badger',
  email: 'bucky@wisc.edu',
  submission_type: 'inquiry',
  message: 'Hello',
  is_read: false,
  created_at: parseTimestamp('2026-08-05 17:52:04.123+00'),
  ...over,
});

const eventRow: EventRow = {
  id: 7,
  slug: '2099-12-31-future',
  date: '2099-12-31',
  title: 'Future session',
  time: '6:00 PM',
  location: 'Chamberlin Hall 2103',
  created_at: '2099-01-01T00:00:00Z',
};

// Load the dashboard with all three DB reads replaced by spies (CI has no DATABASE_URL).
async function loadDashboard(opts: { events?: EventRow[]; submissions?: SubmissionRow[] } = {}) {
  vi.resetModules();
  vi.doMock(src('db/rsvp'), () => ({ listRsvps: vi.fn(async () => []) }));
  vi.doMock(src('db/submission'), () => ({ listSubmissions: vi.fn(async () => opts.submissions ?? []) }));
  const listEvents = vi.fn(async () => opts.events ?? []);
  vi.doMock(src('db/event'), () => ({ listEvents }));
  const { default: Comp } = await import('../../src/pages/admin/index.astro');
  return { Comp, listEvents };
}

afterEach(() => {
  vi.doUnmock(src('db/rsvp'));
  vi.doUnmock(src('db/submission'));
  vi.doUnmock(src('db/event'));
  vi.resetModules();
});

describe('GET /admin — Events section', () => {
  it('renders an Events section with a link to manage events', async () => {
    const { Comp } = await loadDashboard({ events: [eventRow] });
    const html = await (await AstroContainer.create()).renderToString(Comp);
    expect(html).toMatch(/Events/);
    expect(html).toMatch(/<a[^>]*href="\/admin\/events"/);
  });

  it('lists each upcoming meeting with its formatted date and title', async () => {
    const { Comp } = await loadDashboard({ events: [eventRow] });
    const html = await (await AstroContainer.create()).renderToString(Comp);
    expect(html).toContain('Dec 31'); // 2099-12-31 formatted for the snapshot
    expect(html).toContain('Future session');
  });

  it('shows an empty state when there are no upcoming meetings', async () => {
    const { Comp } = await loadDashboard({ events: [] });
    const html = await (await AstroContainer.create()).renderToString(Comp);
    expect(html).toMatch(/no upcoming meetings/i);
  });

  it('reads events for the section', async () => {
    const { Comp, listEvents } = await loadDashboard({ events: [eventRow] });
    await (await AstroContainer.create()).renderToString(Comp);
    expect(listEvents).toHaveBeenCalled();
  });
});

describe('GET /admin — recent submissions', () => {
  it('renders submissions whose timestamps came through the driver parser', async () => {
    const { Comp } = await loadDashboard({ submissions: [submissionRow()] });
    const html = await (await AstroContainer.create()).renderToString(Comp);
    expect(html).toContain('Bucky Badger');
    expect(html).toContain('bucky@wisc.edu');
  });

  it('sorts newest first', async () => {
    const { Comp } = await loadDashboard({
      submissions: [
        submissionRow({ id: 1, name: 'Older', created_at: parseTimestamp('2026-08-01 09:00:00+00') }),
        submissionRow({ id: 2, name: 'Newer', created_at: parseTimestamp('2026-08-05 17:52:04.123+00') }),
      ],
    });
    const html = await (await AstroContainer.create()).renderToString(Comp);
    expect(html.indexOf('Newer')).toBeLessThan(html.indexOf('Older'));
  });
});
