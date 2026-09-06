import type { APIRoute } from 'astro';
import { validateRsvpEdit } from '../../../../lib/rsvp-validation';
import { updateRsvp, deleteRsvp } from '../../../../db/rsvp';
import type { RsvpStatus } from '../../../../db/schema';

export const prerender = false;

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = parseInt(params.id || '', 10);
  if (isNaN(id)) return json({ ok: false }, 400);

  const body = await request.json().catch(() => null);
  const status = (typeof body?.status === 'string' ? body.status : '') as RsvpStatus;

  const errors = validateRsvpEdit({ status });
  if (errors.length > 0) return json({ ok: false, errors }, 400);

  try {
    const result = await updateRsvp(id, { status });
    if (result.status === 'not_found') return json({ ok: false }, 404);
    return json({ ok: true, rsvp: result.rsvp }, 200);
  } catch (e) {
    return json({ ok: false }, 500);
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = parseInt(params.id || '', 10);
  if (isNaN(id)) return json({ ok: false }, 400);

  try {
    await deleteRsvp(id);
    return json({ ok: true }, 200);
  } catch (e) {
    return json({ ok: false }, 500);
  }
};
