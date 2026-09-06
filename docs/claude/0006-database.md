# 0006 — Database & migrations

Implements story `docs/user-stories/0006.md`: the durable data layer for RSVPs and
submissions. This story provisions Postgres and the tooling; it ships **no** forms, API
routes, or pages — those arrive in 0008/0009/0010/0012.

## Provider & driver

- **Provider:** [Neon](https://neon.tech) serverless Postgres, added through the **Vercel
  Marketplace** integration (Vercel project → Storage → Neon). The integration injects the
  connection strings into the Vercel deployment environment automatically.
- **Driver:** [`@neondatabase/serverless`](https://github.com/neondatabase/serverless), no ORM.
  - Request-path access (API routes in later stories) uses the HTTP `neon()` tagged-template
    client — low serverless cold-start cost, no TCP pool to exhaust.
  - The migration runner uses the WebSocket `Pool` for multi-statement transactional DDL.
- **No script-runner dependency.** `engines.node` is `>=22`, so the `.ts` scripts run under
  Node's native type stripping (`node --experimental-strip-types`). Node 22+ also exposes a
  global `WebSocket`, which the `Pool` uses (`neonConfig.webSocketConstructor =
  globalThis.WebSocket`) — no `ws` dependency. **Vercel's build Node version must be set to
  22** to match.

## Connection strings & secret handling

The Neon integration was installed with the custom prefix **`DATABASE`**, so it created,
among others:

| Variable | Kind | Used by |
|---|---|---|
| `DATABASE_URL` | pooled | `src/db/client.ts`, `scripts/db-check.ts` (request-path style access) |
| `DATABASE_URL_UNPOOLED` | direct/unpooled | `scripts/migrate.ts` (transactional multi-statement DDL) |

The pooled connection can interfere with a transaction that spans several statements, so the
migration runner is pointed at the **unpooled** URL; everything else uses the pooled
`DATABASE_URL`.

**Secrets never enter git.** `.gitignore` blocks `.env` and `.env.*` (allowing only
`.env.example`). To get the values locally, either copy `.env.example` to `.env` and paste
the string from the Neon console, or pull them from Vercel:

```bash
npx vercel link          # once
npx vercel env pull .env  # writes DATABASE_URL (+ the rest) into .env
```

`.env.example` documents the required variable with a placeholder only:

```
DATABASE_URL=postgres://USER:PASSWORD@HOST/DB?sslmode=require
```

`src/db/client.ts` reads `process.env.DATABASE_URL` at module load and throws
`DATABASE_URL is not set` if it is missing, so a missing secret fails loudly at first use
rather than mid-query.

## Schema

DDL in `migrations/*.sql` is the **source of truth**; `src/db/schema.ts` hand-mirrors it as
TypeScript row types and table/column name constants. `tests/db/schema.test.ts` parses the
`submission_type` CHECK values out of the migration SQL and asserts they equal
`SUBMISSION_TYPES`, so the two cannot drift.

`migrations/0001_init.sql`:

- **`rsvps`** — `id, name, email, meeting, created_at`. `UNIQUE (email, meeting)` enforces
  the "one RSVP per email per meeting" rule (0008) at the database level. Index
  `rsvps_meeting_idx` on `meeting` for the admin group-by-meeting view (0012).
- **`submissions`** — `id, name, email, submission_type, message, created_at`.
  `submission_type` is a `TEXT` column with `CHECK (submission_type IN ('inquiry', 'join',
  'digest'))` — a CHECK, not a Postgres `ENUM`, so adding a type later is a one-line
  migration rather than a type alteration. Index `submissions_created_at_idx` on
  `created_at DESC` for the admin inbox (0012).
- Email-format validation (e.g. `wisc.edu`) is deliberately **not** enforced in the
  database — that is an application concern for 0008/0010.

`_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())` is created by
the runner, not by a hand-written migration.

## Running migrations & the connectivity check

Both scripts read `DATABASE_URL` from the environment. Node does not auto-load `.env`, so
pass it explicitly (or export it):

```bash
# Apply pending migrations (use the UNPOOLED url for transactional DDL):
DATABASE_URL="$DATABASE_URL_UNPOOLED" pnpm db:migrate

# Connectivity check — insert, read back, delete a throwaway record; exits non-zero on failure:
node --env-file=.env --experimental-strip-types scripts/db-check.ts   # i.e. pnpm db:check with DATABASE_URL set
```

- `pnpm db:migrate` → `node --experimental-strip-types scripts/migrate.ts`. It ensures the
  `_migrations` table exists, selects pending files (every `.sql` not yet recorded, ascending
  by filename), and applies each as one multi-statement query inside a `BEGIN/COMMIT`,
  recording the filename. **Forward-only and idempotent** — re-running with nothing pending
  prints `No pending migrations.` and changes nothing.
- `pnpm db:check` → `node --experimental-strip-types scripts/db-check.ts`. The script-only
  production connectivity proof (there is no throwaway API route). Exits `0` on success and
  leaves no residual record.

The pure ordering logic (`selectPending`) and the env guard are unit-tested in `tests/db/`
without a database; the live guarantees (unique constraint, CHECK, idempotency, round-trip)
are verified out-of-band by running the scripts against Neon — CI has no secret and does not
touch the database.

## Adding a new migration

1. Create the next numbered file, e.g. `migrations/0002_<description>.sql`. **Never edit a
   migration that has already been applied** — add a new one.
2. If it changes a table shape that `src/db/schema.ts` mirrors, update `schema.ts` (and, for
   any new `CHECK` list, the corresponding sync test) in the same change.
3. Apply it with `DATABASE_URL="$DATABASE_URL_UNPOOLED" pnpm db:migrate`.

## Files

```
src/db/client.ts        neon() HTTP client from DATABASE_URL (throws if unset) — request-path access
src/db/schema.ts        RsvpRow, SubmissionRow, SubmissionType, SUBMISSION_TYPES, name constants
migrations/0001_init.sql  rsvps + submissions (+ constraints, indexes)
scripts/migrate.ts      forward-only migration runner (WebSocket Pool, transactional)
scripts/db-check.ts     connectivity check (insert → read back → delete)
tests/db/               unit tests: schema sync, env guard, selectPending ordering, probe shape
```
