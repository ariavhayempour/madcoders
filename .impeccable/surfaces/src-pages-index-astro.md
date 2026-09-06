---
version: 1
slug: "src-pages-index-astro"
primary_target: "src/pages/index.astro"
related_targets: ["src/pages/meetings.astro","src/pages/team.astro","src/pages/contact.astro","src/layouts/BaseLayout.astro","src/components/Header.astro","src/components/Footer.astro"]
---

## Scope & mode
Public marketing pages (home, meetings, team, contact). Mode: Persuade — visitor decides to attend/join and RSVPs.

## Audience / job / action / proof / constraints
- Audience: UW–Madison undergrads (any major), deciding in seconds whether to attend Tuesday's meeting.
- Job: understand what MadCoders is and get to a meeting with no friction.
- Action: RSVP / see next meeting logistics (date, time, location) — must stay the clearest, least-decorated element on every page (PRODUCT.md principle).
- Proof/content: real mission copy, real project tracks, real team roster — no invented commercial claims.
- Constraint: WCAG 2.1 AA, prefers-reduced-motion alternative for any motion, keep Header/Footer navigation working (real `<a href>`, back/forward native).

## Chosen direction & memorable moment
**IDE Window** — the whole page is framed as one persistent code-editor shell: a file-tree sidebar doubles as page navigation (index.md, meetings.md, projects/, team.json, contact.md), a tab bar across the top carries page context with an always-visible RSVP tab, and a real line-number gutter runs the full page height beside the content column. Content itself renders as YAML front-matter, Markdown panels, and JSON-styled data blocks — not decorative snippets bolted onto a generic hero.

Memorable moment: scrolling the page feels like scrolling a real open file in an editor — the gutter counts real lines the whole way down, the sidebar highlights the current "file," and the meeting/roster data renders as literal key:value editor panels rather than cards.

Approved reference: `.impeccable/mocks/decision/ide-window.html` (user-approved HTML mock, code-led build path — no image comp).

## Direction contract
THESIS: The site *is* an editor window, not a page with code-flavored decoration; navigation and content both live inside that one committed metaphor.
OWN-WORLD: Dark editor grounds (#1e1f22 / #26282b / #2b2d30), JetBrains Mono for all code/data/labels, Inter for prose headings and body, Cardinal red (#e0342e) as the single accent — active tab underline, RSVP tab/buttons, accent glyphs — everything else neutral gray-on-dark. Sidebar file tree, tab bar with dot-indicator, persistent line-number gutter, YAML/JSON-styled content panels with `.panel-label` mono captions.
STORY: Visitor lands, reads the "front-matter" (org/school/status), sees the bold headline + dek, RSVPs or reads the mission "file," checks next-meeting data block, browses project tracks as a folder listing, sees team as roster JSON.
FIRST VIEWPORT: Title bar (traffic-light dots) → tab bar with active `index.md` tab + pinned RSVP tab → sidebar file tree + gutter + editor content: YAML front-matter block, then H1/dek/CTA pair, all within the editor content column.
FORM: IDE Window, assigned via concept-seed direction roll (key 78f35164), refined through 2 user feedback rounds (rejected ledger/teletext as jumbled, rejected generic-modern as too AI-templated) before this concept was picked from a final 2-option round.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.

## Unresolved decisions
- Whether admin pages inherit any of this system (default: no — admin is documented product-register, out of scope per PRODUCT.md).
- Exact roster data plugged in comes from `src/data/team.ts` at build time, not the placeholder names in the mock.
