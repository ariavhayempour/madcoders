# Badger Journals — User Stories

Epic: **Re-platform Badger Journals to Astro + Vercel with RSVP and admin inbox backend.**

Rebuild the club's legacy single-file `index.html` as a componentized Astro (SSR via Vercel adapter) + React-islands app with a full UW-Madison brand redesign, real per-page URLs, a Postgres-backed RSVP + submission store, and an authenticated admin dashboard.

## Stories

| # | Story | Points | Confidence | Depends on |
|---|-------|--------|-----------|-----------|
| [0001](0001.md) | Scaffold Astro + Vercel foundation | 3 | High | — |
| [0002](0002.md) | Componentized pages with real per-page URLs | 5 | Med | 0001 |
| [0003](0003.md) | UW-Madison brand redesign | 5 | Med | 0001, 0002 |
| [0004](0004.md) | Optimize + self-host imagery | 3 | Med | 0002 |
| [0005](0005.md) | Accessibility + responsive standards | 5 | Med | 0002, 0003 |
| [0006](0006.md) | Provision Postgres + submission data store | 3 | Med | 0001 |
| [0007](0007.md) | Meetings calendar from repo data | 3 | Med | 0002 |
| [0008](0008.md) | RSVP to a meeting | 5 | Med | 0006, 0007 |
| [0009](0009.md) | Unified inquiry / join / start-a-digest flow | 5 | Med | 0006 |
| [0010](0010.md) | Spam + abuse protection on submission endpoints | 5 | Med | 0008, 0009 |
| [0011](0011.md) | Admin authentication | 5 | **Low** | 0001 |
| [0012](0012.md) | Admin dashboard (RSVPs + inquiry inbox) | 3 | Med | 0006, 0008, 0009, 0011 |
| [0013](0013.md) | Manage calendar events from the admin dashboard | 8 | Med | 0006, 0007, 0011 |

**Total ≈ 58 points.** 0013 reached the 8-point mandatory-decomposition threshold; a two-story split (data/public backing vs. admin CRUD UI) was identified but the story was kept as one unit by request.

## Risk hotspot

- **0011 (Admin auth)** — LOW confidence: mechanism is undecided and security-critical. Run a time-boxed spike (hosted provider vs custom session) before locking its estimate; it can escalate to 8 if custom sessions are chosen.

## Open decisions to close early

- Postgres provider: Vercel Postgres vs Neon (story 0006)
- Rate-limit backing store: e.g. Vercel KV / Upstash (story 0010)
- Admin auth mechanism + admin count (story 0011)
- wisc.edu email: format/domain validation only, or ownership verification via confirmation email? (stories 0008, 0009)
- Typography: carry the serif identity (Playfair Display / Cormorant Garamond / Libre Baskerville) or modernize? (story 0003)
- Meetings view: chronological list vs full month-grid widget (story 0007)
