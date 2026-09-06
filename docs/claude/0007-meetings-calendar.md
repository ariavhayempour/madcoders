# 0007 — Meetings calendar from repo data

Implements story `docs/user-stories/0007.md`. Replaces the placeholder `/meetings` body with
a data-driven, prerendered list of club meetings that maintainers edit in one typed file and
redeploy.

## Data model

- Source of truth is `src/data/meetings.ts` — a plain typed module (`Meeting` interface +
  `meetings: Meeting[]`), mirroring `src/data/team.ts` / `research-areas.ts`. **No content
  collection** was re-introduced (0002 deliberately removed collections).
- `date` (ISO `YYYY-MM-DD`) is the sole required field; `title`/`time`/`location` are
  optional and render only when present. Source order is not relied upon — the page sorts.
- The same module exports a pure `splitMeetings(all, todayISO)` helper (returns
  `{ upcoming, past }`) so ordering/split logic is unit-testable without rendering.

## Rendering

- Page stays `export const prerender = true`. **No React island** — the story's
  `MeetingsCalendar.tsx` was dropped, so the calendar is pure server-rendered Astro and
  CLAUDE.md's "ask before adding a UI framework" gate is not triggered. No dependency change.
- Form is a chronological list, not a month-grid widget. Each meeting is a semantic `<li>`
  led by a real `<time datetime="YYYY-MM-DD">`; the date is the primary element, so meeting
  titles are **not** headings (keeps heading order `h1 → h2`, no skipped levels).
- "Now" is **build time** — `new Date().toISOString().slice(0,10)`. Correct for a
  prerendered page; the upcoming/past boundary only advances on redeploy (accepted per spec).
- Split by comparing ISO date strings (they sort lexicographically): `upcoming` (`>= today`)
  ascending, `past` (`< today`) descending under a distinct "Past meetings" `<h2>`.
- Dates are formatted with `Intl.DateTimeFormat` using `timeZone: 'UTC'`, matching the
  UTC-midnight parse of an ISO date so the build server's timezone can't shift a day.
- Past meetings are de-emphasized by **more than color** (distinct heading, muted left
  accent, smaller date scale) to satisfy the contrast/a11y gates.

## Empty state

Keyed off **upcoming**, not the whole dataset: the empty-state message renders whenever no
meeting is on/after the build date. Any past meetings still render beneath it. An entirely
empty `meetings[]` shows only the empty state.

## Testing notes

- `tests/meetings.test.ts` — `splitMeetings()` unit tests plus Container-API render tests.
- Render tests seed data by mocking `src/data/meetings` (`vi.doMock` + `importActual`, real
  `splitMeetings` preserved), using fixed far-past `2000-01-01` / far-future `2099-12-31`
  dates so nothing depends on the real clock.
- `tests/routes.test.ts` still asserts the `/meetings` title/H1 unchanged.
