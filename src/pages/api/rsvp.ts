import type { APIRoute } from 'astro';
import { validateRsvp, type RsvpInput } from '../../lib/rsvp-validation';
import { checkAbuse } from '../../lib/abuse-guard';
import { insertRsvp } from '../../db/rsvp';

export const prerender = false;

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: 'invalid', errors: [] }, 400);
  }

  const blocked = await checkAbuse({ body, endpoint: 'rsvp', clientAddress });
  if (blocked) return blocked;

  const input = coerceInput(body);
  const errors = validateRsvp(input);
  if (errors.length > 0) return json({ ok: false, errors }, 400);

  try {
    const result = await insertRsvp(input);
    if (result.status === 'duplicate') return json({ ok: false, code: 'duplicate' }, 409);
    return json({ ok: true }, 201);
  } catch {
    // Swallow the error detail — never log the submitted email (PII).
    return json({ ok: false, code: 'server' }, 500);
  }
};

// Missing/non-string fields become empty strings so validateRsvp is the single gate.
function coerceInput(body: unknown): RsvpInput {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  return {
    name: typeof b.name === 'string' ? b.name : '',
    email: typeof b.email === 'string' ? b.email : '',
    meeting: typeof b.meeting === 'string' ? b.meeting : '',
  };
}
