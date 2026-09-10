# MadCoders

The website for **MadCoders** (UW-Madison Madison Coders Club). Built on **Astro** (SSR) with **React** islands and **Tailwind CSS**, backed by **Neon** Postgres (TBD), and deployed to **Vercel** (TBD).

The site has two registers:

- **Public** — a marketing/brand surface (home, meetings, team, contact, projects) where
  visitors learn about the club, see meeting logistics, and RSVP or submit in a couple of clicks.
- **`/admin`** — a Clerk-authenticated dashboard where officers manage events, review RSVPs,
  and triage submissions.

See [`PRODUCT.md`](PRODUCT.md) for the product brief and [`docs/claude/`](docs/claude/) for
architecture and per-feature decision records.

## Tech stack

- **Astro 7** with `output: 'server'` (SSR via the `@astrojs/vercel` adapter)
- **React 19** islands (`@astrojs/react`) with **shadcn/ui** + **Base UI** components
- **Tailwind CSS 4** (`@tailwindcss/vite`), self-hosted fonts via `@fontsource`
- **Clerk** (`@clerk/astro`) for hosted admin auth (TBD for credentials)
- **Neon** serverless Postgres (`@neondatabase/serverless`) with raw SQL migrations — no ORM (TBD for credentials)
- **Vitest** for the test suite
- TypeScript strict mode throughout

## Prerequisites

- **Node.js 22+** (`engines.node` is `>=22`)
- **pnpm** (the committed package manager)

Enable pnpm with Corepack if you don't have it:

```bash
corepack enable
```

## Setup

```bash
pnpm install
cp .env.example .env    # fill in real values when available (set to TBD by default)
```

### Environment

Local dev reads `.env` (and `.env.local`); both are gitignored — never commit real values.
See [`.env.example`](.env.example) for details. All secrets are currently set to `"TBD"`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string (TBD) |
| `PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (TBD) |
| `CLERK_SECRET_KEY` | Clerk secret key (TBD) |
| `PUBLIC_CLERK_SIGN_IN_URL` | Canonical sign-in path — the embedded admin login (`/admin/login`) |
| `PUBLIC_WEB3FORMS_ACCESS_KEY` | Web3Forms access key for the contact form. `PUBLIC_` because the browser sends the mail; inlined at build time, so changing it requires a redeploy |

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Start the local dev server at http://localhost:4321 |
| `pnpm build` | Production build — runs `astro check` then `astro build` |
| `pnpm typecheck` | Type-check only (`astro check`), no build output |
| `pnpm test` | Run the Vitest suite once |
| `pnpm preview` | Serve the production build locally |

## Project structure

```
.
├── astro.config.mjs        Astro config: server output, Vercel adapter, Clerk, React, Tailwind
├── tsconfig.json           extends astro/tsconfigs/strict
├── vitest.config.ts        Vitest wired to Astro's Vite config
├── components.json         shadcn/ui config
├── migrations/             raw SQL migrations
├── scripts/                migrate.ts, db-check.ts
├── docs/claude/            architecture + per-feature decision records
└── src/
    ├── middleware.ts       Clerk auth context + the /admin redirect gate
    ├── layouts/            BaseLayout (public shell) + AdminLayout
    ├── pages/
    │   ├── index.astro     home (+ meetings, team, contact)
    │   ├── api/            SSR endpoints: health, rsvp, inquiry
    │   └── admin/          dashboard, events, rsvps, submissions, login (+ admin APIs)
    ├── components/         Astro + React components
    ├── db/                 Neon client + query modules
    ├── lib/                validation, guards, abuse protection
    ├── data/               static typed content (team roster, projects)
    └── styles/global.css   Tailwind entry + brand tokens (UW Cardinal red anchor)
```

## Deployment

Deployment target: **Vercel** (TBD).
