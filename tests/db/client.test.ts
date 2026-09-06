import { describe, it, expect, afterEach, vi } from 'vitest';

const ORIGINAL = process.env.DATABASE_URL;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = ORIGINAL;
  vi.resetModules();
});

describe('db client env guard', () => {
  it('throws a descriptive error when DATABASE_URL is unset', async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    await expect(import('../../src/db/client')).rejects.toThrow('DATABASE_URL');
  });

  it('constructs a query client when DATABASE_URL is set', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@host/db?sslmode=require';
    vi.resetModules();
    const mod = await import('../../src/db/client');
    expect(mod.sql).toBeDefined();
  });

  // Guards the driver contract itself: importing the client must leave date/time columns as strings.
  it('registers parsers so date/time columns decode to strings, not Date objects', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@host/db?sslmode=require';
    vi.resetModules();
    await import('../../src/db/client');
    const { types } = await import('@neondatabase/serverless');

    for (const oid of [types.builtins.TIMESTAMPTZ, types.builtins.TIMESTAMP, types.builtins.DATE]) {
      expect(oid, 'driver no longer exposes this built-in OID').toBeTypeOf('number');
      const decoded = types.getTypeParser(oid)('2026-08-05 17:52:04.123+00');
      expect(decoded, `OID ${oid} still decodes to a Date`).toBeTypeOf('string');
    }
  });
});
