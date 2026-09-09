# 0012 — Admin dashboard (RSVPs + events)

Implements story `docs/user-stories/0012.md`: one signed-in page, `/admin` (the admin index),
that lists every RSVP (grouped by meeting) alongside upcoming events, each with a clear empty
state. Read-only SSR; no mutation, export, or reply flow. Builds on the 0011 auth gate — this
story adds no auth logic and no new dependency.

**Superseded in part:** the submissions inbox described by the original story was removed —
contact-form messages are delivered by email only and are no longer stored (see
`0009-submissions.md`). `/admin/submissions`, its bulk-delete and read-status routes,
`InquiryTable`, `InquiryFilters`, and `src/db/submission.ts` no longer exist.

The dashboard is the admin **index** (`/admin`), not a separate `/admin/dashboard` route: the
login page's `forceRedirectUrl="/admin"` lands a freshly signed-in admin straight on it, and
there is no placeholder landing page to bounce through.

## Request path

```
GET /admin
  → clerkMiddleware + adminRedirect  (0011 gate: signed-out → /admin/login, never reaches here)
  → index.astro (prerender = false)
      ├── listRsvps()        → groupRsvpsByMeeting() → <RsvpTable groups>
      └── listEvents()                               → <EventSummary events>
```

Because the `/admin` middleware short-circuits signed-out requests before any page code runs,
the page performs **no** in-page auth check and no DB query is reachable while signed-out.
Success Criterion 3 (no data leak to unauthenticated requests) is satisfied by that existing
gate; `tests/auth/admin-guard.test.ts` covers its branch table.

## Pieces

- `src/pages/admin/index.astro` — `prerender = false`; runs both reads in parallel per
  request (so a reload reflects newly submitted records — Success Criterion 5), groups the
  RSVP rows, and renders the tables inside the existing `AdminLayout`. Three headed sections.
- `src/components/RsvpTable.astro` — `Props { groups: MeetingGroup[] }`. One section per
  meeting (heading + name/email/timestamp table); empty state "No RSVPs yet." when no groups.
- `src/components/EventSummary.astro` — `Props { events: EventRow[] }`. Read-only list (date +
  optional title) with a "Manage events" link to `/admin/events`; empty state "No events yet."
  when none. Deliberately separate from the interactive `/admin/events` list (edit/delete) —
  the dashboard surface is read-only, so it only summarizes and links out to the 0013 CRUD page.
- `src/db/rsvp.ts` — `listRsvps()`: five columns, `ORDER BY created_at DESC`.
- `src/db/event.ts` — `listEvents()` (from 0013), reused unchanged for the Events section.
- `src/lib/rsvp-grouping.ts` — `groupRsvpsByMeeting(rows)`: pure rows → groups. Meetings
  ordered by most-recent RSVP; rows newest-first within a group; stable on identical
  timestamps. This is the only branchy logic, so it carries the story's test weight.

## Entry point

The admin area stays an unlinked surface — no public nav link. Admins reach the dashboard by
visiting `/admin` directly, and the sign-in flow lands them there via the login page's
`forceRedirectUrl="/admin"`. The `adminRedirect` gate (0011) bounces signed-out requests to
`/admin/login` first.

## Grouping stays out of SQL

Grouping is a pure function over rows rather than a SQL `GROUP BY`, so it is unit-testable
without a database (mirrors 0011's `adminRedirect` and 0006's `selectPending`). The queries
return flat, `created_at DESC`-ordered rows; the page groups before rendering. Timestamps are
formatted with the built-in `Intl` / `toLocaleString` — no date-formatting dependency.

## Testing

- Unit (CI, no DB): `groupRsvpsByMeeting` full branch table
  (`tests/lib/rsvp-grouping.test.ts`) and the RSVP table's empty vs populated states via
  `experimental_AstroContainer` (`tests/lib/rsvp-table.test.ts`).
- Events section: `tests/admin/index.test.ts` renders the dashboard with `db/rsvp` and
  `db/event` mocked — asserts the Events section, the `/admin/events` link, populated rows,
  and the empty state.
- Not unit-tested (by design): live SQL (`listRsvps`) and the Clerk gate —
  CI has no `DATABASE_URL` or Clerk secret. The queries are thin tagged templates; verified
  manually against Neon with seeded rows, per the spec Testing Strategy.

## Deviation from the story's affected-files list

The story pre-listed `src/components/{RsvpTable,InquiryTable}.tsx` and a shared
`src/db/queries.ts`. This work instead ships `.astro` table components and adds the read
queries to the existing per-entity file (`rsvp.ts`) — no React integration
and no new shared query file — because the view is read-only SSR and the codebase has no React
and a one-file-per-entity DB layout. Same spirit as 0011's documented deviation from its
story's roll-your-own-auth list.
