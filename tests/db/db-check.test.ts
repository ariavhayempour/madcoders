import { describe, it, expect } from 'vitest';
import { buildProbe } from '../../scripts/db-check';
import { SUBMISSION_TYPES } from '../../src/db/schema';

describe('buildProbe', () => {
  it('builds a probe whose submission_type passes the CHECK constraint', () => {
    const probe = buildProbe('token-abc');
    expect(SUBMISSION_TYPES).toContain(probe.submission_type);
  });

  it('embeds the token so the throwaway record can be found and deleted', () => {
    const probe = buildProbe('token-abc');
    expect(probe.email).toContain('token-abc');
  });
});
