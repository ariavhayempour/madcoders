import { describe, it, expect } from 'vitest';
import { buildProbe } from '../../scripts/db-check';

describe('buildProbe', () => {
  it('builds a probe with the columns the rsvps insert requires', () => {
    const probe = buildProbe('token-abc');
    expect(probe.name).not.toBe('');
    expect(probe.email).not.toBe('');
    expect(probe.meeting).not.toBe('');
  });

  it('embeds the token so the throwaway record can be found and deleted', () => {
    const probe = buildProbe('token-abc');
    expect(probe.email).toContain('token-abc');
  });
});
