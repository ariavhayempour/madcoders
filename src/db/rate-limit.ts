import { sql } from './client';

// Atomic fixed-window increment: one round-trip decides allow/deny under concurrency, returning the key's new count.
export async function hitRateLimit(key: string, windowStart: string, expiresAt: string): Promise<number> {
  await pruneExpired();
  const rows = (await sql`
    INSERT INTO rate_limit_hits (key, window_start, count, expires_at)
    VALUES (${key}, ${windowStart}, 1, ${expiresAt})
    ON CONFLICT (key) DO UPDATE SET count = rate_limit_hits.count + 1
    RETURNING count`) as { count: number }[];
  return rows[0]?.count ?? 0;
}

// Atomic sliding-gap touch: records this hit and returns the previous one, or null on a first hit.
export async function touchRateLimit(
  key: string,
  nowIso: string,
  expiresAt: string,
): Promise<string | null> {
  await pruneExpired();
  // The CTE snapshots the old row first; a bare RETURNING would yield the value just written and never trip the gap.
  const rows = (await sql`
    WITH prev AS (SELECT last_hit_at FROM rate_limit_hits WHERE key = ${key})
    INSERT INTO rate_limit_hits (key, window_start, count, expires_at, last_hit_at)
    VALUES (${key}, ${nowIso}, 1, ${expiresAt}, ${nowIso})
    ON CONFLICT (key) DO UPDATE SET count = rate_limit_hits.count + 1, last_hit_at = EXCLUDED.last_hit_at
    RETURNING (SELECT last_hit_at FROM prev) AS prev_last_hit_at`) as {
    prev_last_hit_at: string | null;
  }[];
  return rows[0]?.prev_last_hit_at ?? null;
}

// Best-effort housekeeping; a failure here must never block a submission.
async function pruneExpired(): Promise<void> {
  try {
    await sql`DELETE FROM rate_limit_hits WHERE expires_at < now()`;
  } catch {
    // Row TTL is an optimization, not correctness-critical — ignore and continue.
  }
}
