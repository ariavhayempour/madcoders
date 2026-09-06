# 0014 — Meetings page: compact calendar + month agenda

Replaces the chronological upcoming/past list on `/meetings` with a split calendar view:
a compact month grid on the left, that month's full agenda (past and upcoming) on the right.
Supersedes the "list, not a month-grid widget" decision in `docs/claude/0007-meetings-calendar.md`
— that doc's data-model notes (`MeetingView`, `splitMeetings`) and 0013's DB/SSR notes still apply;
only the rendering approach described in 0007 is replaced.

## Why a calendar now

0007 rejected a month-grid because the club had few meetings and a flat list read fine. The
Postgres-backed admin (0013) makes it easy to accumulate a full semester of events, and members
asked to browse "what's happening this month" the way a real calendar works, rather than scroll a
growing list. Three directions were mocked up (classic grid + detail, a "journal" index + spread,
and a compact grid + full-month agenda); the compact grid + agenda direction was chosen for
handling months with several meetings without hiding any of them behind a single-day selector.

## No new client-side JS

The whole feature is server-rendered per request, same as before (`prerender = false`, reads
`listEvents()`). Month navigation is a real link (`?month=YYYY-MM`), not client state — Astro
re-renders the requested month on the next request. Clicking a day with a meeting is a same-page
anchor link (`#d-YYYY-MM-DD`) to that date's agenda entry; CSS `:target` (via Tailwind's
`[&:target]:` arbitrary variant) highlights it on arrival. No React island, no vanilla `<script>`,
no new dependency — consistent with 0007's original "no UI framework" gate and CLAUDE.md's
ask-before-adding-a-dependency rule.

## Data flow

- `src/lib/meeting-calendar.ts` — new pure module (browser-safe, no DB import), mirroring the
  existing `split-meetings.ts` pattern:
  - `resolveFocusMonth(monthParam, events, todayISO)` — an explicit `?month=` wins; otherwise the
    month of the nearest upcoming meeting; otherwise the current month.
  - `buildMonthCells(year, month, todayISO)` — a Sunday-start grid, always full weeks, trimmed down
    to a 4-week floor when trailing weeks are entirely next-month.
  - `eventsInMonth` / `groupByDate` — the displayed month's meetings, grouped so multiple meetings
    on one date share a single agenda card.
  - `shiftMonth` / `monthParam` / `parseMonthParam` — the `?month=` query-string math.
  - `nearestUpcoming` — powers the "jump to the next meeting" link shown when the focused month is
    empty.
- All date math is UTC-based (`Date.UTC`, `getUTCDay`/`getUTCDate`), matching the existing
  UTC-midnight parsing convention so the server's local timezone can't shift a day.

## Rendering

- Calendar cells: a plain `<span>` for days with no meeting (not focusable — nothing to jump to);
  an `<a href="#d-{iso}">` for days with one or more meetings, with an `aria-label` stating the
  full date and meeting count. Out-of-month cells never link, even if they happen to carry an
  event, since only the in-view month's agenda is rendered below.
- Agenda: one card per date (not per meeting) so same-day meetings group under one `<time>`. A
  card for a past date renders "This meeting has passed." instead of `RsvpForm`; RSVP is only
  ever wired to upcoming meetings, same invariant as before.
- No new heading levels were introduced — the page still has exactly one `<h1>` (the hero); the
  month label and agenda count are plain text, matching 0007's original reasoning for keeping
  meeting titles out of the heading hierarchy.

## Testing

- `tests/lib/meeting-calendar.test.ts` — unit tests for every pure helper above (month-parsing,
  grid trimming at the 4-week floor, filtering/grouping, upcoming lookup).
- `tests/meetings.test.ts` — rewritten for the new contract: default-month resolution, `?month=`
  override, same-month grouping, muted/no-RSVP rendering for a past date, the empty-state jump
  link (and its absence when nothing is upcoming), and the prev/next month links. The old
  assertions about a distinct "Past meetings" heading and list ordering no longer apply — a
  calendar shows past and future within the same month view instead of a separate always-visible
  past section.
- `tests/headings.test.ts` / `tests/a11y.test.ts` covered the page unchanged (no new heading
  levels; axe passes with an empty `listEvents()` stub).
