# 0010 — Spam & abuse protection

Implements story `docs/user-stories/0010.md`: a defense-in-depth pass over the two public write
routes (`/api/rsvp`, `/api/inquiry`) adding three independent layers — a honeypot field,
server-side length caps, and a Neon-backed rate limiter. No new dependency, no
new secret, no `vercel.json`. Layers are independent so any
one can fail without disabling the others.

The limiter runs a per-endpoint policy: RSVP keeps the original fixed window (5 per 60s, IP-keyed),
while the contact form enforces a sliding one-submission-per-three-minutes gap keyed on both IP
and hashed email, added after a bot spam incident.

## Guard order (per request)

Both routes run the same pipeline; the shared guard is `src/lib/abuse-guard.ts`:

```
parse JSON → coerce → checkAbuse(honeypot → rate limit) → validate → insert
```

`checkAbuse({ body, endpoint, clientAddress })` returns a short-circuit `Response` (blocked) or
`null` (continue). Honeypot is checked **before** the rate-limit write so bot noise never burns
a rate-limit slot. Validation and insert are unchanged from 0008/0009 and run only when the
guard returns `null`.

The rate-limit step branches on `endpoint` — `checkInquiryGap` for inquiries, `checkFixedWindow`
for everything else — so the two policies stay independent and RSVP is unaffected by inquiry
tuning. The email is read from the **raw body before validation**, so a malformed address
degrades to IP-only throttling instead of erroring.

## Honeypot (`src/lib/honeypot.ts`)

Hidden field name `company`. `isBotSubmission(body)` is true only when `body.company` is a
non-empty string after trim — so blank human submissions always pass. Both forms render it as a
visually-hidden input (`position:absolute; left:-9999px`) that is `aria-hidden="true"`,
`tabindex="-1"`, and `autocomplete="off"`, so assistive tech and the keyboard tab order never
reach it; only autofilling bots populate it.

**Silent accept:** a filled honeypot returns the normal success shape (`201 { ok: true }`)
**without** any DB write. Bots see success and don't retry or adapt; the story's reject and
never-written criteria are both satisfied without tipping off the bot with a distinct error.

The forms' scoped `<script>` sends `company` alongside the real payload (empty for humans) so
the server sees the field; it is kept out of the typed validation input so the validators'
signatures are unchanged.

## Length caps (`src/lib/limits.ts`)

`MAX_NAME = 120`, `MAX_EMAIL = 254`, `MAX_MESSAGE = 5000`. Both validators
(`rsvp-validation.ts`, `submission-validation.ts`) reject over-cap values on the trimmed length
with a field error, after the existing empty/format checks (so an empty field reports "required"
rather than a length error). The server is authoritative; the forms also carry matching
`maxlength` attributes sourced from the same constants for UX, but never rely on them.

## Rate limiter (Neon-backed, fail-open)

The two endpoints use different policies, because their legitimate usage differs: RSVPing to
several events in one sitting is normal, sending several contact inquiries in three minutes is
not.

| Endpoint | Policy | Keys |
|---|---|---|
| `/api/rsvp` | fixed window, 5 per 60s | client IP |
| `/api/inquiry` | sliding gap, 1 per 180s | client IP **and** hashed email |

### Fixed window (RSVP)

**Policy** (`src/lib/rate-limit.ts`, pure, clock injected): `WINDOW_MS = 60_000`,
`MAX_HITS = 5`. `windowStart(nowMs)` floors to the window; `bucketKey(endpoint, ip, nowMs)`
scopes one counter per endpoint + client + window; `isOverLimit(count)` is `count > MAX_HITS`,
so five requests per window are allowed and the sixth is blocked.

**Store** (`src/db/rate-limit.ts` + `migrations/0002_rate_limit.sql`): the
`rate_limit_hits(key, window_start, count, expires_at)` table backs an atomic upsert —
`INSERT … ON CONFLICT (key) DO UPDATE SET count = count + 1 RETURNING count` — so the
allow/deny decision is one round-trip and correct under concurrency (no check-then-write race).
Expired buckets are pruned opportunistically (`DELETE … WHERE expires_at < now()`) as a
best-effort side call that can never block a submission. All values are parameterized, never
concatenated into SQL text. `src/db/schema.ts` mirrors the table; `tests/db/schema.test.ts`
guards against DDL drift.

### Sliding gap (inquiry)

A fixed window is the wrong shape at one hit per three minutes: two submissions straddling a
window boundary can land seconds apart and both pass. The inquiry endpoint therefore enforces a
**rolling** gap — `INQUIRY_MIN_GAP_MS = 180_000`, with `isWithinGap(lastHitMs, nowMs, gapMs)`
deciding and `retryAfterSeconds(...)` reporting the remaining wait (rounded up, so the response
never invites a retry that would still be blocked). Both accept `lastHitMs: number | null`, so
"no previous hit" is handled in the pure policy rather than at the call site.

**Dual keys.** Each inquiry touches two buckets and is blocked if **either** is inside the gap:

```
inquiry:ip:<clientAddress ?? 'unknown'>
inquiry:email:<sha256(email.trim().toLowerCase())>
```

IP-only loses to a bot rotating addresses; email-only loses to a bot cycling fake addresses from
one host. Together, neither evasion works, while a shared campus NAT is still protected because
the email bucket distinguishes individual submitters. The email is **hashed**
(`src/lib/inquiry-identity.ts`) so no address is ever stored in the `key` column — consistent
with the rule that a submitted email is never logged. A missing or malformed email yields no
email bucket, degrading to IP-only rather than throwing.

**Every bucket is touched even after one trips**, so a bot that keeps submitting continually
extends its own lockout instead of resetting the clock every three minutes.

**Store** (`migrations/0006_rate_limit_sliding.sql`): one nullable column,
`last_hit_at TIMESTAMPTZ`, added forward-only. `touchRateLimit(key, nowIso, expiresAt)` records
the current hit and returns the **previous** one in a single atomic round-trip:

```sql
WITH prev AS (SELECT last_hit_at FROM rate_limit_hits WHERE key = $key)
INSERT INTO rate_limit_hits (key, window_start, count, expires_at, last_hit_at)
VALUES ($key, $now, 1, $expires, $now)
ON CONFLICT (key) DO UPDATE SET count = rate_limit_hits.count + 1, last_hit_at = EXCLUDED.last_hit_at
RETURNING (SELECT last_hit_at FROM prev) AS prev_last_hit_at
```

**The CTE is load-bearing — do not "simplify" it to a bare `RETURNING last_hit_at`.** Verified
against Neon: the bare form returns the value just written, making `now - last` always zero, so
the throttle would accept every request while every mocked test still passed. The CTE snapshots
the old row before the upsert overwrites it. Because this failure is invisible to mocked tests,
it is checked against a live database, not just in unit tests.

**Fail-open:** the guard wraps the entire rate-limit path in a `try/catch` and returns `null`
(allow) on any thrown error — a limiter or DB outage must never block legitimate submissions.
When the runtime can't supply a client IP, the key falls back to a constant sentinel so the
limiter still functions (globally) rather than throwing.

## API contract additions

Both routes gain one status on top of the 0008/0009 contract; everything else is unchanged:

| Condition | Status | Body |
|---|---|---|
| Honeypot filled | `201` | `{ ok: true }` (no DB write) |
| Over rate limit (`/api/rsvp`) | `429` | `{ ok: false, code: 'rate_limited' }` |
| Inside the gap (`/api/inquiry`) | `429` | `{ ok: false, code: 'rate_limited', retryAfterSeconds: n }` |

`retryAfterSeconds` is a positive integer no greater than 180. It is additive: the RSVP body is
unchanged.

Both forms handle `429` in the scoped `<script>`: a clear message in the `role="status"` region
with **typed values preserved** (no reset) so the user can retry after the wait. The inquiry
form renders the wait as whole minutes via `rateLimitMessage` (`src/lib/rate-limit-message.ts`),
which rounds up, handles singular/plural, and falls back to generic copy when the field is
absent or nonsensical. That copy lives in `src/lib/` rather than inline in the component because
the component tests render to a string and can never execute inline script logic.

## Testing & verification

- Pure libs (`honeypot`, `limits`, `rate-limit` policy, `inquiry-identity`,
  `rate-limit-message`, both validators) are unit-tested directly — deterministic, no DB, clock
  injected. Gap boundaries are covered at 0s, 179s, exactly 180s, and beyond.
- Both store helpers are tested with `src/db/client` mocked, asserting parameterization. The
  `touchRateLimit` test also asserts the SQL still contains the `WITH prev` CTE, so the
  pre-update read can't be refactored away silently.
- Route tests mock the db modules and call `POST({ request, clientAddress })`, covering honeypot
  silent-accept, same-IP block, same-email block from a different IP, pass after the gap,
  `retryAfterSeconds` shape, malformed-email IP-only fallback, no-insert-when-blocked, and
  fail-open on limiter throw.
- `tests/db/schema.test.ts` asserts `RATE_LIMIT_COLUMNS` match the DDL across `0002` **and**
  every later `ADD COLUMN`, since columns added after the create arrive via `ALTER`.
- CI has no live DB (per 0006). Verified out-of-band against Neon: the CTE returns the
  pre-update timestamp (`null` then the first hit), gap arithmetic is exact, two concurrent
  touches yield exactly one first-hit (no check-then-write race), and a live `429` carries
  `retryAfterSeconds` while writing no submission row.

## Out of scope

CSRF, CAPTCHA, email-ownership verification, IP allow/deny lists, admin-configurable limits, a
cleanup cron (cleanup is opportunistic in the upsert), `vercel.json` changes, and extracting the
shared `WISC_EMAIL` regex (still deferred, per 0009).
