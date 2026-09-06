import { sql } from './client';
import type { RsvpEditInput, RsvpInput } from '../lib/rsvp-validation';
import type { RsvpRow } from './schema';

export type InsertRsvpResult = { status: 'ok' } | { status: 'duplicate' };
export type UpdateRsvpResult =
  | { status: 'ok'; rsvp: RsvpRow }
  | { status: 'not_found' };

// Newest first so groupRsvpsByMeeting can rank meetings and rows by recency.
export async function listRsvps(): Promise<RsvpRow[]> {
  return (await sql`
    SELECT id, name, email, meeting, status, created_at
    FROM rsvps
    ORDER BY created_at DESC
  `) as RsvpRow[];
}

// Postgres unique_violation — the (email, meeting) constraint is the race arbiter.
const UNIQUE_VIOLATION = '23505';

// Insert-and-catch rather than check-then-insert, so concurrent RSVPs can't slip between an existence check and the write.
export async function insertRsvp(input: RsvpInput): Promise<InsertRsvpResult> {
  try {
    await sql`INSERT INTO rsvps (name, email, meeting) VALUES (${input.name.trim()}, ${input.email.trim()}, ${input.meeting})`;
    return { status: 'ok' };
  } catch (err) {
    if (isUniqueViolation(err)) return { status: 'duplicate' };
    throw err;
  }
}

// Admin edit: attendance status only; name/email/meeting are immutable here (see docs/claude/0008-rsvp.md).
export async function updateRsvp(id: number, input: RsvpEditInput): Promise<UpdateRsvpResult> {
  const rows = (await sql`
    UPDATE rsvps
    SET status = ${input.status}
    WHERE id = ${id}
    RETURNING id, name, email, meeting, status, created_at
  `) as RsvpRow[];
  return rows[0] ? { status: 'ok', rsvp: rows[0] } : { status: 'not_found' };
}

export async function deleteRsvp(id: number): Promise<void> {
  await sql`DELETE FROM rsvps WHERE id = ${id}`;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}
