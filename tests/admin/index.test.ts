import { describe, it, expect, vi, afterEach } from 'vitest';
import { src } from '../mock-path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import type { EventRow } from '../../src/db/schema';

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
async function loadDashboard(opts: { events?: EventRow[] } = {}) {
  vi.resetModules();
  vi.doMock(src('db/rsvp'), () => ({ listRsvps: vi.fn(async () => []) }));
  const listEvents = vi.fn(async () => opts.events ?? []);
  vi.doMock(src('db/event'), () => ({ listEvents }));
  const { default: Comp } = await import('../../src/pages/admin/index.astro');
  return { Comp, listEvents };
}

afterEach(() => {
  vi.doUnmock(src('db/rsvp'));
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
