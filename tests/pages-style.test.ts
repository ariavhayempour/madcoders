import { describe, it, expect } from 'vitest';
import team from '../src/pages/team.astro?raw';
import createNextDigest from '../src/pages/create-next-digest.astro?raw';

// The bespoke lists (team roster, research areas) lay out as responsive grids via Tailwind utilities.
const STYLED = [
  { name: 'team', src: team },
  { name: 'create-next-digest', src: createNextDigest },
];

describe('per-page editorial layout', () => {
  for (const page of STYLED) {
    it(`${page.name} lays its bespoke list out as a responsive auto-fill grid`, () => {
      expect(page.src).toMatch(/grid-template-columns:repeat\(auto-fill,minmax/);
    });

    it(`${page.name} styles via design tokens, not raw hex`, () => {
      expect(page.src).not.toMatch(/#[0-9a-f]{3,6}/i);
    });
  }
});
