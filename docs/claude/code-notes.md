# Code notes

Fuller rationale behind the deliberately terse one-line comments in source and
test files. Code comments stay to a single line (per `CLAUDE.md` rule 2); the
"why" that needs more room lives here, keyed by file.

## `src/layouts/BaseLayout.astro` — font delivery

Fonts are self-hosted via `@fontsource`, Latin subset only, bundled at build
time so no external font requests are made at runtime. Broader performance work
(further subsetting) is tracked under story 0004. See also
`docs/claude/0003-brand-redesign.md` for the font-delivery decision.

## `tests/a11y.test.ts` — the axe audit gate

The story 0005 gate: every page must render with zero `critical`/`serious` axe
violations. Note axe's `color-contrast` rule cannot run under jsdom (there is no
layout engine), so it lands in axe's `incomplete` bucket rather than
`violations`. Contrast is therefore covered separately, from the token values,
in `tests/contrast.test.ts`.

The audit renders each page to a string, loads it into jsdom, then injects
axe-core's own trusted source into the jsdom realm and runs it there — the
standard axe-in-jsdom injection pattern. No untrusted input is evaluated. A
`VirtualConsole` swallows jsdom's noisy "could not parse CSS" logging, which is
irrelevant to the audit.

## `tests/contrast.test.ts` — WCAG contrast coverage

Because axe's `color-contrast` rule can't run under jsdom (see above), contrast
is asserted directly from the `tokens.css` values against the WCAG 2.1 formula.
The AA threshold for normal text is 4.5:1, and every foreground/background pair
the site actually paints (across the six pages plus chrome) must clear it.

## `tests/headings.test.ts` — heading hierarchy

Story 0005 requires a correct heading outline (axe can't fully confirm this under
jsdom — `page-has-heading-one` lands in `incomplete`). The test renders each full
page (including the `Footer` "Socials" `<h2>`), pulls the heading levels in
document order via a regex over the rendered HTML, and asserts: exactly one
`<h1>`, the first heading is the `<h1>`, and no forward jump greater than one
level (`<h1>`→`<h3>` fails; going shallower, e.g. `<h3>`→`<h2>`, is allowed). The
regex is used rather than jsdom because the rendered string is enough and it
keeps the jsdom type shim minimal.

## `tests/reflow.test.ts` — horizontal-scroll guard

jsdom has no layout engine, so overflow can't be measured by rendering. Instead
this is a static heuristic over every `.css` file and scoped `<style>` block: no
`width`/`min-width` may exceed the 320px viewport (a lookbehind skips
`max-width`, which is harmless); every grid `minmax()` column-min must fit the
mobile content budget (320px minus `main`'s 1.5rem inline padding on each side =
272px); and no `white-space: nowrap` may appear (it would stop text wrapping).
It is a regression guard, not a full layout check — it assumes content sits on
the shared `main` container and can't track arbitrary nested padding, so a real
browser pass (story 0007+ interactive work) remains the ground truth for pixel
overflow.

## `tests/pages-style.test.ts` — which pages carry scoped styles

Task T5 styles only the pages whose bespoke lists need a layout beyond the
shared editorial template (`team`, `create-next-digest`). The prose pages —
index, mission, meetings, contact — already sit correctly on the shared template
and are intentionally left untouched.

## `tests/styles.test.ts` — reading stylesheet sources

Vite's CSS plugin makes `*.css?raw` resolve to an empty module, so the tests
read the stylesheet sources from disk instead. The minimal ambient declarations
in `tests/shims.d.ts` keep `astro check` green without pulling `@types/node`
into the project.

## `tests/shims.d.ts` — ambient type shims

The project ships no `@types/node`, so a minimal ambient declaration covers the
Node builtins the tests use, keeping `astro check` green without adding a
dependency. Likewise, a minimal jsdom surface — just enough to render Astro
output and run axe-core inside the jsdom realm — avoids adding `@types/jsdom`.

## `tests/brand.test.ts` — masthead markup assertion

The wordmark text still lives in the masthead, but as of story 0004 the
decorative logo `<img>` precedes it inside `.brand`, so the assertion allows
markup between the `.brand` container and the wordmark text.
