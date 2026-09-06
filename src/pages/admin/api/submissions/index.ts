import type { APIRoute } from 'astro';
import { deleteSubmissions } from '../../../../db/submission';

export const prerender = false;

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const isValidId = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

export const DELETE: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(isValidId)) return json({ ok: false }, 400);

  try {
    await deleteSubmissions(ids);
    return json({ ok: true }, 200);
  } catch (e) {
    return json({ ok: false }, 500);
  }
};
