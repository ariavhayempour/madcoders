import { clerkMiddleware } from '@clerk/astro/server';
import { adminRedirect } from './lib/admin-guard';

// Clerk sets up the request auth context; the pure guard decides the /admin gate. See docs/claude/0011-admin-auth.md
export const onRequest = clerkMiddleware(async (auth, context, next) => {
  const target = adminRedirect(context.url.pathname, auth().userId !== null);
  if (target) return context.redirect(target);

  const response = await next();
  // Admin pages/API routes always reflect live data; browsers/CDN must never cache a stale copy.
  if (context.url.pathname.startsWith('/admin')) {
    response.headers.set('Cache-Control', 'no-store');
  }
  return response;
});
