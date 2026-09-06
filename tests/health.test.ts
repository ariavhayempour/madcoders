import { describe, it, expect } from 'vitest';
import { GET } from '../src/pages/api/health';

describe('GET /api/health', () => {
  it('returns 200 with ok status and a timestamp', async () => {
    const res = await GET({} as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.time).toBe('string');
  });
});
