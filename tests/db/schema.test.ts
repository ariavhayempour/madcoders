import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SUBMISSION_TYPES, RATE_LIMIT_COLUMNS, EVENT_COLUMNS, RSVP_STATUSES } from '../../src/db/schema';

const readMigration = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../../migrations/${name}`, import.meta.url)), 'utf8');

const migration = readMigration('0001_init.sql');
const rateLimitMigration = readMigration('0002_rate_limit.sql');
const eventsMigration = readMigration('0003_events.sql');
const rsvpStatusMigration = readMigration('0005_rsvp_status.sql');
const slidingMigration = readMigration('0006_rate_limit_sliding.sql');

describe('schema ↔ DDL sync', () => {
  it('SUBMISSION_TYPES equals the submission_type CHECK values in the migration', () => {
    const check = migration.match(/submission_type[\s\S]*?IN\s*\(([^)]*)\)/i);
    expect(check, 'submission_type CHECK constraint not found in migration').not.toBeNull();

    const checkValues = [...check![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(checkValues).toEqual([...SUBMISSION_TYPES]);
  });

  it('RSVP_STATUSES equals the status CHECK values in the migration', () => {
    const check = rsvpStatusMigration.match(/status[\s\S]*?IN\s*\(([^)]*)\)/i);
    expect(check, 'status CHECK constraint not found in migration').not.toBeNull();

    const checkValues = [...check![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(checkValues).toEqual([...RSVP_STATUSES]);
  });

  it('RATE_LIMIT_COLUMNS mirror the rate_limit_hits columns across both migrations', () => {
    const block = rateLimitMigration.match(/CREATE TABLE rate_limit_hits\s*\(([\s\S]*?)\);/i);
    expect(block, 'rate_limit_hits table not found in migration').not.toBeNull();

    const created = [...block![1].matchAll(/^\s*([a-z_]+)\s+(?:TEXT|TIMESTAMPTZ|INTEGER)\b/gim)].map((m) => m[1]);
    // Columns added later arrive via ALTER, so the mirror spans the create plus every subsequent add.
    const added = [...slidingMigration.matchAll(/ADD COLUMN(?:\s+IF NOT EXISTS)?\s+([a-z_]+)/gi)].map((m) => m[1]);

    expect([...created, ...added].sort()).toEqual([...Object.values(RATE_LIMIT_COLUMNS)].sort());
  });

  it('adds last_hit_at as a nullable column so the migration cannot fail on existing rows', () => {
    expect(slidingMigration).toMatch(/ADD COLUMN(?:\s+IF NOT EXISTS)?\s+last_hit_at\s+TIMESTAMPTZ/i);
    expect(slidingMigration).not.toMatch(/last_hit_at[^;]*NOT NULL/i);
  });

  it('EVENT_COLUMNS mirror the events columns in the migration', () => {
    const block = eventsMigration.match(/CREATE TABLE events\s*\(([\s\S]*?)\);/i);
    expect(block, 'events table not found in migration').not.toBeNull();

    const ddlColumns = [...block![1].matchAll(/^\s*([a-z_]+)\s+(?:BIGINT|TEXT|TIMESTAMPTZ)\b/gim)].map((m) => m[1]);
    expect(ddlColumns.sort()).toEqual([...Object.values(EVENT_COLUMNS)].sort());
  });
});
