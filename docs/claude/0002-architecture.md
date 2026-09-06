# 0002 — Componentized pages architecture

Implements story `docs/user-stories/0002.md`: the legacy single-file `index.html` SPA
(client-side `showPage()` toggle) rebuilt as componentized Astro pages, each with a real,
directly-loadable URL.

## Layout & SEO

- `src/layouts/BaseLayout.astro` is the one shell every page uses. Props `{title,
  description, path}`. It renders the `<head>` (via `SEO`), `Header`, a `<main><slot/>`,
  and `Footer`.
- `src/components/SEO.astro` emits `<title>{title} · Badger Journals</title>`, the meta
  description, Open Graph tags, and an **absolute** canonical/`og:url` built from
  `Astro.site`. `site` is set in `astro.config.mjs` (`https://badger-journals.vercel.app`);
  SEO also has an in-code fallback base so the value stays absolute when `Astro.site` is
  unset (e.g. the Vitest container runtime).

## Information architecture (nav)

`Header.astro` is a flat set of real `<a href>` links, so browser back/forward works
natively (AC-5):

- Flat links: Meetings, Mission, Team, Create the Next Digest, Contact.

> **Scope note:** the Reviews and Digests pages (and their content collections and the
> `ReviewCard` component) were removed — the site is currently the five pages above plus
> the `/` hub. See the "Reviews / Digests removed" note below.

## Content model

Team roster and expansion research-areas are plain typed modules (`src/data/team.ts`,
`src/data/research-areas.ts`) — small, static, no need for a collection. There are no
content collections at present (`src/content.config.ts` and `src/content/` were removed
with the reviews/digests pages).

### Reviews / Digests removed

The original 0002 build shipped a `reviews` collection (6 metadata-only review pages, each
with its own URL via `reviews/[slug].astro`), a `digests` collection (3 digest pages), a
shared `ReviewCard.astro`, and a Digests disclosure in the nav. All of it has since been
removed to pare the site down to the five core pages; the home hub no longer lists digests.
If review/digest content returns, restore the collections in `src/content.config.ts` and
the corresponding routes.

## Rendering

Every page sets `export const prerender = true` — the six named pages (`/`, `/meetings`,
`/mission`, `/team`, `/create-next-digest`, `/contact`) are static HTML. The
`@astrojs/vercel` SSR adapter stays configured for later stories (0006+) and the
`/api/health` route; nothing in the current page set needs per-request rendering.

## Testing notes

- Components and static pages are tested with Astro's Container API
  (`experimental_AstroContainer`) in Vitest.
- Dev/container renders inject `data-astro-source-*` attributes on elements; these are
  stripped in the production build. Tests match element text tolerant of attributes.

## Deferrals (owned by later stories)

- Visual brand redesign — the legacy crimson/serif design (Playfair Display / Cormorant
  Garamond / Libre Baskerville, `--crimson #8B1A1A`) is **not** ported. Story 0003.
- Imagery (hub photo, logo, team SVG) — story 0004.
- Accessibility/responsive standards — story 0005.
- Meetings calendar (interactive JS month grid) — story 0007. 0002 ships the meeting-details
  text only. Unknown values (meeting `When`/`Where`, unfilled team seats) use `TODO` as the
  placeholder convention until real content lands.
- Join / Start-a-Digest / interest **forms** — dropped in 0002 (legacy posted to Formspree);
  return with the submission stories 0008/0009. Contact + Create-the-Next-Digest keep their
  headers and copy.
