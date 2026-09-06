import { describe, it, expect, vi, afterEach } from 'vitest';
import { src } from './mock-path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { validateRsvp, validateRsvpEdit, type RsvpInput } from '../src/lib/rsvp-validation';
import RsvpForm from '../src/components/RsvpForm.astro';

const valid: RsvpInput = { name: 'Bucky Badger', email: 'bucky@wisc.edu', meeting: '2026-09-12-kickoff' };

// Errors are keyed by field so callers can map them to inputs.
const fields = (input: RsvpInput): string[] => validateRsvp(input).map((e) => e.field);

describe('validateRsvp — name', () => {
  it('flags an empty name', () => {
    expect(fields({ ...valid, name: '' })).toContain('name');
  });

  it('flags a whitespace-only name', () => {
    expect(fields({ ...valid, name: '   ' })).toContain('name');
  });

  it('accepts a name with surrounding whitespace', () => {
    expect(fields({ ...valid, name: '  Bucky  ' })).not.toContain('name');
  });
});

describe('validateRsvp — email', () => {
  it('rejects a non-wisc domain', () => {
    expect(fields({ ...valid, email: 'foo@gmail.com' })).toContain('email');
  });

  it('rejects wisc.edu as a non-final domain label', () => {
    expect(fields({ ...valid, email: 'foo@wisc.edu.evil.com' })).toContain('email');
  });

  it('rejects an empty local part', () => {
    expect(fields({ ...valid, email: '@wisc.edu' })).toContain('email');
  });

  it('accepts a bare wisc.edu address', () => {
    expect(fields({ ...valid, email: 'netid@wisc.edu' })).not.toContain('email');
  });

  it('accepts a wisc.edu subdomain address', () => {
    expect(fields({ ...valid, email: 'a@cs.wisc.edu' })).not.toContain('email');
  });
});

describe('validateRsvp — meeting', () => {
  it('flags an empty meeting slug', () => {
    expect(fields({ ...valid, meeting: '' })).toContain('meeting');
  });
});

describe('validateRsvp — valid input', () => {
  it('returns no errors for a valid RSVP', () => {
    expect(validateRsvp(valid)).toEqual([]);
  });
});

describe('validateRsvpEdit', () => {
  it('accepts each valid attendance status', () => {
    for (const status of ['pending', 'present', 'absent'] as const) {
      expect(validateRsvpEdit({ status })).toEqual([]);
    }
  });

  it('flags an unknown status', () => {
    expect(validateRsvpEdit({ status: 'maybe' as never }).map((e) => e.field)).toContain('status');
  });
});

// --- insertRsvp DB helper (client mocked, no live DB) ---

type SqlImpl = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;

// Load src/db/rsvp with src/db/client's `sql` replaced by a spy, so no real DB is touched.
async function withMockedSql(impl: SqlImpl) {
  vi.resetModules();
  const sql = vi.fn(impl);
  vi.doMock(src('db/client'), () => ({ sql }));
  const rsvpDb = await import('../src/db/rsvp');
  return { ...rsvpDb, sql };
}

afterEach(() => {
  vi.doUnmock(src('db/client'));
  vi.doUnmock(src('db/rsvp'));
  vi.doUnmock(src('db/rate-limit'));
  vi.resetModules();
});

describe('insertRsvp', () => {
  const input: RsvpInput = { name: 'Bucky', email: 'bucky@wisc.edu', meeting: '2026-09-12-kickoff' };

  it('returns ok on a successful insert', async () => {
    const { insertRsvp } = await withMockedSql(async () => []);
    expect(await insertRsvp(input)).toEqual({ status: 'ok' });
  });

  it('maps a 23505 unique-violation to duplicate', async () => {
    const { insertRsvp } = await withMockedSql(async () => {
      throw Object.assign(new Error('duplicate key'), { code: '23505' });
    });
    expect(await insertRsvp(input)).toEqual({ status: 'duplicate' });
  });

  it('propagates any non-unique-violation error', async () => {
    const { insertRsvp } = await withMockedSql(async () => {
      throw Object.assign(new Error('connection reset'), { code: '08006' });
    });
    await expect(insertRsvp(input)).rejects.toThrow('connection reset');
  });

  it('passes values as parameters, never concatenated into the SQL text', async () => {
    const { insertRsvp, sql } = await withMockedSql(async () => []);
    await insertRsvp(input);
    const [strings, ...values] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(values).toEqual([input.name, input.email, input.meeting]);
    expect(strings.join('')).not.toContain(input.email);
  });
});

// --- updateRsvp DB helper ---

const editInput = { status: 'present' as const };

describe('updateRsvp', () => {
  it('returns the updated row on success', async () => {
    const row = { id: 1, name: 'Bucky', email: 'bucky@wisc.edu', meeting: 'kickoff', status: 'present', created_at: '2026-07-01T00:00:00.000Z' };
    const { updateRsvp } = await withMockedSql(async () => [row]);
    expect(await updateRsvp(1, editInput)).toEqual({ status: 'ok', rsvp: row });
  });

  it('returns not_found when no row matches the id', async () => {
    const { updateRsvp } = await withMockedSql(async () => []);
    expect(await updateRsvp(999, editInput)).toEqual({ status: 'not_found' });
  });

  it('propagates any error from the update', async () => {
    const { updateRsvp } = await withMockedSql(async () => {
      throw Object.assign(new Error('connection reset'), { code: '08006' });
    });
    await expect(updateRsvp(1, editInput)).rejects.toThrow('connection reset');
  });

  it('passes the status and id as parameters, never concatenated into the SQL text', async () => {
    const { updateRsvp, sql } = await withMockedSql(async () => [
      { id: 1, name: 'Bucky', email: 'bucky@wisc.edu', meeting: 'kickoff', status: 'present', created_at: '2026-07-01T00:00:00.000Z' },
    ]);
    await updateRsvp(1, editInput);
    const [strings, ...values] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(values).toEqual(['present', 1]);
    expect(strings.join('')).not.toContain('present');
  });
});

// --- deleteRsvp DB helper ---

describe('deleteRsvp', () => {
  it('resolves void on a successful delete', async () => {
    const { deleteRsvp } = await withMockedSql(async () => []);
    await expect(deleteRsvp(1)).resolves.toBeUndefined();
  });

  it('propagates any error from the delete', async () => {
    const { deleteRsvp } = await withMockedSql(async () => {
      throw new Error('connection reset');
    });
    await expect(deleteRsvp(1)).rejects.toThrow('connection reset');
  });

  it('passes the id as a parameter, never concatenated into the SQL text', async () => {
    const { deleteRsvp, sql } = await withMockedSql(async () => []);
    await deleteRsvp(42);
    const [, ...values] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(values).toEqual([42]);
  });
});

// --- POST /api/rsvp route (insertRsvp mocked) ---

type InsertResult = { status: 'ok' | 'duplicate' };

// Load the route with insertRsvp and the rate limiter replaced, then POST the given raw body.
async function postRsvp(
  rawBody: string,
  insertImpl?: (i: RsvpInput) => Promise<InsertResult>,
  rateLimit: () => Promise<number> = async () => 1,
) {
  vi.resetModules();
  const insertRsvp = vi.fn(insertImpl ?? (async () => ({ status: 'ok' as const })));
  vi.doMock(src('db/rsvp'), () => ({ insertRsvp }));
  const hitRateLimit = vi.fn(rateLimit);
  vi.doMock(src('db/rate-limit'), () => ({ hitRateLimit }));
  const { POST } = await import('../src/pages/api/rsvp');
  const request = new Request('http://localhost/api/rsvp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: rawBody,
  });
  const res = await POST({ request, clientAddress: '1.2.3.4' } as never);
  return { res, insertRsvp };
}

describe('POST /api/rsvp', () => {
  it('returns 201 ok for a valid RSVP and inserts it', async () => {
    const { res, insertRsvp } = await postRsvp(JSON.stringify(valid));
    expect(res.status).toBe(201);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.json()).toEqual({ ok: true });
    expect(insertRsvp).toHaveBeenCalledWith(valid);
  });

  it('returns 400 with field errors for invalid input and does not insert', async () => {
    const { res, insertRsvp } = await postRsvp(JSON.stringify({ ...valid, email: 'foo@gmail.com' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.errors.map((e: { field: string }) => e.field)).toContain('email');
    expect(insertRsvp).not.toHaveBeenCalled();
  });

  it('returns 409 duplicate when the insert reports a duplicate', async () => {
    const { res } = await postRsvp(JSON.stringify(valid), async () => ({ status: 'duplicate' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, code: 'duplicate' });
  });

  it('returns 500 server when the insert throws unexpectedly', async () => {
    const { res } = await postRsvp(JSON.stringify(valid), async () => {
      throw new Error('boom');
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, code: 'server' });
  });

  it('returns 400 without throwing on malformed JSON', async () => {
    const { res, insertRsvp } = await postRsvp('{ not json');
    expect(res.status).toBe(400);
    expect((await res.json()).ok).toBe(false);
    expect(insertRsvp).not.toHaveBeenCalled();
  });

  it('returns 429 rate_limited when over the limit and does not insert', async () => {
    const { res, insertRsvp } = await postRsvp(JSON.stringify(valid), undefined, async () => 6);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, code: 'rate_limited' });
    expect(insertRsvp).not.toHaveBeenCalled();
  });
});

// --- RsvpForm.astro markup + a11y ---

const SLUG = '2026-09-12-kickoff';

async function renderForm(meeting: string): Promise<string> {
  return (await AstroContainer.create()).renderToString(RsvpForm, { props: { meeting } });
}

describe('RsvpForm.astro', () => {
  it('renders a native submittable form targeting the API', async () => {
    const html = await renderForm(SLUG);
    expect(html).toMatch(/<form[^>]*action="\/api\/rsvp"/);
    expect(html).toMatch(/<form[^>]*method="post"/i);
    expect(html).toMatch(/<button[^>]*type="submit"/);
  });

  it('wires the meeting slug into a hidden field', async () => {
    const html = await renderForm(SLUG);
    expect(html).toMatch(new RegExp(`<input[^>]*type="hidden"[^>]*name="meeting"[^>]*value="${SLUG}"`));
  });

  it('associates every input with a label via matching for/id', async () => {
    const html = await renderForm(SLUG);
    for (const field of ['name', 'email']) {
      const input = new RegExp(`<input[^>]*name="${field}"[^>]*id="([^"]+)"|<input[^>]*id="([^"]+)"[^>]*name="${field}"`).exec(html);
      expect(input, `input for ${field}`).not.toBeNull();
      const id = input![1] ?? input![2];
      expect(html).toMatch(new RegExp(`<label[^>]*for="${id}"`));
    }
  });

  it('gives each text input an aria-describedby error region and a polite status region', async () => {
    const html = await renderForm(SLUG);
    expect(html).toMatch(/<input[^>]*name="name"[^>]*aria-describedby=/);
    expect(html).toMatch(/<input[^>]*name="email"[^>]*aria-describedby=/);
    expect(html).toMatch(/role="status"[^>]*aria-live="polite"|aria-live="polite"[^>]*role="status"/);
  });

  it('scopes element ids by slug so multiple forms on one page stay unique', async () => {
    const a = await renderForm('slug-a');
    const b = await renderForm('slug-b');
    expect(a).toContain('slug-a');
    expect(b).toContain('slug-b');
    expect(a).not.toContain('slug-b');
  });

  it('includes a hidden honeypot field kept out of the a11y tree and tab order', async () => {
    const html = await renderForm(SLUG);
    const field = /<input[^>]*name="company"[^>]*>/.exec(html);
    expect(field, 'honeypot input').not.toBeNull();
    const tag = field![0];
    expect(tag).toMatch(/aria-hidden="true"/);
    expect(tag).toMatch(/tabindex="-1"/);
    expect(tag).toMatch(/autocomplete="off"/);
  });
});
