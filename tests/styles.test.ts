import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Read stylesheet sources from disk — Vite resolves `*.css?raw` to an empty module (docs/claude/code-notes.md).
import layout from '../src/layouts/BaseLayout.astro?raw';

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const global = read('../src/styles/global.css');

describe('global.css — Tailwind entry + brand theme', () => {
  it('imports Tailwind and defines the shadcn token surface', () => {
    expect(global).toMatch(/@import\s+["']tailwindcss["']/);
    for (const name of ['--background', '--foreground', '--primary', '--muted-foreground', '--border']) {
      expect(global).toContain(name);
    }
  });

  it('sets the primary/brand and ring to the Cardinal hue in OKLCH', () => {
    // UW Cardinal ≈ oklch(0.514 0.211 28); assert the primary + ring resolve to that ramp.
    expect(global).toMatch(/--primary:\s*oklch\(0\.51[0-9]?\s+0\.2[0-9]+\s+2[0-9]/);
    expect(global).toMatch(/--cardinal:\s*oklch\(/);
  });

  it('wires the Spectral + Hanken Grotesk font tokens', () => {
    expect(global).toMatch(/--font-serif:\s*["']Spectral["']/);
    expect(global).toMatch(/--font-sans:\s*["']Hanken Grotesk Variable["']/);
  });

  it('makes no external font requests in the styling layer', () => {
    for (const src of [layout, global]) {
      expect(src).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    }
  });

  it('never reintroduces the legacy crimson', () => {
    expect(global.toLowerCase()).not.toContain('#8b1a1a');
    expect(global.toLowerCase()).not.toContain('crimson');
  });
});

describe('BaseLayout wires the styling layer once', () => {
  it('imports the global (Tailwind) stylesheet', () => {
    expect(layout).toMatch(/import\s+['"][^'"]*styles\/global\.css['"]/);
  });

  it('self-hosts Spectral (serif) and Hanken Grotesk (sans) via @fontsource', () => {
    expect(layout).toMatch(/@fontsource\/spectral\/latin-700\.css/);
    expect(layout).toMatch(/@fontsource\/spectral\/latin-600-italic\.css/);
    expect(layout).toMatch(/@fontsource-variable\/hanken-grotesk/);
  });

  it('no longer ships the retired Playfair/Inter families', () => {
    expect(layout).not.toMatch(/@fontsource\/playfair-display/);
    expect(layout).not.toMatch(/@fontsource\/inter/);
  });
});
