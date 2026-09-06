# Timestamp parsing at the driver

`@neondatabase/serverless` decodes date/time columns into JS `Date` objects by default, but
`src/db/schema.ts` types every one of them as `string`. TypeScript believed the declaration, so
`astro check` passed while production did something else.

The dashboard hit it first: `src/pages/admin/index.astro` sorts recent submissions with
`b.created_at.localeCompare(a.created_at)`. Against a `Date` that method does not exist, so the
page threw `TypeError: b.created_at.localeCompare is not a function`, returned a 500, and rendered
as a blank white page.

Tests did not catch it because every fixture hand-wrote `created_at` as an ISO **string**, matching
the (wrong) declared type rather than the driver's real output.

## The fix

`src/db/timestamps.ts` provides two parsers, registered once in `src/db/client.ts` via
`types.setTypeParser`. Registration is global to the driver, so it covers every query without
threading options through call sites.

| Postgres type | OID | Decodes to |
| --- | --- | --- |
| `TIMESTAMPTZ` | 1184 | strict ISO-8601 UTC (`2026-08-05T17:52:04.123Z`) |
| `TIMESTAMP` | 1114 | strict ISO-8601 UTC |
| `DATE` | 1082 | the plain `YYYY-MM-DD` string, unchanged |

### Why normalize rather than pass the raw text through

Postgres emits `2026-08-05 17:52:04.123+00` — a space instead of `T`, and a bare `+00` offset.
That is not valid ISO-8601; `new Date()` rejects the two-digit offset outright. Normalizing gives
one canonical shape, so lexicographic ordering equals chronological ordering and the existing
`localeCompare` sorts stay correct.

### Why `DATE` stays a plain string

Parsing a bare date to a `Date` applies the **local** timezone: `2026-09-15` becomes
`2026-09-15T07:00:00.000Z`. Any code comparing dates as strings would silently break. Keeping
`YYYY-MM-DD` intact preserves that comparison — `src/pages/admin/index.astro` filters upcoming
events with `e.date >= today` today. (`events.date` is currently a `TEXT` column, so it was never
routed through the `DATE` parser; the parser is registered so a future migration to a real `DATE`
column cannot reintroduce the bug.)

`infinity` / `-infinity` and any unrecognized value pass through untouched rather than becoming
`Invalid Date`.

## Tests

- `tests/db/timestamps.test.ts` — every Postgres output shape (fractional seconds, microseconds,
  offsets with and without minutes, no timezone, infinities), plus the property that lexicographic
  order equals chronological order.
- `tests/db/client.test.ts` — asserts that importing the client leaves all three OIDs decoding to
  strings. This guards the driver contract itself: if an upgrade renames a built-in OID or changes
  parser wiring, CI fails instead of production.
- `tests/admin/index.test.ts` — renders the dashboard with submissions whose `created_at` is built
  by calling the real `parseTimestamp`, so the fixture carries production's exact shape.

## Rule for future fixtures

Build timestamp fixtures with `parseTimestamp(...)` on raw Postgres text instead of hand-writing an
ISO string. A hand-written string can agree with the type declaration while disagreeing with the
driver — exactly the gap that let this reach production.
