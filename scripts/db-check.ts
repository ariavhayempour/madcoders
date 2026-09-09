import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

export interface Probe {
  name: string;
  email: string;
  meeting: string;
}

// A unique, clearly-throwaway record the runner targets by token.
export function buildProbe(token: string): Probe {
  return {
    name: 'db-check',
    email: `db-check+${token}@example.invalid`,
    meeting: `db-check-${token}`,
  };
}

async function runDbCheck(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const sql = neon(url);
  const probe = buildProbe(randomUUID());

  await sql`INSERT INTO rsvps (name, email, meeting)
            VALUES (${probe.name}, ${probe.email}, ${probe.meeting})`;
  const rows = await sql`SELECT id FROM rsvps WHERE email = ${probe.email}`;
  await sql`DELETE FROM rsvps WHERE email = ${probe.email}`;

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
