import { describe, it, expect, vi } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';

// /meetings is SSR over the events table; stub the read so the page renders without a live DB.
vi.mock('../src/db/event', () => ({ listEvents: async () => [] }));

import Index from '../src/pages/index.astro';
import Meetings from '../src/pages/meetings.astro';
import Team from '../src/pages/team.astro';
import CreateNextDigest from '../src/pages/create-next-digest.astro';
import Contact from '../src/pages/contact.astro';

// Accessibility gate: one <h1> per page and no skipped heading levels (docs/claude/code-notes.md).
const PAGES = [
  { name: 'index', Comp: Index },
  { name: 'meetings', Comp: Meetings },
  { name: 'team', Comp: Team },
  { name: 'create-next-digest', Comp: CreateNextDigest },
  { name: 'contact', Comp: Contact },
];

async function levels(Comp: (typeof PAGES)[number]['Comp']): Promise<number[]> {
  const html = await (await AstroContainer.create()).renderToString(Comp);
  return [...html.matchAll(/<h([1-6])(?=[\s/>])/gi)].map((m) => Number(m[1]));
}

describe('headings — correct hierarchy on every page', () => {
  for (const { name, Comp } of PAGES) {
    it(`/${name} has exactly one h1 and no skipped levels`, async () => {
      const seq = await levels(Comp);
      expect(seq.filter((l) => l === 1)).toHaveLength(1);
      expect(seq[0]).toBe(1);
      for (let i = 1; i < seq.length; i++) {
        // A heading may stay, go shallower, or go one level deeper — never skip a level.
        expect(seq[i] - seq[i - 1], `${name}: ${seq.join(',')}`).toBeLessThanOrEqual(1);
      }
    });
  }
});
