# 0013 — Manage calendar events from the admin dashboard

Implements story `docs/user-stories/0013.md`: a signed-in admin creates, edits, and deletes club
meetings from `/admin/events`, persisted in Postgres. The public `/meetings` page reads those same
rows per request, so any create/edit/delete shows on the next visit with no redeploy. Builds
on 0006 (Postgres + migrations), 0007 (`/meetings` +
`splitMeetings`), and 0011 (`/admin/*` auth gate) — adds no auth logic and no new dependency.

## Data model

`migrations/0003_events.sql` (forward-only):

| column       | type          | notes                                                        |
| ------------ | ------------- | ------------------------------------------------------------ |
| `id`         | `BIGINT` identity PK | stable handle in the `/admin/events/[id]` edit URL    |
| `slug`       | `TEXT NOT NULL UNIQUE` | value `rsvps.meeting` points at (no FK); regenerated on edit |
| `date`       | `TEXT NOT NULL` | ISO `YYYY-MM-DD`; sorts lexicographically, matching `splitMeetings` |
| `title`      | `TEXT`        | nullable column (legacy rows); `validateEvent` requires it on every create/edit |
| `time`       | `TEXT`        | nullable column (legacy rows); required going forward (human string, e.g. `6:00 PM`) |
| `location`   | `TEXT`        | nullable column (legacy rows); `validateEvent` requires it on every create/edit |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`                                              |

Plus `events_date_idx` on `(date)`. `src/db/schema.ts` hand-mirrors this as `EventRow`,
`TABLES.events`, and `EVENT_COLUMNS`; `tests/db/schema.test.ts` guards the columns ↔ DDL sync
(same regex-parse pattern as the `rate_limit_hits` check).

**Surrogate id + mutable slug** (vs. making the slug the PK): the numeric id keeps the edit URL
stable across slug regeneration; the slug stays the `rsvps.meeting`-compatible identity.

## Request paths

```
GET  /admin/events        → 0011 gate → list events + create form + per-row delete
POST /admin/events        → 0011 gate → _action=create → validate → insertEvent → 303
                                        _action=delete → deleteEvent(id) (cascade) → 303
GET  /admin/events/[id]    → 0011 gate → getEvent(id) → edit form (404 if non-numeric / missing)
POST /admin/events/[id]    → 0011 gate → _action=update → validate → updateEvent(id) → 303
GET  /meetings            → (public, SSR) listEvents() → MeetingView[] → splitMeetings(today)
```

All admin mutations are form POSTs on `.astro` SSR pages, disambiguated by a hidden `_action`
field — **no new `/api/*` route**. The 0011 `adminRedirect` middleware covers GET and POST alike,
so there is no in-page auth check; signed-out requests never reach page code (Success Criterion 9).
Every successful mutation replies `303 See Other` (Post/Redirect/Get) so a reload never
re-submits. On validation failure the POST re-renders the same form with inline field errors and
the submitted values, HTTP `400`; nothing persists.

## Slug scheme (deterministic, pure)

`slugifyEvent(date, title)` in `src/lib/event-validation.ts`:

- title empty → `date` alone (`2026-09-12`)
- otherwise → `${date}-${kebab(title)}` (`2026-09-12-kickoff-journal-club-intro`)
- `kebab` = lowercase, non-alphanumerics → `-`, collapse repeats, trim leading/trailing `-`

Uniqueness: `slug` is `UNIQUE`. `insertEvent`/`updateEvent` compute the base slug, then on a
Postgres `unique_violation` (`23505`) append `-2`, `-3`, … and retry (`withUniqueSlug`) — mirroring
`insertRsvp`'s insert-and-catch. On edit, updating a row to its own current slug can't collide with
itself, so an unchanged title regenerates the same slug cleanly.

## Slug regenerates on edit — rename cascades into rsvps

Chosen over an immutable slug (confirmed with user). Because the slug is the value `rsvps.meeting`
points at, a plain regenerate would orphan existing RSVP rows. Per the resolved Open Question,
`updateEvent` uses the **rename-cascade** variant: a single CTE reads the row's pre-update slug
(`prev`), updates `events` (`updated`), and runs `UPDATE rsvps SET meeting = <new> WHERE meeting =
<old>` (`cascaded`) — all against one snapshot, so existing RSVPs stay associated while the slug
stays fresh. `deleteEvent` likewise removes the event and its `rsvps` (matched by slug) in one CTE.
Both cascades are app-enforced — there is no FK.

## Public `/meetings` — data source only

`src/pages/meetings.astro` is now `prerender = false`; it reads `listEvents()`, maps rows to
`MeetingView[]` (`id: slug`), computes `today` at request time, and renders via the relocated pure
`splitMeetings` (`src/lib/split-meetings.ts`). Markup, styling, and the upcoming-vs-past split are
unchanged from 0007. `src/data/meetings.ts` is deleted (no fallback/seed file). Because the page is
now SSR (imports `db/client`), it moved out of the fully-static `tests/routes.test.ts` set; its
title/meta coverage lives in `tests/meetings.test.ts`, and the full-page render gates
(`a11y`, `headings`) stub `db/event`'s read.

## Pieces

- `src/lib/event-validation.ts` — pure `validateEvent()`: date, title, time, and location are all
  required (each field either flags an empty value or, once non-empty, a length cap), plus the
  round-trip that rejects calendar overflows like `2026-13-40` / `2026-02-30` for date. Also
  `slugifyEvent()`. Browser-safe: no `node:*`/DB imports.
- `src/lib/split-meetings.ts` — relocated pure `splitMeetings()` + `MeetingView` (from the deleted
  data module). Used by the public `/meetings` page only; the admin list (below) stays a single
  chronological table, not split.
- `src/lib/limits.ts` — adds `MAX_TITLE` (200), `MAX_TIME` (60), `MAX_LOCATION` (200).
- `src/db/event.ts` — thin tagged-template `listEvents`/`getEvent`/`insertEvent`/`updateEvent`/
  `deleteEvent`; inputs trimmed. `title`/`time`/`location` stay nullable at the DB layer (legacy
  rows predate the required-field rule) — an empty string still normalizes to `NULL` defensively,
  though the form no longer submits one.
- `src/components/EventForm.astro` — shared create/edit fields (dense 2-col layout: date+time,
  then title, then location, all `required`) with inline per-field error slots and submitted-value
  repopulation.
- `src/pages/admin/events/index.astro` — list + empty state + create. Client-side (vanilla
  `<script>`, no framework) search box filters by title/location, and the Date/Title column
  headers are click-to-sort (`aria-sort`, toggling asc/desc) — same no-build-step pattern as
  `InquiryFilters.astro`/`InquiryTable.astro`. Default order is unchanged: `listEvents()`'s
  `date DESC`, i.e. most recent first, oldest at the bottom. Delete lives on the edit page's
  Danger Zone, not per-row here.
- `src/pages/admin/events/[id].astro` — edit form; `404` on non-numeric or missing id; Danger Zone
  (delete) renders via `Panel` with `tone="destructive"`.

## Testing

- Unit (CI, no DB): `validateEvent`/`slugifyEvent` full branch table; relocated `splitMeetings`;
  `event.ts` helpers against a mocked `sql` tagged template (trimming, slug regeneration, `23505`
  retry-with-suffix, the update rename-cascade, and the delete cascade statement shape); the
  `EVENT_COLUMNS` ↔ DDL sync; and the admin pages via `experimental_AstroContainer`
  (`renderToResponse` for POST 303/400 branches, `renderToString` for GET render/empty/404).
- Not unit-tested (by design): live SQL correctness and the Clerk gate — CI has no `DATABASE_URL`
  or Clerk secret. Verified manually against Neon with seeded rows (create → appears on
  `/admin/events` and `/meetings`; edit; delete → gone from both; cascade removes the event's RSVP
  rows).

## Deviations from the story's affected-files list

- **Surrogate PK + slug column** instead of a text-slug PK — keeps the edit URL stable across slug
  regeneration; `rsvps.meeting` still references the slug string.
- **`EventForm.astro`** (shared create/edit fields) and **`split-meetings.ts`** (relocated pure
  helper) are introduced to avoid duplicating form markup and to house the pure split — neither is
  named in the story but both follow existing conventions (`RsvpForm.astro`, `rsvp-grouping.ts`).
- **`updateEvent` uses the rename-cascade** (not plain regenerate) — the resolved Open Question,
  preserving RSVP associations across an edit.
