import { sql } from './client';
import type { EventRow } from './schema';
import { slugifyEvent, type EventInput } from '../lib/event-validation';

// Postgres unique_violation — the slug UNIQUE constraint is the collision arbiter.
const UNIQUE_VIOLATION = '23505';

export async function listEvents(): Promise<EventRow[]> {
  return (await sql`
    SELECT id, slug, date, title, time, location, created_at
    FROM events
    ORDER BY date DESC, id DESC
  `) as EventRow[];
}

export async function getEvent(id: number): Promise<EventRow | null> {
  const rows = (await sql`
    SELECT id, slug, date, title, time, location, created_at
    FROM events
    WHERE id = ${id}
  `) as EventRow[];
  return rows[0] ?? null;
}

export async function insertEvent(input: EventInput): Promise<EventRow> {
  const { date, title, time, location } = normalize(input);
  const base = slugifyEvent(date, input.title);
  return withUniqueSlug(base, async (slug) => {
    const rows = (await sql`
      INSERT INTO events (slug, date, title, time, location)
      VALUES (${slug}, ${date}, ${title}, ${time}, ${location})
      RETURNING id, slug, date, title, time, location, created_at
    `) as EventRow[];
    return rows[0];
  });
}

// Rename-cascades the new slug into rsvps.meeting so existing RSVPs stay associated (docs/claude/0013-events-admin.md).
export async function updateEvent(id: number, input: EventInput): Promise<EventRow | null> {
  const { date, title, time, location } = normalize(input);
  const base = slugifyEvent(date, input.title);
  return withUniqueSlug(base, async (slug) => {
    const rows = (await sql`
      WITH prev AS (
        SELECT slug AS old_slug FROM events WHERE id = ${id}
      ), updated AS (
        UPDATE events
        SET slug = ${slug}, date = ${date}, title = ${title}, time = ${time}, location = ${location}
        WHERE id = ${id}
        RETURNING id, slug, date, title, time, location, created_at
      ), cascaded AS (
        UPDATE rsvps SET meeting = ${slug} WHERE meeting = (SELECT old_slug FROM prev)
      )
      SELECT id, slug, date, title, time, location, created_at FROM updated
    `) as EventRow[];
    return rows[0] ?? null;
  });
}

// Removes the event and its RSVP rows (matched by slug — there is no FK) in one statement.
export async function deleteEvent(id: number): Promise<void> {
  await sql`
    WITH removed AS (
      DELETE FROM events WHERE id = ${id} RETURNING slug
    )
    DELETE FROM rsvps WHERE meeting IN (SELECT slug FROM removed)
  `;
}

function normalize(input: EventInput): { date: string; title: string | null; time: string | null; location: string | null } {
  return {
    date: input.date.trim(),
    title: emptyToNull(input.title),
    time: emptyToNull(input.time),
    location: emptyToNull(input.location),
  };
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

// Try the base slug, then base-2, base-3, … retrying only on a unique_violation.
async function withUniqueSlug<T>(base: string, run: (slug: string) => Promise<T>): Promise<T> {
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    try {
      return await run(slug);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}
