import { describe, it, expect, vi, afterEach } from 'vitest';
import { src } from '../mock-path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import type { EventRow } from '../../src/db/schema';
import type { EventInput } from '../../src/lib/event-validation';

const eventRow: EventRow = {
  id: 42,
  slug: '2099-12-31-future',
  date: '2099-12-31',
  title: 'Future session',
  time: '6:00 PM',
  location: 'Chamberlin Hall 2103',
  created_at: '2099-01-01T00:00:00Z',
};

function postForm(fields: Record<string, string>, url = 'http://localhost/admin/events'): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
}

const getReq = (url: string): Request => new Request(url, { method: 'GET' });

// Load the index page with the rsvps/submissions DB helpers (read by the RSVP-count column and AdminLayout sidebar counts) replaced by spies.
function mockChrome() {
  vi.doMock(src('db/rsvp'), () => ({ listRsvps: vi.fn(async () => []) }));
  vi.doMock(src('db/submission'), () => ({ listSubmissions: vi.fn(async () => []) }));
}

async function loadIndex(
  opts: { events?: EventRow[]; insert?: (i: EventInput) => Promise<EventRow>; del?: (id: number) => Promise<void> } = {},
) {
  vi.resetModules();
  mockChrome();
  const listEvents = vi.fn(async () => opts.events ?? []);
  const insertEvent = vi.fn(opts.insert ?? (async () => eventRow));
  const deleteEvent = vi.fn(opts.del ?? (async () => {}));
  vi.doMock(src('db/event'), () => ({ listEvents, insertEvent, deleteEvent }));
  const { default: Comp } = await import('../../src/pages/admin/events/index.astro');
  return { Comp, listEvents, insertEvent, deleteEvent };
}

// Load the edit page ([id]) with getEvent/updateEvent replaced by spies.
async function loadEdit(opts: { event?: EventRow | null; update?: (id: number, i: EventInput) => Promise<EventRow | null> } = {}) {
  vi.resetModules();
  mockChrome();
  const row = opts.event === undefined ? eventRow : opts.event;
  const getEvent = vi.fn(async () => row);
  const updateEvent = vi.fn(opts.update ?? (async () => row));
  vi.doMock(src('db/event'), () => ({ getEvent, updateEvent }));
  const { default: Comp } = await import('../../src/pages/admin/events/[id].astro');
  return { Comp, getEvent, updateEvent };
}

afterEach(() => {
  vi.doUnmock(src('db/event'));
  vi.doUnmock(src('db/rsvp'));
  vi.doUnmock(src('db/submission'));
  vi.resetModules();
});

describe('GET /admin/events', () => {
  it('shows an empty state when there are no events', async () => {
    const { Comp } = await loadIndex({ events: [] });
    const html = await (await AstroContainer.create()).renderToString(Comp);
    expect(html).toMatch(/no events yet/i);
  });

  it('lists events with an edit link to each id', async () => {
    const { Comp } = await loadIndex({ events: [eventRow] });
    const html = await (await AstroContainer.create()).renderToString(Comp);
    expect(html).toContain('2099-12-31');
    expect(html).toContain('Future session');
    expect(html).toContain('/admin/events/42');
  });

  it('makes Edit the primary row action and no longer renders a per-row delete form', async () => {
    const { Comp } = await loadIndex({ events: [eventRow] });
    const html = await (await AstroContainer.create()).renderToString(Comp);
    // Delete moved into the edit view; the row exposes an Edit link only.
    expect(html).toMatch(/href="\/admin\/events\/42"[^>]*>[\s\S]*?Edit/);
    expect(html).not.toMatch(/value="delete"/);
    expect(html).not.toMatch(/onsubmit="return confirm\(/i);
  });

  it('renders a create form posting to /admin/events with the event fields', async () => {
    const { Comp } = await loadIndex({ events: [] });
    const html = await (await AstroContainer.create()).renderToString(Comp);
    expect(html).toMatch(/<form[^>]*action="\/admin\/events"/);
    expect(html).toMatch(/<form[^>]*method="post"/i);
    expect(html).toMatch(/name="_action"[^>]*value="create"|value="create"[^>]*name="_action"/);
    for (const field of ['date', 'title', 'time', 'location']) {
      expect(html).toContain(`name="${field}"`);
    }
  });
});

describe('POST /admin/events — create', () => {
  it('inserts a valid event and redirects 303 to /admin/events', async () => {
    const { Comp, insertEvent } = await loadIndex();
    const request = postForm({ _action: 'create', date: '2099-12-31', title: 'Future session', time: '6:00 PM', location: 'Chamberlin Hall 2103' });
    const res = await (await AstroContainer.create()).renderToResponse(Comp, { request });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/admin/events');
    expect(insertEvent).toHaveBeenCalledWith({ date: '2099-12-31', title: 'Future session', time: '6:00 PM', location: 'Chamberlin Hall 2103' });
  });

  it('re-renders with an inline error and 400 for a missing date, and does not insert', async () => {
    const { Comp, insertEvent } = await loadIndex();
    const request = postForm({ _action: 'create', date: '', title: 'No date', time: '', location: '' });
    const res = await (await AstroContainer.create()).renderToResponse(Comp, { request });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain('Please enter a date.');
    expect(html).toContain('No date'); // submitted values repopulated
    expect(insertEvent).not.toHaveBeenCalled();
  });

  it('re-renders with an inline error and 400 for a calendar-invalid date', async () => {
    const { Comp, insertEvent } = await loadIndex();
    const request = postForm({ _action: 'create', date: '2026-13-40', title: '', time: '', location: '' });
    const res = await (await AstroContainer.create()).renderToResponse(Comp, { request });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Use the format YYYY-MM-DD.');
    expect(insertEvent).not.toHaveBeenCalled();
  });
});

describe('POST /admin/events — delete', () => {
  it('deletes the event by id and redirects 303 to /admin/events', async () => {
    const { Comp, deleteEvent } = await loadIndex();
    const request = postForm({ _action: 'delete', id: '42' });
    const res = await (await AstroContainer.create()).renderToResponse(Comp, { request });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/admin/events');
    expect(deleteEvent).toHaveBeenCalledWith(42);
  });
});

describe('GET /admin/events/[id]', () => {
  it('404s for a non-numeric id', async () => {
    const { Comp } = await loadEdit();
    const res = await (await AstroContainer.create()).renderToResponse(Comp, {
      params: { id: 'abc' },
      request: getReq('http://localhost/admin/events/abc'),
    });
    expect(res.status).toBe(404);
  });

  it('404s when the event does not exist', async () => {
    const { Comp } = await loadEdit({ event: null });
    const res = await (await AstroContainer.create()).renderToResponse(Comp, {
      params: { id: '999' },
      request: getReq('http://localhost/admin/events/999'),
    });
    expect(res.status).toBe(404);
  });

  it('renders the edit form seeded with the event and posting to its id', async () => {
    const { Comp } = await loadEdit({ event: eventRow });
    const html = await (await AstroContainer.create()).renderToString(Comp, {
      params: { id: '42' },
      request: getReq('http://localhost/admin/events/42'),
    });
    expect(html).toContain(`value="${eventRow.date}"`);
    expect(html).toContain(`value="${eventRow.title}"`);
    expect(html).toMatch(/<form[^>]*action="\/admin\/events\/42"/);
    expect(html).toMatch(/name="_action"[^>]*value="update"|value="update"[^>]*name="_action"/);
  });
});

describe('POST /admin/events/[id] — update', () => {
  it('updates a valid event and redirects 303 to /admin/events', async () => {
    const { Comp, updateEvent } = await loadEdit({ event: eventRow });
    const request = postForm(
      { _action: 'update', date: '2099-11-01', title: 'Renamed', time: '6:00 PM', location: 'Chamberlin Hall 2103' },
      'http://localhost/admin/events/42',
    );
    const res = await (await AstroContainer.create()).renderToResponse(Comp, { params: { id: '42' }, request });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/admin/events');
    expect(updateEvent).toHaveBeenCalledWith(42, {
      date: '2099-11-01',
      title: 'Renamed',
      time: '6:00 PM',
      location: 'Chamberlin Hall 2103',
    });
  });

  it('re-renders 400 with an inline error for a missing date and does not update', async () => {
    const { Comp, updateEvent } = await loadEdit({ event: eventRow });
    const request = postForm(
      { _action: 'update', date: '', title: 'x', time: '', location: '' },
      'http://localhost/admin/events/42',
    );
    const res = await (await AstroContainer.create()).renderToResponse(Comp, { params: { id: '42' }, request });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Please enter a date.');
    expect(updateEvent).not.toHaveBeenCalled();
  });
});
