import type { APIRoute } from 'astro';
import { validateSubmission, type SubmissionInput } from '../../lib/submission-validation';
import { checkAbuse } from '../../lib/abuse-guard';
import { insertSubmission } from '../../db/submission';
import type { SubmissionType } from '../../db/schema';

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

  const blocked = await checkAbuse({ body, endpoint: 'inquiry', clientAddress });
  if (blocked) return blocked;

  const input = coerceInput(body);
  const errors = validateSubmission(input);
  if (errors.length > 0) return json({ ok: false, errors }, 400);

  try {
    const web3Key = process.env.WEB3FORMS_ACCESS_KEY || import.meta.env.WEB3FORMS_ACCESS_KEY;
    if (web3Key && web3Key !== 'TBD') {
      await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          access_key: web3Key,
          name: input.name,
          email: input.email,
          subject: `[MadCoders ${input.type}] Message from ${input.name}`,
          message: input.message,
        }),
      });
    }

    try {
      await insertSubmission(input);
    } catch (e) {
      // Gracefully continue if Web3Forms sent the message, otherwise rethrow for 500
      if (!web3Key || web3Key === 'TBD') {
        throw e;
      }
    }
    return json({ ok: true }, 201);
  } catch {
    // Swallow the error detail — never log the submitted email (PII).
    return json({ ok: false, code: 'server' }, 500);
  }
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
