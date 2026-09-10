import { describe, it, expect } from 'vitest';
import team from '../src/pages/team.astro?raw';
import createNextDigest from '../src/pages/create-next-digest.astro?raw';

// Every bespoke list styles via design tokens; only the digest still lays out as a card grid —
// the team roster renders as an editor-style JSON buffer instead (docs/claude/0003-brand-redesign.md).
const STYLED = [
  { name: 'team', src: team },
  { name: 'create-next-digest', src: createNextDigest },
];

const GRID_LISTS = [{ name: 'create-next-digest', src: createNextDigest }];

describe('per-page editorial layout', () => {
  for (const page of GRID_LISTS) {
    it(`${page.name} lays its bespoke list out as a responsive auto-fill grid`, () => {
      expect(page.src).toMatch(/grid-template-columns:repeat\(auto-fill,minmax/);
    });
  }

  it('team renders its roster as a syntax-coloured JSON buffer, not a card grid', () => {
    expect(team).not.toMatch(/grid-template-columns:repeat\(auto-fill,minmax/);
    expect(team).toMatch(/text-syn-key/);
    expect(team).toMatch(/text-syn-str/);
  });

  for (const page of STYLED) {
    it(`${page.name} styles via design tokens, not raw hex`, () => {
      expect(page.src).not.toMatch(/#[0-9a-f]{3,6}/i);
    });
  }
});
