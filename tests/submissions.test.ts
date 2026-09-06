import { describe, it, expect, vi, afterEach } from 'vitest';
import { src } from './mock-path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { validateSubmission, type SubmissionInput } from '../src/lib/submission-validation';
import type { SubmissionType } from '../src/db/schema';
import InquiryForm from '../src/components/InquiryForm.astro';

const valid: SubmissionInput = {
  name: 'Bucky Badger',
  email: 'bucky@wisc.edu',
  type: 'inquiry',
  message: 'I would like to get involved.',
};

// Errors are keyed by field so callers can map them to inputs.
const fields = (input: SubmissionInput): string[] => validateSubmission(input).map((e) => e.field);

describe('validateSubmission — name', () => {
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

describe('validateSubmission — email', () => {
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

describe('validateSubmission — message', () => {
  it('flags an empty message', () => {
    expect(fields({ ...valid, message: '' })).toContain('message');
  });

  it('flags a whitespace-only message', () => {
    expect(fields({ ...valid, message: '   ' })).toContain('message');
  });
});

describe('validateSubmission — type', () => {
  it('flags a type not in SUBMISSION_TYPES', () => {
    expect(fields({ ...valid, type: 'bogus' as SubmissionInput['type'] })).toContain('type');
  });

  it('accepts each known submission type', () => {
    expect(fields({ ...valid, type: 'inquiry' })).not.toContain('type');
    expect(fields({ ...valid, type: 'join' })).not.toContain('type');
    expect(fields({ ...valid, type: 'digest' })).not.toContain('type');
  });
});

describe('validateSubmission — valid input', () => {
  it('returns no errors for a fully valid submission', () => {
    expect(validateSubmission(valid)).toEqual([]);
  });
});

// --- insertSubmission DB helper (client mocked, no live DB) ---

type SqlImpl = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;

// Load insertSubmission with src/db/client's `sql` replaced by a spy, so no real DB is touched.
async function withMockedSql(impl: SqlImpl) {
  vi.resetModules();
  const sql = vi.fn(impl);
  vi.doMock(src('db/client'), () => ({ sql }));
  const { insertSubmission } = await import('../src/db/submission');
  return { insertSubmission, sql };
}

afterEach(() => {
  vi.doUnmock(src('db/client'));
  vi.doUnmock(src('db/submission'));
  vi.doUnmock(src('db/rate-limit'));
  vi.resetModules();
});

describe('insertSubmission', () => {
  const input: SubmissionInput = {
    name: '  Bucky  ',
    email: '  bucky@wisc.edu  ',
    type: 'join',
    message: '  Sign me up.  ',
  };

  it('resolves void on a successful insert', async () => {
    const { insertSubmission } = await withMockedSql(async () => []);
    await expect(insertSubmission(input)).resolves.toBeUndefined();
  });

  it('propagates any error from the insert', async () => {
    const { insertSubmission } = await withMockedSql(async () => {
      throw new Error('connection reset');
    });
    await expect(insertSubmission(input)).rejects.toThrow('connection reset');
  });

  it('passes trimmed values as parameters, never concatenated into the SQL text', async () => {
    const { insertSubmission, sql } = await withMockedSql(async () => []);
    await insertSubmission(input);
    const [strings, ...values] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(values).toEqual(['Bucky', 'bucky@wisc.edu', 'join', 'Sign me up.']);
    expect(strings.join('')).not.toContain('bucky@wisc.edu');
  });
});

// --- deleteSubmissions DB helper (client mocked, no live DB) ---

// Same client-mocking approach as withMockedSql, for the bulk-delete helper.
async function withMockedDeleteSql(impl: SqlImpl) {
  vi.resetModules();
  const sql = vi.fn(impl);
  vi.doMock(src('db/client'), () => ({ sql }));
  const { deleteSubmissions } = await import('../src/db/submission');
  return { deleteSubmissions, sql };
}

describe('deleteSubmissions', () => {
  it('resolves void on a successful delete', async () => {
    const { deleteSubmissions } = await withMockedDeleteSql(async () => []);
    await expect(deleteSubmissions([1, 2, 3])).resolves.toBeUndefined();
  });

  it('propagates any error from the delete', async () => {
    const { deleteSubmissions } = await withMockedDeleteSql(async () => {
      throw new Error('connection reset');
    });
    await expect(deleteSubmissions([1])).rejects.toThrow('connection reset');
  });

  it('passes the id array as a single parameter, never concatenated into the SQL text', async () => {
    const { deleteSubmissions, sql } = await withMockedDeleteSql(async () => []);
    await deleteSubmissions([7, 8]);
    const [strings, ...values] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(values).toEqual([[7, 8]]);
    expect(strings.join('')).toContain('ANY(');
    expect(strings.join('')).not.toContain('7');
  });
});

// --- DELETE /admin/api/submissions bulk route (deleteSubmissions mocked) ---

// Load the bulk route with the DB helper replaced, then DELETE the given raw body.
async function deleteSubmissionsRequest(rawBody: string, impl?: (ids: number[]) => Promise<void>) {
  vi.resetModules();
  const deleteSubmissions = vi.fn(impl ?? (async () => undefined));
  vi.doMock(src('db/submission'), () => ({ deleteSubmissions }));
  const { DELETE } = await import('../src/pages/admin/api/submissions/index');
  const request = new Request('http://localhost/admin/api/submissions', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: rawBody,
  });
  const res = await DELETE({ request } as never);
  return { res, deleteSubmissions };
}

describe('DELETE /admin/api/submissions', () => {
  it('deletes the given ids and returns 200 ok', async () => {
    const { res, deleteSubmissions } = await deleteSubmissionsRequest(JSON.stringify({ ids: [4, 9] }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.json()).toEqual({ ok: true });
    expect(deleteSubmissions).toHaveBeenCalledTimes(1);
    expect(deleteSubmissions).toHaveBeenCalledWith([4, 9]);
  });

  it('returns 400 for an empty ids array and does not delete', async () => {
    const { res, deleteSubmissions } = await deleteSubmissionsRequest(JSON.stringify({ ids: [] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false });
    expect(deleteSubmissions).not.toHaveBeenCalled();
  });

  it('returns 400 when ids is missing and does not delete', async () => {
    const { res, deleteSubmissions } = await deleteSubmissionsRequest(JSON.stringify({}));
    expect(res.status).toBe(400);
    expect(deleteSubmissions).not.toHaveBeenCalled();
  });

  it('returns 400 when ids is not an array and does not delete', async () => {
    const { res, deleteSubmissions } = await deleteSubmissionsRequest(JSON.stringify({ ids: 5 }));
    expect(res.status).toBe(400);
    expect(deleteSubmissions).not.toHaveBeenCalled();
  });

  it('returns 400 without throwing on malformed JSON and does not delete', async () => {
    const { res, deleteSubmissions } = await deleteSubmissionsRequest('{ not json');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false });
    expect(deleteSubmissions).not.toHaveBeenCalled();
  });

  it('rejects non-positive-integer ids and does not delete', async () => {
    for (const bad of [0, -1, 1.5, '3', null, NaN]) {
      const { res, deleteSubmissions } = await deleteSubmissionsRequest(JSON.stringify({ ids: [1, bad] }));
      expect(res.status, `ids containing ${String(bad)}`).toBe(400);
      expect(deleteSubmissions).not.toHaveBeenCalled();
    }
  });

  it('returns 500 without leaking error detail when the delete throws', async () => {
    const { res } = await deleteSubmissionsRequest(JSON.stringify({ ids: [1] }), async () => {
      throw new Error('boom');
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
  });
});

describe('/admin/api/submissions/[id]', () => {
  it('no longer exports a single-item DELETE — the bulk route replaces it', async () => {
    vi.resetModules();
    vi.doMock(src('db/submission'), () => ({ setSubmissionRead: vi.fn() }));
    // Indexed access, not `route.DELETE` — the latter is a compile error once the export is gone.
    const route: Record<string, unknown> = await import('../src/pages/admin/api/submissions/[id]');
    expect(route['DELETE']).toBeUndefined();
    expect(route['PATCH']).toBeTypeOf('function');
  });
});

// --- POST /api/inquiry route (insertSubmission mocked) ---

// Load the route with insertSubmission and the rate limiter replaced, then POST the given raw body.
async function postInquiry(
  rawBody: string,
  insertImpl?: (i: SubmissionInput) => Promise<void>,
  // Previous hit for a bucket, as touchRateLimit returns it; null means no prior submission.
  touch: () => Promise<string | null> = async () => null,
) {
  vi.resetModules();
  const insertSubmission = vi.fn(insertImpl ?? (async () => undefined));
  vi.doMock(src('db/submission'), () => ({ insertSubmission }));
  const touchRateLimit = vi.fn(touch);
  const hitRateLimit = vi.fn(async () => 1);
  vi.doMock(src('db/rate-limit'), () => ({ touchRateLimit, hitRateLimit }));
  const { POST } = await import('../src/pages/api/inquiry');
  const request = new Request('http://localhost/api/inquiry', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: rawBody,
  });
  const res = await POST({ request, clientAddress: '1.2.3.4' } as never);
  return { res, insertSubmission };
}

describe('POST /api/inquiry', () => {
  it('returns 201 ok for a valid submission and inserts the coerced input', async () => {
    const { res, insertSubmission } = await postInquiry(JSON.stringify(valid));
    expect(res.status).toBe(201);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.json()).toEqual({ ok: true });
    expect(insertSubmission).toHaveBeenCalledWith(valid);
  });

  it('returns 400 with field errors for invalid input and does not insert', async () => {
    const { res, insertSubmission } = await postInquiry(JSON.stringify({ ...valid, email: 'foo@gmail.com' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.errors.map((e: { field: string }) => e.field)).toContain('email');
    expect(insertSubmission).not.toHaveBeenCalled();
  });

  it('returns 400 without throwing on malformed JSON and does not insert', async () => {
    const { res, insertSubmission } = await postInquiry('{ not json');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, code: 'invalid', errors: [] });
    expect(insertSubmission).not.toHaveBeenCalled();
  });

  it('returns 500 server when the insert throws unexpectedly', async () => {
    const { res } = await postInquiry(JSON.stringify(valid), async () => {
      throw new Error('boom');
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, code: 'server' });
  });

  it('coerces missing fields to empty strings so validation is the single gate', async () => {
    const { res, insertSubmission } = await postInquiry(JSON.stringify({ type: 'inquiry' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors.map((e: { field: string }) => e.field)).toEqual(
      expect.arrayContaining(['name', 'email', 'message']),
    );
    expect(insertSubmission).not.toHaveBeenCalled();
  });

  it('returns 429 rate_limited inside the submission gap and does not insert', async () => {
    const recent = new Date(Date.now() - 30_000).toISOString();
    const { res, insertSubmission } = await postInquiry(JSON.stringify(valid), undefined, async () => recent);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ ok: false, code: 'rate_limited' });
    expect(insertSubmission).not.toHaveBeenCalled();
  });
});

// --- InquiryForm.astro markup + a11y ---

async function renderForm(type: SubmissionType): Promise<string> {
  return (await AstroContainer.create()).renderToString(InquiryForm, { props: { type } });
}

describe('InquiryForm.astro', () => {
  it('renders a native submittable form targeting the API', async () => {
    const html = await renderForm('inquiry');
    expect(html).toMatch(/<form[^>]*action="\/api\/inquiry"/);
    expect(html).toMatch(/<form[^>]*method="post"/i);
    expect(html).toMatch(/<button[^>]*type="submit"/);
  });

  it('carries the submission type in a hidden field', async () => {
    const html = await renderForm('digest');
    expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="type"[^>]*value="digest"/);
  });

  it('associates name and email inputs with a label via matching for/id', async () => {
    const html = await renderForm('join');
    for (const field of ['name', 'email']) {
      const input = new RegExp(`<input[^>]*name="${field}"[^>]*id="([^"]+)"|<input[^>]*id="([^"]+)"[^>]*name="${field}"`).exec(html);
      expect(input, `input for ${field}`).not.toBeNull();
      const id = input![1] ?? input![2];
      expect(html).toMatch(new RegExp(`<label[^>]*for="${id}"`));
    }
  });

  it('associates the message textarea with a label via matching for/id', async () => {
    const html = await renderForm('join');
    const textarea = /<textarea[^>]*name="message"[^>]*id="([^"]+)"|<textarea[^>]*id="([^"]+)"[^>]*name="message"/.exec(html);
    expect(textarea, 'message textarea').not.toBeNull();
    const id = textarea![1] ?? textarea![2];
    expect(html).toMatch(new RegExp(`<label[^>]*for="${id}"`));
  });

  it('gives each text field an aria-describedby error region and a polite status region', async () => {
    const html = await renderForm('inquiry');
    expect(html).toMatch(/<input[^>]*name="name"[^>]*aria-describedby=/);
    expect(html).toMatch(/<input[^>]*name="email"[^>]*aria-describedby=/);
    expect(html).toMatch(/<textarea[^>]*name="message"[^>]*aria-describedby=/);
    expect(html).toMatch(/role="status"[^>]*aria-live="polite"|aria-live="polite"[^>]*role="status"/);
  });

  it('scopes element ids by type so multiple forms on one page stay unique', async () => {
    const a = await renderForm('inquiry');
    const b = await renderForm('join');
    expect(a).toContain('inquiry');
    expect(b).toContain('join');
    expect(a).not.toMatch(/id="[^"]*-join"/);
  });

  it('includes a hidden honeypot field kept out of the a11y tree and tab order', async () => {
    const html = await renderForm('inquiry');
    const field = /<input[^>]*name="company"[^>]*>/.exec(html);
    expect(field, 'honeypot input').not.toBeNull();
    const tag = field![0];
    expect(tag).toMatch(/aria-hidden="true"/);
    expect(tag).toMatch(/tabindex="-1"/);
    expect(tag).toMatch(/autocomplete="off"/);
  });
});

// --- Formspree cleanup guard ---

// Eagerly load every text file under src/ so the guard fails if Formspree creeps back in.
const SRC_FILES = import.meta.glob('../src/**/*.{astro,ts,tsx,js,css,json,md}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('formspree cleanup guard', () => {
  it('scans a representative set of src files', () => {
    // Guard against a silently-empty glob giving a false green.
    expect(Object.keys(SRC_FILES).length).toBeGreaterThan(5);
  });

  it('finds no formspree reference anywhere under src/', () => {
    const offenders = Object.entries(SRC_FILES)
      .filter(([, source]) => /formspree/i.test(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
