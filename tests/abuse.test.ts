import { describe, it, expect, vi, afterEach } from 'vitest';
import { src } from './mock-path';
import { isBotSubmission, HONEYPOT_FIELD } from '../src/lib/honeypot';
import { validateRsvp } from '../src/lib/rsvp-validation';
import { validateSubmission } from '../src/lib/submission-validation';
import { MAX_NAME, MAX_EMAIL, MAX_MESSAGE } from '../src/lib/limits';
import {
  WINDOW_MS,
  MAX_HITS,
  windowStart,
  bucketKey,
  isOverLimit,
  INQUIRY_MIN_GAP_MS,
  retryAfterSeconds,
  isWithinGap,
} from '../src/lib/rate-limit';
import { emailBucketKey } from '../src/lib/inquiry-identity';
import { rateLimitMessage } from '../src/lib/rate-limit-message';

// --- isBotSubmission (pure) ---

describe('isBotSubmission', () => {
  it('is true when the honeypot field holds a non-empty string', () => {
    expect(isBotSubmission({ [HONEYPOT_FIELD]: 'Acme Inc' })).toBe(true);
  });

  it('is true when the honeypot value is padded but non-empty', () => {
    expect(isBotSubmission({ [HONEYPOT_FIELD]: '  x  ' })).toBe(true);
  });

  it('is false when the honeypot field is whitespace only', () => {
    expect(isBotSubmission({ [HONEYPOT_FIELD]: '   ' })).toBe(false);
  });

  it('is false when the honeypot field is an empty string', () => {
    expect(isBotSubmission({ [HONEYPOT_FIELD]: '' })).toBe(false);
  });

  it('is false when the honeypot field is absent', () => {
    expect(isBotSubmission({ name: 'Bucky' })).toBe(false);
  });

  it('is false when the honeypot field is a non-string', () => {
    expect(isBotSubmission({ [HONEYPOT_FIELD]: 42 })).toBe(false);
  });

  it('is false for a non-object body', () => {
    expect(isBotSubmission(null)).toBe(false);
    expect(isBotSubmission('company=x')).toBe(false);
    expect(isBotSubmission(undefined)).toBe(false);
  });
});

// --- Route coverage: honeypot silent-accept on both endpoints ---

afterEach(() => {
  vi.doUnmock(src('db/rsvp'));
  vi.doUnmock(src('db/submission'));
  vi.doUnmock(src('db/rate-limit'));
  vi.doUnmock(src('db/client'));
  vi.resetModules();
});

type Limiter = () => Promise<number>;

// Under-limit by default so the guard proceeds past the rate-limit check.
async function postRsvp(body: unknown, rateLimit: Limiter = async () => 1) {
  vi.resetModules();
  const insertRsvp = vi.fn(async () => ({ status: 'ok' as const }));
  vi.doMock(src('db/rsvp'), () => ({ insertRsvp }));
  const hitRateLimit = vi.fn(rateLimit);
  vi.doMock(src('db/rate-limit'), () => ({ hitRateLimit }));
  const { POST } = await import('../src/pages/api/rsvp');
  const request = new Request('http://localhost/api/rsvp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const res = await POST({ request, clientAddress: '1.2.3.4' } as never);
  return { res, insertRsvp, hitRateLimit };
}

// Returns the previous hit for a bucket key, mirroring touchRateLimit; null means no prior hit.
type Toucher = (key: string) => Promise<string | null>;

async function postInquiry(
  body: unknown,
  touch: Toucher = async () => null,
  clientAddress: string | undefined = '1.2.3.4',
) {
  vi.resetModules();
  const insertSubmission = vi.fn(async () => undefined);
  vi.doMock(src('db/submission'), () => ({ insertSubmission }));
  const touchRateLimit = vi.fn(async (key: string) => touch(key));
  const hitRateLimit = vi.fn(async () => 1);
  vi.doMock(src('db/rate-limit'), () => ({ touchRateLimit, hitRateLimit }));
  const { POST } = await import('../src/pages/api/inquiry');
  const request = new Request('http://localhost/api/inquiry', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const res = await POST({ request, clientAddress } as never);
  return { res, insertSubmission, touchRateLimit };
}

// --- Length caps (server-side authoritative) ---

const emailAtCap = (): string => {
  const email = `${'a'.repeat(MAX_EMAIL - '@wisc.edu'.length)}@wisc.edu`;
  expect(email.length).toBe(MAX_EMAIL);
  return email;
};

describe('length caps — validateRsvp', () => {
  const valid = { name: 'Bucky', email: 'bucky@wisc.edu', meeting: 'm' };

  it('rejects a name longer than MAX_NAME', () => {
    const errs = validateRsvp({ ...valid, name: 'a'.repeat(MAX_NAME + 1) });
    expect(errs.map((e) => e.field)).toContain('name');
  });

  it('accepts a name exactly at MAX_NAME', () => {
    const errs = validateRsvp({ ...valid, name: 'a'.repeat(MAX_NAME) });
    expect(errs.map((e) => e.field)).not.toContain('name');
  });

  it('rejects an email longer than MAX_EMAIL', () => {
    const errs = validateRsvp({ ...valid, email: `${'a'.repeat(MAX_EMAIL)}@wisc.edu` });
    expect(errs.map((e) => e.field)).toContain('email');
  });

  it('accepts an email exactly at MAX_EMAIL', () => {
    const errs = validateRsvp({ ...valid, email: emailAtCap() });
    expect(errs.map((e) => e.field)).not.toContain('email');
  });
});

describe('length caps — validateSubmission', () => {
  const valid = { name: 'Bucky', email: 'bucky@wisc.edu', type: 'inquiry' as const, message: 'Hi' };

  it('rejects a name longer than MAX_NAME', () => {
    const errs = validateSubmission({ ...valid, name: 'a'.repeat(MAX_NAME + 1) });
    expect(errs.map((e) => e.field)).toContain('name');
  });

  it('rejects an email longer than MAX_EMAIL', () => {
    const errs = validateSubmission({ ...valid, email: `${'a'.repeat(MAX_EMAIL)}@wisc.edu` });
    expect(errs.map((e) => e.field)).toContain('email');
  });

  it('rejects a message longer than MAX_MESSAGE', () => {
    const errs = validateSubmission({ ...valid, message: 'a'.repeat(MAX_MESSAGE + 1) });
    expect(errs.map((e) => e.field)).toContain('message');
  });

  it('accepts boundary values exactly at each cap', () => {
    const errs = validateSubmission({
      name: 'a'.repeat(MAX_NAME),
      email: emailAtCap(),
      type: 'inquiry',
      message: 'a'.repeat(MAX_MESSAGE),
    });
    expect(errs).toEqual([]);
  });
});

describe('honeypot — POST /api/rsvp', () => {
  const valid = { name: 'Bucky Badger', email: 'bucky@wisc.edu', meeting: '2026-09-12-kickoff' };

  it('silently accepts a filled honeypot with 201 { ok: true } and does not insert', async () => {
    const { res, insertRsvp } = await postRsvp({ ...valid, company: 'Acme' });
    expect(res.status).toBe(201);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.json()).toEqual({ ok: true });
    expect(insertRsvp).not.toHaveBeenCalled();
  });

  it('processes normally when the honeypot is empty', async () => {
    const { res, insertRsvp } = await postRsvp({ ...valid, company: '' });
    expect(res.status).toBe(201);
    expect(insertRsvp).toHaveBeenCalledWith(valid);
  });
});

describe('honeypot — POST /api/inquiry', () => {
  const valid = { name: 'Bucky Badger', email: 'bucky@wisc.edu', type: 'inquiry', message: 'Hello there.' };

  it('silently accepts a filled honeypot with 201 { ok: true } and does not insert', async () => {
    const { res, insertSubmission } = await postInquiry({ ...valid, company: 'Acme' });
    expect(res.status).toBe(201);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.json()).toEqual({ ok: true });
    expect(insertSubmission).not.toHaveBeenCalled();
  });

  it('processes normally when the honeypot is empty', async () => {
    const { res, insertSubmission } = await postInquiry({ ...valid, company: '' });
    expect(res.status).toBe(201);
    expect(insertSubmission).toHaveBeenCalledWith(valid);
  });
});

// --- Rate-limit policy (pure, clock injected) ---

describe('rate-limit policy', () => {
  it('floors the window start to WINDOW_MS', () => {
    expect(windowStart(WINDOW_MS * 3 + 1234)).toBe(WINDOW_MS * 3);
  });

  it('builds a deterministic bucket key from endpoint, ip, and window', () => {
    const now = WINDOW_MS * 5 + 10;
    expect(bucketKey('rsvp', '1.2.3.4', now)).toBe(`rsvp:1.2.3.4:${WINDOW_MS * 5}`);
    expect(bucketKey('rsvp', '1.2.3.4', now)).toBe(bucketKey('rsvp', '1.2.3.4', now + 5));
  });

  it('separates buckets across endpoints and windows', () => {
    expect(bucketKey('rsvp', 'ip', 0)).not.toBe(bucketKey('inquiry', 'ip', 0));
    expect(bucketKey('rsvp', 'ip', 0)).not.toBe(bucketKey('rsvp', 'ip', WINDOW_MS));
  });

  it('is over limit only beyond MAX_HITS', () => {
    expect(isOverLimit(MAX_HITS)).toBe(false);
    expect(isOverLimit(MAX_HITS + 1)).toBe(true);
  });
});

// --- Sliding-gap policy for the inquiry endpoint (pure, clock injected) ---

describe('inquiry sliding-gap policy', () => {
  it('enforces a three-minute gap', () => {
    expect(INQUIRY_MIN_GAP_MS).toBe(180_000);
  });

  it('reports the full gap when no time has elapsed', () => {
    expect(retryAfterSeconds(1_000_000, 1_000_000, INQUIRY_MIN_GAP_MS)).toBe(180);
  });

  it('reports one second remaining at 179s elapsed', () => {
    const last = 1_000_000;
    expect(retryAfterSeconds(last, last + 179_000, INQUIRY_MIN_GAP_MS)).toBe(1);
  });

  it('reports zero exactly at the gap boundary', () => {
    const last = 1_000_000;
    expect(retryAfterSeconds(last, last + INQUIRY_MIN_GAP_MS, INQUIRY_MIN_GAP_MS)).toBe(0);
  });

  it('never returns a negative wait once the gap has passed', () => {
    const last = 1_000_000;
    expect(retryAfterSeconds(last, last + 10 * INQUIRY_MIN_GAP_MS, INQUIRY_MIN_GAP_MS)).toBe(0);
  });

  it('rounds a partial second up so the caller never advises retrying too early', () => {
    const last = 1_000_000;
    expect(retryAfterSeconds(last, last + 179_500, INQUIRY_MIN_GAP_MS)).toBe(1);
  });

  it('blocks within the gap and allows at or beyond it', () => {
    const last = 1_000_000;
    expect(isWithinGap(last, last, INQUIRY_MIN_GAP_MS)).toBe(true);
    expect(isWithinGap(last, last + 179_999, INQUIRY_MIN_GAP_MS)).toBe(true);
    expect(isWithinGap(last, last + INQUIRY_MIN_GAP_MS, INQUIRY_MIN_GAP_MS)).toBe(false);
  });

  it('allows the first-ever submission, when there is no previous hit', () => {
    expect(isWithinGap(null, 1_000_000, INQUIRY_MIN_GAP_MS)).toBe(false);
    expect(retryAfterSeconds(null, 1_000_000, INQUIRY_MIN_GAP_MS)).toBe(0);
  });
});

// --- Email identity key (pure) ---

describe('emailBucketKey', () => {
  it('derives a stable key from a well-formed email', () => {
    const key = emailBucketKey({ email: 'badger@wisc.edu' });
    expect(key).not.toBeNull();
    expect(key).toBe(emailBucketKey({ email: 'badger@wisc.edu' }));
  });

  it('treats case and surrounding whitespace as the same submitter', () => {
    const canonical = emailBucketKey({ email: 'badger@wisc.edu' });
    expect(emailBucketKey({ email: 'BADGER@WISC.EDU' })).toBe(canonical);
    expect(emailBucketKey({ email: '  Badger@Wisc.edu  ' })).toBe(canonical);
  });

  it('separates different submitters', () => {
    expect(emailBucketKey({ email: 'one@wisc.edu' })).not.toBe(
      emailBucketKey({ email: 'two@wisc.edu' }),
    );
  });

  it('never exposes the raw address, so no PII reaches the rate-limit table', () => {
    const key = emailBucketKey({ email: 'badger@wisc.edu' });
    expect(key).not.toContain('@');
    expect(key).not.toContain('badger');
    expect(key).not.toContain('wisc');
  });

  it('returns null for a missing, blank, or non-string email rather than throwing', () => {
    expect(emailBucketKey({})).toBeNull();
    expect(emailBucketKey({ email: '' })).toBeNull();
    expect(emailBucketKey({ email: '   ' })).toBeNull();
    expect(emailBucketKey({ email: 42 })).toBeNull();
    expect(emailBucketKey({ email: null })).toBeNull();
  });

  it('returns null for a non-object body rather than throwing', () => {
    expect(emailBucketKey(null)).toBeNull();
    expect(emailBucketKey(undefined)).toBeNull();
    expect(emailBucketKey('badger@wisc.edu')).toBeNull();
  });

  it('scopes the key to the inquiry endpoint so it cannot collide with an ip bucket', () => {
    expect(emailBucketKey({ email: 'badger@wisc.edu' })).toMatch(/^inquiry:email:[0-9a-f]{64}$/);
  });
});

// --- Rate-limit message copy (pure) ---

describe('rateLimitMessage', () => {
  it('rounds a sub-minute wait up to one minute, never advising a retry that is still too early', () => {
    expect(rateLimitMessage(1)).toContain('1 more minute');
    expect(rateLimitMessage(59)).toContain('1 more minute');
    expect(rateLimitMessage(60)).toContain('1 more minute');
  });

  it('pluralises a longer wait', () => {
    expect(rateLimitMessage(61)).toContain('2 more minutes');
    expect(rateLimitMessage(180)).toContain('3 more minutes');
  });

  it('never says "1 more minutes"', () => {
    for (let s = 1; s <= 180; s += 1) {
      const message = rateLimitMessage(s);
      if (message.includes('1 more minute')) expect(message).not.toContain('1 more minutes');
    }
  });

  it('falls back to generic copy when the server sends no wait time', () => {
    const generic = rateLimitMessage(undefined);
    expect(generic).toMatch(/too often|try again/i);
    expect(generic).not.toContain('NaN');
    expect(generic).not.toContain('undefined');
  });

  it('falls back to generic copy for a non-positive or nonsensical wait', () => {
    for (const value of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const message = rateLimitMessage(value);
      expect(message).not.toContain('NaN');
      expect(message).not.toContain('Infinity');
      expect(message).not.toContain('-');
    }
  });

  it('tells the user their message was kept, since the form preserves what they typed', () => {
    expect(rateLimitMessage(90).toLowerCase()).toContain('message');
  });
});

// --- hitRateLimit DB helper (client mocked, no live DB) ---

type SqlImpl = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;

describe('hitRateLimit', () => {
  it('increments atomically and returns the new count', async () => {
    vi.resetModules();
    const impl: SqlImpl = async () => [{ count: 3 }];
    const sql = vi.fn(impl);
    vi.doMock(src('db/client'), () => ({ sql }));
    const { hitRateLimit } = await import('../src/db/rate-limit');
    expect(await hitRateLimit('k', 'WSTART', 'EXP')).toBe(3);
    vi.doUnmock(src('db/client'));
  });

  it('passes values as parameters, never concatenated into the SQL text', async () => {
    vi.resetModules();
    const impl: SqlImpl = async () => [{ count: 1 }];
    const sql = vi.fn(impl);
    vi.doMock(src('db/client'), () => ({ sql }));
    const { hitRateLimit } = await import('../src/db/rate-limit');
    await hitRateLimit('rsvp:1.2.3.4:60000', 'WSTART', 'EXP');
    const insert = sql.mock.calls.find((call) => call[0].join('').includes('INSERT INTO rate_limit_hits'));
    expect(insert, 'insert call').toBeDefined();
    const [strings, ...values] = insert!;
    expect(values).toEqual(['rsvp:1.2.3.4:60000', 'WSTART', 'EXP']);
    expect(strings.join('')).not.toContain('rsvp:1.2.3.4:60000');
    vi.doUnmock(src('db/client'));
  });
});

// --- touchRateLimit DB helper (client mocked, no live DB) ---

describe('touchRateLimit', () => {
  it('returns the previous hit timestamp so the caller can measure the gap', async () => {
    vi.resetModules();
    const impl: SqlImpl = async () => [{ prev_last_hit_at: '2026-01-01T00:00:00.000Z' }];
    const sql = vi.fn(impl);
    vi.doMock(src('db/client'), () => ({ sql }));
    const { touchRateLimit } = await import('../src/db/rate-limit');
    expect(await touchRateLimit('k', 'NOW', 'EXP')).toBe('2026-01-01T00:00:00.000Z');
    vi.doUnmock(src('db/client'));
  });

  it('returns null on the first hit for a key, when there is no previous timestamp', async () => {
    vi.resetModules();
    const impl: SqlImpl = async () => [{ prev_last_hit_at: null }];
    const sql = vi.fn(impl);
    vi.doMock(src('db/client'), () => ({ sql }));
    const { touchRateLimit } = await import('../src/db/rate-limit');
    expect(await touchRateLimit('k', 'NOW', 'EXP')).toBeNull();
    vi.doUnmock(src('db/client'));
  });

  it('returns null when the upsert yields no row at all', async () => {
    vi.resetModules();
    const impl: SqlImpl = async () => [];
    const sql = vi.fn(impl);
    vi.doMock(src('db/client'), () => ({ sql }));
    const { touchRateLimit } = await import('../src/db/rate-limit');
    expect(await touchRateLimit('k', 'NOW', 'EXP')).toBeNull();
    vi.doUnmock(src('db/client'));
  });

  it('reads the pre-update timestamp via a CTE, since a bare RETURNING yields the new value', async () => {
    vi.resetModules();
    const impl: SqlImpl = async () => [{ prev_last_hit_at: null }];
    const sql = vi.fn(impl);
    vi.doMock(src('db/client'), () => ({ sql }));
    const { touchRateLimit } = await import('../src/db/rate-limit');
    await touchRateLimit('inquiry:ip:1.2.3.4', 'NOW', 'EXP');
    const upsert = sql.mock.calls.find((call) => call[0].join('').includes('INSERT INTO rate_limit_hits'));
    expect(upsert, 'upsert call').toBeDefined();
    const text = upsert![0].join('');
    expect(text).toMatch(/WITH\s+prev\s+AS/i);
    expect(text).toMatch(/RETURNING\s*\(\s*SELECT\s+last_hit_at\s+FROM\s+prev\s*\)/i);
    vi.doUnmock(src('db/client'));
  });

  it('passes values as parameters, never concatenated into the SQL text', async () => {
    vi.resetModules();
    const impl: SqlImpl = async () => [{ prev_last_hit_at: null }];
    const sql = vi.fn(impl);
    vi.doMock(src('db/client'), () => ({ sql }));
    const { touchRateLimit } = await import('../src/db/rate-limit');
    await touchRateLimit('inquiry:ip:1.2.3.4', 'NOW', 'EXP');
    const upsert = sql.mock.calls.find((call) => call[0].join('').includes('INSERT INTO rate_limit_hits'));
    const [strings, ...values] = upsert!;
    // The CTE binds the key and the timestamp twice each, so assert on the set rather than the order.
    expect(new Set(values)).toEqual(new Set(['inquiry:ip:1.2.3.4', 'NOW', 'EXP']));
    expect(strings.join('')).not.toContain('inquiry:ip:1.2.3.4');
    expect(strings.join('')).not.toContain('NOW');
    vi.doUnmock(src('db/client'));
  });
});

// --- Rate limit at the route: over-limit, under-limit, fail-open ---

describe('rate limit — POST /api/rsvp', () => {
  const valid = { name: 'Bucky Badger', email: 'bucky@wisc.edu', meeting: '2026-09-12-kickoff' };

  it('returns 429 when the limiter reports over-limit and does not insert', async () => {
    const { res, insertRsvp } = await postRsvp(valid, async () => MAX_HITS + 1);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, code: 'rate_limited' });
    expect(insertRsvp).not.toHaveBeenCalled();
  });

  it('proceeds when under the limit', async () => {
    const { res, insertRsvp } = await postRsvp(valid, async () => MAX_HITS);
    expect(res.status).toBe(201);
    expect(insertRsvp).toHaveBeenCalled();
  });

  it('fails open when the limiter throws — the submission still succeeds', async () => {
    const { res, insertRsvp } = await postRsvp(valid, async () => {
      throw new Error('db down');
    });
    expect(res.status).toBe(201);
    expect(insertRsvp).toHaveBeenCalled();
  });
});

describe('rate limit — POST /api/inquiry', () => {
  const valid = { name: 'Bucky Badger', email: 'bucky@wisc.edu', type: 'inquiry', message: 'Hello there.' };

  // A hit this many ms ago, as the ISO string touchRateLimit returns.
  const agoIso = (ms: number): string => new Date(Date.now() - ms).toISOString();

  it('blocks a second submission from the same ip inside the three-minute gap', async () => {
    const { res, insertSubmission } = await postInquiry(valid, async (key) =>
      key.startsWith('inquiry:ip:') ? agoIso(30_000) : null,
    );
    expect(res.status).toBe(429);
    expect(insertSubmission).not.toHaveBeenCalled();
  });

  it('blocks a repeat email even from a different ip, defeating ip rotation', async () => {
    const { res, insertSubmission } = await postInquiry(
      valid,
      async (key) => (key.startsWith('inquiry:email:') ? agoIso(30_000) : null),
      '9.9.9.9',
    );
    expect(res.status).toBe(429);
    expect(insertSubmission).not.toHaveBeenCalled();
  });

  it('reports the remaining wait in seconds so the form can tell the user', async () => {
    const { res } = await postInquiry(valid, async (key) =>
      key.startsWith('inquiry:ip:') ? agoIso(60_000) : null,
    );
    const body = (await res.json()) as { ok: boolean; code: string; retryAfterSeconds: number };
    expect(body.ok).toBe(false);
    expect(body.code).toBe('rate_limited');
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    expect(body.retryAfterSeconds).toBeLessThanOrEqual(120);
  });

  it('allows a submission once the gap has fully elapsed', async () => {
    const { res, insertSubmission } = await postInquiry(valid, async () => agoIso(181_000));
    expect(res.status).toBe(201);
    expect(insertSubmission).toHaveBeenCalled();
  });

  it('allows the first-ever submission from a fresh submitter', async () => {
    const { res, insertSubmission } = await postInquiry(valid, async () => null);
    expect(res.status).toBe(201);
    expect(insertSubmission).toHaveBeenCalled();
  });

  it('checks both an ip bucket and an email bucket', async () => {
    const { touchRateLimit } = await postInquiry(valid, async () => null);
    const keys = touchRateLimit.mock.calls.map((call) => call[0] as string);
    expect(keys.some((k) => k.startsWith('inquiry:ip:'))).toBe(true);
    expect(keys.some((k) => k.startsWith('inquiry:email:'))).toBe(true);
  });

  it('falls back to ip-only when the email is malformed, rather than throwing', async () => {
    const { res, touchRateLimit } = await postInquiry({ ...valid, email: 42 }, async () => null);
    const keys = touchRateLimit.mock.calls.map((call) => call[0] as string);
    expect(keys.some((k) => k.startsWith('inquiry:ip:'))).toBe(true);
    expect(keys.some((k) => k.startsWith('inquiry:email:'))).toBe(false);
    expect(res.status).toBe(400);
  });

  it('records the attempt even when blocked, so a bot extends its own lockout', async () => {
    const { touchRateLimit } = await postInquiry(valid, async () => agoIso(1_000));
    expect(touchRateLimit).toHaveBeenCalled();
  });

  it('never places a raw email in a bucket key', async () => {
    const { touchRateLimit } = await postInquiry(valid, async () => null);
    const keys = touchRateLimit.mock.calls.map((call) => call[0] as string).join(' ');
    expect(keys).not.toContain('bucky@wisc.edu');
    expect(keys).not.toContain('bucky');
  });

  it('skips the limiter entirely when the honeypot is filled', async () => {
    const { res, touchRateLimit, insertSubmission } = await postInquiry(
      { ...valid, company: 'Acme' },
      async () => agoIso(1_000),
    );
    expect(res.status).toBe(201);
    expect(touchRateLimit).not.toHaveBeenCalled();
    expect(insertSubmission).not.toHaveBeenCalled();
  });

  it('fails open when the limiter throws — the submission still succeeds', async () => {
    const { res, insertSubmission } = await postInquiry(valid, async () => {
      throw new Error('db down');
    });
    expect(res.status).toBe(201);
    expect(insertSubmission).toHaveBeenCalled();
  });

  it('still throttles by ip when the runtime supplies no client address', async () => {
    const { res, insertSubmission } = await postInquiry(
      valid,
      async (key) => (key.startsWith('inquiry:ip:') ? agoIso(30_000) : null),
      undefined,
    );
    expect(res.status).toBe(429);
    expect(insertSubmission).not.toHaveBeenCalled();
  });
});
