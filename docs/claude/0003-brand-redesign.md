# 0003 — UW-Madison brand redesign

Implements story `docs/user-stories/0003.md`. A
cross-cutting **visual system** layered on the 0002 componentized pages, which shipped
semantic HTML with class hooks but zero CSS. 0003 builds the whole visual layer from
scratch on Cardinal Red (`#C5050C`) + white, with the legacy crimson (`#8B1A1A`) gone.

## Architecture

Design tokens + Astro scoped component styles — no CSS framework, no new UI dependency.

- `src/styles/tokens.css` — the single source of raw values (color, type, space, shape).
  Every use-site references a token via `var()`; **raw hex lives only here**.
- `src/styles/global.css` — reset, base element styles, shared interaction states, and the
  editorial template (content `<main>` container, section rhythm). All values reference
  tokens; no raw hex. (The `.reviews`/`.digests`/`.tag`/`.authors` patterns were removed
  with the reviews/digests pages — see 0002.)
- Both imported **once** in `src/layouts/BaseLayout.astro`, so every page inherits the
  system.
- Component-local look-and-feel stays in each component's scoped `<style>` (`Header`,
  `Footer`) and in per-page scoped `<style>` for bespoke layouts (`index` hero, `team`
  member grid, `create-next-digest` areas grid).

## Locked decisions

- **Typography:** editorial serif display + clean sans body.
  - Display / headings / masthead: **Playfair Display** (weights 600, 700).
  - Body / UI: **Inter** (weights 400, 500, 600).
- **Font delivery — `@fontsource`, not committed `public/fonts/` binaries.** The spec
  proposed hand-placed `.woff2` files under `public/fonts/`; at implementation we chose the
  `@fontsource/*` packages instead (`@fontsource/inter`, `@fontsource/playfair-display`,
  both SIL OFL). Still fully self-hosted with **zero external font requests** — the woff2
  are bundled into the build and referenced by hashed local URLs. `BaseLayout` imports the
  **Latin-subset** weight CSS (`@fontsource/<family>/latin-<weight>.css`) to stay lean (5
  woff2 total; the un-subsetted imports would emit 58). This is the one deviation from the
  spec's stated mechanism; the spec/plan text under `tasks/` still describes `public/fonts/`
  and is superseded by this note.
- **No new UI framework / CSS framework / `vercel.json`.** The only added dependencies are
  the two OFL `@fontsource` font packages.

## Tokens

```css
/* Brand */
--color-cardinal: #c5050c;      /* UW-Madison Badger Red — primary; accents/headings/links */
--color-cardinal-dark: #9b0000; /* hover/active depth */
--color-ink: #1a1a1a;           /* body text */
--color-paper: #ffffff;         /* page background */
--color-paper-muted: #f7f5f2;   /* section/card background */
--color-rule: #e2ddd6;          /* hairline borders */

/* Type */
--font-display: 'Playfair Display', Georgia, 'Times New Roman', serif;
--font-body: 'Inter', system-ui, -apple-system, sans-serif;
--step-0: 1rem;   --step-1: 1.25rem; --step-2: 1.6rem;
--step-3: 2.1rem; --step-4: 2.75rem; /* body → masthead / page titles */

/* Space / shape */
--space-3: .75rem; --space-4: 1rem; --space-6: 1.5rem; --space-8: 2rem;
--radius: 6px;
--shadow-1: 0 1px 3px rgb(0 0 0 / 0.08);
```

Muted body text (`.authors`) is derived, not a new token:
`color-mix(in srgb, var(--color-ink) 65%, transparent)`.

## Conventions

- Cardinal Red drives accents, headings, links, and the header/footer rules — **never body
  copy** (body is `--color-ink` on `--color-paper`); the full contrast/a11y audit is 0005.
- Interactive elements (`a`, `button`) share `:hover`, `:active`, and `:focus-visible`
  states from `global.css` base rules; components add local hover on top.
- Header: display-serif wordmark, 3px cardinal bottom rule, flat nav links. Footer: 3px
  cardinal top rule, paper-muted panel. Both live in `BaseLayout`, so the chrome is
  identical on every route.

## Testing

- Unit/component tests use Astro's Container API (Vitest), matching the 0002 pattern.
- **Container caveat:** imported global CSS and scoped `<style>` blocks are *not* emitted in
  `renderToString` output — Astro only applies the `data-astro-cid-*` scope attribute. So
  style-layer assertions read the source files (`tokens.css`/`global.css` from disk, `.astro`
  via `?raw`) rather than rendered HTML; container tests assert the branded *structure* and
  that scope attributes are applied. Full visual correctness is verified via `pnpm preview`.
- **Color guard** (`tests/brand.test.ts`): recursively walks `src/` and fails if `8b1a1a`
  or `crimson` appears — the automated form of DoD #1 (`grep -ri '8b1a1a\|crimson' src/`
  empty). Proven to fail when the legacy color is reintroduced.
- `tests/shims.d.ts` declares minimal ambient types for the Node builtins used by the
  file-reading tests, keeping `astro check` green without adding `@types/node`.

## Deferred (owned elsewhere)

Imagery / logo (0004); a11y + responsive hardening beyond focus states (0005); form behavior
(0008/0009). 0003 changed no page content, routes, or behavior — styling only.
