import type { APIRoute } from 'astro';

// SSR proof: rendered per request, so `time` is fresh on every call.
export const prerender = false;

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({ status: 'ok', time: new Date().toISOString() }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
