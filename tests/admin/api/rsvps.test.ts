import { describe, it, expect, vi, afterEach } from 'vitest';
import { src } from '../../mock-path';
import type { UpdateRsvpResult } from '../../../src/db/rsvp';

afterEach(() => {
  vi.doUnmock(src('db/rsvp'));
  vi.resetModules();
});

async function loadRoute(overrides: { updateRsvp?: (...args: unknown[]) => unknown; deleteRsvp?: (...args: unknown[]) => unknown }) {
  vi.resetModules();
  const updateRsvp = vi.fn(overrides.updateRsvp ?? (async (): Promise<UpdateRsvpResult> => ({ status: 'not_found' })));
  const deleteRsvp = vi.fn(overrides.deleteRsvp ?? (async () => undefined));
  vi.doMock(src('db/rsvp'), () => ({ updateRsvp, deleteRsvp }));
  const route = await import('../../../src/pages/admin/api/rsvps/[id]');
  return { ...route, updateRsvp, deleteRsvp };
}

describe('PATCH /admin/api/rsvps/[id]', () => {
  const valid = { status: 'present' };

  it('returns 200 and the updated row for a valid edit', async () => {
    const rsvp = { id: 1, name: 'Bucky Badger', email: 'bucky@wisc.edu', meeting: 'kickoff', status: 'present', created_at: '2026-07-01T00:00:00.000Z' };
    const { PATCH, updateRsvp } = await loadRoute({ updateRsvp: async () => ({ status: 'ok', rsvp }) });
    const request = new Request('http://localhost/admin/api/rsvps/1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(valid),
    });
    const res = await PATCH({ params: { id: '1' }, request } as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, rsvp });
    expect(updateRsvp).toHaveBeenCalledWith(1, valid);
  });

  it('returns 400 with field errors for an invalid status and does not update', async () => {
    const { PATCH, updateRsvp } = await loadRoute({});
    const request = new Request('http://localhost/admin/api/rsvps/1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'maybe' }),
    });
    const res = await PATCH({ params: { id: '1' }, request } as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.errors.map((e: { field: string }) => e.field)).toContain('status');
    expect(updateRsvp).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-numeric id and does not update', async () => {
    const { PATCH, updateRsvp } = await loadRoute({});
    const request = new Request('http://localhost/admin/api/rsvps/abc', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(valid),
    });
    const res = await PATCH({ params: { id: 'abc' }, request } as never);
    expect(res.status).toBe(400);
    expect(updateRsvp).not.toHaveBeenCalled();
  });

  it('returns 404 when the id does not exist', async () => {
    const { PATCH } = await loadRoute({ updateRsvp: async () => ({ status: 'not_found' }) });
    const request = new Request('http://localhost/admin/api/rsvps/999', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(valid),
    });
    const res = await PATCH({ params: { id: '999' }, request } as never);
    expect(res.status).toBe(404);
  });

  it('returns 400 without throwing on malformed JSON', async () => {
    const { PATCH, updateRsvp } = await loadRoute({});
    const request = new Request('http://localhost/admin/api/rsvps/1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: '{ not json',
    });
    const res = await PATCH({ params: { id: '1' }, request } as never);
    expect(res.status).toBe(400);
    expect(updateRsvp).not.toHaveBeenCalled();
  });

  it('returns 500 when the update throws unexpectedly', async () => {
    const { PATCH } = await loadRoute({
      updateRsvp: async () => {
        throw new Error('boom');
      },
    });
    const request = new Request('http://localhost/admin/api/rsvps/1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(valid),
    });
    const res = await PATCH({ params: { id: '1' }, request } as never);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /admin/api/rsvps/[id]', () => {
  it('returns 200 and deletes the row', async () => {
    const { DELETE, deleteRsvp } = await loadRoute({});
    const res = await DELETE({ params: { id: '1' } } as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(deleteRsvp).toHaveBeenCalledWith(1);
  });

  it('returns 400 for a non-numeric id and does not delete', async () => {
    const { DELETE, deleteRsvp } = await loadRoute({});
    const res = await DELETE({ params: { id: 'abc' } } as never);
    expect(res.status).toBe(400);
    expect(deleteRsvp).not.toHaveBeenCalled();
  });

  it('returns 500 when the delete throws unexpectedly', async () => {
    const { DELETE } = await loadRoute({
      deleteRsvp: async () => {
        throw new Error('boom');
      },
    });
    const res = await DELETE({ params: { id: '1' } } as never);
    expect(res.status).toBe(500);
  });
});
