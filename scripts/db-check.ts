import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

export interface Probe {
  name: string;
  email: string;
  submission_type: string;
  message: string;
}

// A unique, clearly-throwaway record the runner targets by token; 'inquiry' is a stable member of the submissions CHECK set (see migrations/0001_init.sql).
export function buildProbe(token: string): Probe {
  return {
    name: 'db-check',
    email: `db-check+${token}@example.invalid`,
    submission_type: 'inquiry',
    message: `connectivity probe ${token}`,
  };
}

async function runDbCheck(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const sql = neon(url);
  const probe = buildProbe(randomUUID());

  await sql`INSERT INTO submissions (name, email, submission_type, message)
            VALUES (${probe.name}, ${probe.email}, ${probe.submission_type}, ${probe.message})`;
  const rows = await sql`SELECT id FROM submissions WHERE email = ${probe.email}`;
  await sql`DELETE FROM submissions WHERE email = ${probe.email}`;

  if (rows.length !== 1) {
    throw new Error(`Read-back returned ${rows.length} rows, expected 1`);
  }
  console.log('db:check OK — insert, read-back, and delete all succeeded.');
}

// Run only when executed directly, never on import (keeps tests DB-free).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDbCheck().catch((err) => {
    console.error('db:check FAILED —', err);
    process.exit(1);
  });
}
