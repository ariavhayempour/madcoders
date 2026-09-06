# 0011 — Admin authentication (Clerk-hosted)

Implements story `docs/user-stories/0011.md`: a private `/admin/*` area only authorized club
staff can reach. Gates story `0012` (admin dashboard).

Authentication is delegated to **Clerk** (hosted). Clerk owns login, logout, session issuance,
password hashing, and the admin user store — this codebase adds only the route gate and the
sign-in/admin UI. New dependency: `@clerk/astro`. New secrets: `PUBLIC_CLERK_PUBLISHABLE_KEY`,
`CLERK_SECRET_KEY` (both approved by the spec decision). One non-secret config var,
`PUBLIC_CLERK_SIGN_IN_URL=/admin/login`, points Clerk at the embedded sign-in. There is **no**
`PUBLIC_CLERK_SIGN_UP_URL` — admins are provisioned via Clerk Restricted mode, so no public
self-serve sign-up exists.

## Request gate

The whole mechanism is one middleware plus one pure helper:

```
request → clerkMiddleware (auth context) → adminRedirect(path, isAuthed) → redirect | continue
```

- `src/middleware.ts` — `clerkMiddleware()` initializes the Clerk auth context, then the pure
  guard decides the `/admin` gate. Signed-in signal is `auth().userId !== null`; the boolean
  keeps the guard vendor-agnostic.
- `src/lib/admin-guard.ts` — `adminRedirect(pathname, isAuthenticated)` returns the redirect
  target or `null`. It matches the `/admin` prefix precisely (exact `/admin` or `/admin/…`) so
  a lookalike like `/administrator` is never swept in, and it exempts exactly `/admin/login` to
  avoid a redirect loop. Fully unit-tested in `tests/auth/admin-guard.test.ts` (whole branch
  table). Because the gate short-circuits in middleware, protected pages never reach a DB query
  while signed-out — no admin/member data is exposed to unauthenticated requests.

## Pages & UI

- `src/pages/admin/login.astro` — hosts Clerk `<SignIn>`. Reachable while signed-out (the guard
  exempts this exact path). Uses **hash routing** (`routing="hash"`) so every multi-step sign-in
  state (e.g. 2FA) stays on `/admin/login`; with path routing Clerk's sub-paths (`.../factor-one`)
  would be caught by the `/admin` guard and redirect-loop. `forceRedirectUrl="/admin"` lands the
  admin on the dashboard after sign-in. No sign-up link is rendered.
- `src/pages/admin/index.astro` — protected landing; now hosts the dashboard itself (see 0012).
- `src/layouts/AdminLayout.astro` — admin shell (separate from the public `BaseLayout`; the admin
  area is unlinked and `noindex`). Sign-out is Clerk's `<UserButton>`.
- After sign-out, `afterSignOutUrl: '/admin/login'` on the `clerk()` integration
  (`astro.config.mjs`) returns the user to the gate rather than the marketing home page.

## Environment & Clerk dashboard config

Local: copy `.env.example` → `.env` (or `.env.local`) and paste the Clerk keys from the
dashboard, or `npx vercel env pull` once set on the Vercel project. Never commit real keys —
`.env` / `.env.*` are gitignored.

Clerk application settings (dashboard):

- **Authentication only** — Organizations (multi-tenancy) **off**; a single-club gate needs no
  B2B tenant/RBAC layer.
- **Restricted mode on** — self-serve sign-up disabled; admins are added by invitation / manual
  creation. Opening public sign-up later is a dashboard toggle, not a code change.
- Adapter unchanged: `@astrojs/vercel` + `output: 'server'`. Clerk requires only SSR, already on.

## Deviation from the story's affected-files list

The story pre-listed a roll-your-own mechanism (`src/pages/api/auth/{login,logout}.ts`,
`src/lib/session.ts`, `src/db/admin.ts`, an auth migration). None are built — Clerk owns that
surface. No `admins`/`sessions` table and no new migration.

## Testing

- **Unit (CI):** `tests/auth/admin-guard.test.ts` exhaustively covers `adminRedirect`. CI has no
  Clerk secret and never talks to Clerk — the integration itself is the vendor's contract.
- **Manual (with real keys + a provisioned admin):**
  1. Signed-out `GET /admin`, `/admin/`, `/admin/events` each redirect to `/admin/login`.
  2. `/admin/login` renders and is reachable signed-out (no loop).
  3. Sign in as a provisioned admin → land on `/admin`.
  4. Sign out (UserButton) → returns to `/admin/login`; re-requesting `/admin` redirects again.
  5. In a fresh incognito window, `/admin` redirects. Confirm Restricted mode blocks self-serve
     sign-up.
