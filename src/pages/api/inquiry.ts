import type { APIRoute } from 'astro';
import { validateSubmission, type SubmissionInput } from '../../lib/submission-validation';
import { checkAbuse } from '../../lib/abuse-guard';
import type { SubmissionType } from '../../lib/submission-validation';

export const prerender = false;

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Gatekeeper only: clears abuse checks and validation, then the browser sends the mail via Web3Forms.
export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: 'invalid', errors: [] }, 400);
  }

  const blocked = await checkAbuse({ body, endpoint: 'inquiry', clientAddress });
  if (blocked) return blocked;

  const errors = validateSubmission(coerceInput(body));
  if (errors.length > 0) return json({ ok: false, errors }, 400);

  return json({ ok: true }, 201);
};

// Missing/non-string fields become empty strings (type to '') so validateSubmission is the single gate.
function coerceInput(body: unknown): SubmissionInput {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  return {
    name: typeof b.name === 'string' ? b.name : '',
    email: typeof b.email === 'string' ? b.email : '',
    type: (typeof b.type === 'string' ? b.type : '') as SubmissionType,
    message: typeof b.message === 'string' ? b.message : '',
  };
}
