# 0009 — Unified submission flow (inquiry / join / digest)

Implements story `docs/user-stories/0009.md`: three placements — `/contact` (inquiry),
`/team` (join), and `/create-next-digest` (digest) — each render a name + `wisc.edu`-email +
message form that POSTs to one SSR route, validates server-side, and inserts into the
`submissions` table from 0006. Built as pure Astro + one scoped `<script>` — no React, no new
dependency, no new migration. Directly reuses the 0008
RSVP pattern, adapted for submission-type discrimination and a `message` field, and **without**
the 409/duplicate machinery.

## Data flow

```
InquiryForm.astro (scoped <script>, type prop)
  → validateSubmission()  (client-side pre-submit feedback)
  → fetch POST /api/inquiry  { name, email, type, message }
      → validateSubmission()  (server is the authority — re-runs the same rules)
      → insertSubmission()  → INSERT into submissions
  ← 201 ok | 400 errors | 500 server
```

## Submission type

`src/db/schema.ts` already exports `SUBMISSION_TYPES = ['inquiry', 'join', 'digest']` and the
`SubmissionType` union (0006). `InquiryForm.astro` takes a `type: SubmissionType` prop; it is
carried in a hidden field (the server records it as `submissions.submission_type`) and also
namespaces the form's element ids (`inq-name-<type>`, …) so multiple forms coexist on one page
without id collisions. The route coerces `type` to `''` when absent, so an unknown type fails
validation rather than reaching the insert.

## Validation authority split

`src/lib/submission-validation.ts` is the single source of the rules: name non-empty after
trim, email matches `/^[^\s@]+@([a-z0-9-]+\.)*wisc\.edu$/i` (local part + optional subdomains +
final `wisc.edu` — so `netid@wisc.edu` and `a@cs.wisc.edu` pass; `foo@gmail.com`,
`foo@wisc.edu.evil.com`, and `@wisc.edu` fail), message non-empty after trim, and `type` in
`SUBMISSION_TYPES`. It is pure and browser-safe (no `node:*`/DB imports), so the client
`<script>` imports it for fast inline feedback and the API route imports the *same* module as
the real gate. The client check is UX only; the server is authoritative.

The `WISC_EMAIL` regex is duplicated from `rsvp-validation.ts` rather than shared. This keeps
0008 self-contained (zero risk to the RSVP path) at the cost of one copy; extracting a shared
`src/lib/wisc-email.ts` is a deferred future refactor.

## API contract — `POST /api/inquiry`

`src/pages/api/inquiry.ts`, `prerender = false`. Every response is a `Response` with an
explicit status and `content-type: application/json`.

| Condition | Status | Body |
|---|---|---|
| Valid, inserted | `201` | `{ ok: true }` |
| Validation errors | `400` | `{ ok: false, errors: [{ field, message }] }` |
| Malformed / absent JSON | `400` | `{ ok: false, code: 'invalid', errors: [] }` |
| Unexpected failure | `500` | `{ ok: false, code: 'server' }` |

Missing/non-string body fields (and `type`) are coerced to empty strings so
`validateSubmission` is the single gate. The 500 path swallows the error detail — the submitted
email (PII) is never logged.

## No duplicate handling (the 0008 → 0009 delta)

The one structural difference from 0008: `submissions` has **no** unique constraint, so a user
may submit repeatedly by design. `src/db/submission.ts` `insertSubmission()` therefore runs a
single parameterized `INSERT` and returns `Promise<void>` — no `23505`/`409` branch, no modal
in the form. Any unexpected error propagates to the route, which turns it into a `500` without
logging. All values are parameterized (never concatenated into the SQL text) and trimmed on
write. CI has no live DB — all DB paths are mocked, per 0006; a real insert of each
`submission_type` is verified out-of-band against Neon.

## Client enhancement

`src/components/InquiryForm.astro` renders a native `<form method="post"
action="/api/inquiry">` (submittable if JS fails). The scoped `<script>` progressively
enhances it:

- **201** → reset the form, announce success in the `role="status" aria-live="polite"` region.
- **400** → render inline field errors (`aria-describedby` + `aria-invalid`), focus the first
  invalid field (name, email, or the message textarea).
- **500 / network** → friendly error, **typed values preserved** for retry.

There is no modal (no duplicate state). As with 0008, the no-JS fallback POSTs
`application/x-www-form-urlencoded`, which the JSON-only route rejects with a `400`; full no-JS
handling is out of scope.

## Placements and the contact-form test override

The three host pages stay `prerender = true`; only `api/inquiry.ts` is `prerender = false`. The
form enhances client-side, so a prerendered host page is fine. `/contact`'s "Start a New
Digest" section stays a link to `/create-next-digest` (a single inquiry form on contact, not a
second digest form there).

`tests/routes.test.ts` previously asserted `/contact` rendered "without any form elements"
(a placeholder explicitly deferred to 0008/0009). 0009 inverts it: contact now renders exactly
one inquiry form posting to `/api/inquiry` and keeps the digest link. This is a deliberate,
documented change — the same precedent as 0007 → 0008 for `/meetings`.

## Formspree guard (AC #5)

No Formspree reference exists in the repo. `tests/submissions.test.ts` keeps it that way: it
globs every text file under `src/` and fails if any contains `formspree` (case-insensitive),
with a sanity check that the glob isn't silently empty.

## Out of scope

No CSRF token, rate-limiting, or server-side message length cap on this public write route —
consistent with 0008's minimalism. Abuse hardening (including a message cap) is a later
concern. The shared-`wisc.edu`-rule refactor noted above is likewise deferred.
