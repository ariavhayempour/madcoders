import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { neonConfig, Pool } from '@neondatabase/serverless';

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));

// Pure: the pending set is every .sql file not yet recorded, ascending by filename.
export function selectPending(
  allFilenames: string[],
  appliedFilenames: string[],
): string[] {
  const applied = new Set(appliedFilenames);
  return allFilenames
    .filter((name) => name.endsWith('.sql') && !applied.has(name))
    .sort();
}

async function runMigrations(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  // The Pool speaks WebSocket; Node 22+ exposes a global constructor.
  neonConfig.webSocketConstructor = globalThis.WebSocket;
  const pool = new Pool({ connectionString: url });

  try {
    await pool.query(
      'CREATE TABLE IF NOT EXISTS _migrations (' +
        'filename TEXT PRIMARY KEY, ' +
        'applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );

    const applied = (await pool.query('SELECT filename FROM _migrations')).rows.map(
      (row) => row.filename as string,
    );
    const pending = selectPending(readdirSync(MIGRATIONS_DIR), applied);

    if (pending.length === 0) {
      console.log('No pending migrations.');
      return;
    }

    for (const filename of pending) {
      // Each file runs as one multi-statement query inside a single transaction.
      const ddl = readFileSync(`${MIGRATIONS_DIR}/${filename}`, 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(ddl);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
        console.log(`Applied ${filename}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}

// Run the migration only when executed directly, never on import (keeps tests DB-free).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
