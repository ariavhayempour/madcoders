import type { APIRoute } from 'astro';
import { setSubmissionRead } from '../../../../db/submission';

export const prerender = false;

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = parseInt(params.id || '', 10);
  if (isNaN(id)) return json({ ok: false }, 400);

  const body = await request.json().catch(() => null);
  if (typeof body?.isRead !== 'boolean') return json({ ok: false }, 400);

  try {
    await setSubmissionRead(id, body.isRead);
    return json({ ok: true }, 200);
  } catch (e) {
    return json({ ok: false }, 500);
  }
};
