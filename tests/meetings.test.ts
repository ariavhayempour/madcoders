import { describe, it, expect, vi } from 'vitest';
import { src } from './mock-path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import type { EventRow } from '../src/db/schema';

// Fixed far-past / far-future so assertions never depend on the real clock.
const PAST: EventRow = {
  id: 1,
  slug: '2000-01-01-retro',
  date: '2000-01-01',
  title: 'Retro kickoff',
  time: '5:00 PM',
  location: 'Old Hall 100',
  created_at: '2000-01-01T00:00:00Z',
};
const FUTURE: EventRow = {
  id: 2,
  slug: '2099-12-31-future',
  date: '2099-12-31',
  title: 'Future session',
  time: '6:00 PM',
  location: 'Chamberlin Hall 2103',
  created_at: '2099-01-01T00:00:00Z',
};
// Same month as FUTURE but earlier in it, so the two land in one calendar month together.
const FUTURE_SAME_MONTH: EventRow = {
  id: 3,
  slug: '2099-12-05-earlier',
  date: '2099-12-05',
  title: 'Earlier session',
  time: '6:30 PM',
  location: 'Steenbock Library 130',
  created_at: '2099-01-01T00:00:00Z',
};

// Render the page against seeded rows by mocking the DB read (no live DB in CI).
async function renderWith(rows: EventRow[], url = 'http://localhost/meetings'): Promise<string> {
  vi.resetModules();
  vi.doMock(src('db/event'), () => ({ listEvents: async () => rows }));
  const { default: Meetings } = await import('../src/pages/meetings.astro');
  const html = await (await AstroContainer.create()).renderToString(Meetings, { request: new Request(url) });
  vi.doUnmock(src('db/event'));
  return html;
}

describe('/meetings page shell', () => {
  it('renders its own title, meta, and heading', async () => {
    const html = await renderWith([]);
    expect(html).toContain('<title>Meetings · Badger Journals</title>');
    expect(html).toContain('property="og:title" content="Meetings"');
    expect(html).toMatch(/>\s*RSVP to an event\.\s*<\/h1>/);
  });
});

describe('/meetings calendar + agenda', () => {
  it('defaults to the month of the nearest upcoming meeting and renders it as <time datetime>', async () => {
    const html = await renderWith([FUTURE]);
    expect(html).toContain('datetime="2099-12-31"');
    expect(html).toContain(FUTURE.title!);
    expect(html).toContain(FUTURE.time!);
    expect(html).toContain(FUTURE.location!);
    expect(html).toContain('December 2099'); // month label follows the default focus month
  });

  it('groups same-month meetings under one agenda list, both upcoming', async () => {
    const html = await renderWith([FUTURE, FUTURE_SAME_MONTH]);
    expect(html).toContain('id="d-2099-12-31"');
    expect(html).toContain('id="d-2099-12-05"');
    expect(html).toContain('2 meetings in December 2099');
  });

  it('respects an explicit ?month= param over the default', async () => {
    const html = await renderWith([FUTURE], 'http://localhost/meetings?month=2050-06');
    expect(html).toContain('June 2050');
    expect(html).not.toContain(FUTURE.title!); // FUTURE isn't in the requested month
    expect(html).toContain('No meetings scheduled in June 2050.');
  });

  it('shows a far-past meeting muted, with no RSVP form, when its month is in view', async () => {
    const html = await renderWith([PAST], 'http://localhost/meetings?month=2000-01');
    expect(html).toContain('datetime="2000-01-01"');
    expect(html).toContain('This meeting has passed.');
    expect(html).not.toMatch(/<form/i);
  });

  it('renders an RSVP form keyed to an upcoming meeting, but never for a past one', async () => {
    const html = await renderWith([FUTURE]);
    expect(html).toContain('action="/api/rsvp"');
    expect(html).toContain(`value="${FUTURE.slug}"`);
  });

  it('shows an empty state with no form when the focus month has no meetings', async () => {
    const html = await renderWith([]);
    expect(html).toContain('No meetings scheduled in');
    expect(html).not.toMatch(/<form/i);
  });

  it('offers a jump link to the nearest upcoming meeting from an empty month', async () => {
    const html = await renderWith([FUTURE], 'http://localhost/meetings?month=2050-06');
    expect(html).toContain('Jump to the next meeting');
    expect(html).toContain('href="/meetings?month=2099-12#d-2099-12-31"');
  });

  it('omits the jump link when nothing is upcoming anywhere', async () => {
    const html = await renderWith([PAST]);
    expect(html).not.toContain('Jump to the next meeting');
  });

  it('exposes previous/next month navigation links', async () => {
    const html = await renderWith([], 'http://localhost/meetings?month=2050-06');
    expect(html).toContain('href="/meetings?month=2050-05"');
    expect(html).toContain('href="/meetings?month=2050-07"');
  });
});
