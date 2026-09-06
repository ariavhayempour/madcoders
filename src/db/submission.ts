import { sql } from './client';
import type { SubmissionInput } from '../lib/submission-validation';
import type { SubmissionRow } from './schema';

// Newest first — backed by submissions_created_at_idx (created_at DESC).
export async function listSubmissions(): Promise<SubmissionRow[]> {
  return (await sql`
    SELECT id, name, email, submission_type, message, is_read, created_at
    FROM submissions
    ORDER BY created_at DESC
  `) as SubmissionRow[];
}

// No duplicate handling — `submissions` has no unique constraint; errors propagate to the route.
export async function insertSubmission(input: SubmissionInput): Promise<void> {
  await sql`INSERT INTO submissions (name, email, submission_type, message)
            VALUES (${input.name.trim()}, ${input.email.trim()}, ${input.type}, ${input.message.trim()})`;
}

export async function setSubmissionRead(id: number, isRead: boolean): Promise<void> {
  await sql`UPDATE submissions SET is_read = ${isRead} WHERE id = ${id}`;
}

// One round trip for a bulk selection — the array binds as a single parameter.
export async function deleteSubmissions(ids: number[]): Promise<void> {
  await sql`DELETE FROM submissions WHERE id = ANY(${ids})`;
}
