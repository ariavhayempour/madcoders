import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import BaseLayout from '../src/layouts/BaseLayout.astro';
import Header from '../src/components/Header.astro';
import Footer from '../src/components/Footer.astro';
import layout from '../src/layouts/BaseLayout.astro?raw';

const srcDir = fileURLToPath(new URL('../src', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = `${dir}/${name}`;
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe('legacy color regression guard', () => {
  // The retired crimson (#8b1a1a) and the `crimson` keyword must never reappear.
  it('has no #8b1a1a or crimson keyword anywhere under src/', () => {
    const offenders = walk(srcDir).filter((file) => {
      const content = readFileSync(file, 'utf8').toLowerCase();
      return content.includes('8b1a1a') || /\bcrimson\b/.test(content);
    });
    expect(offenders).toEqual([]);
  });
});

describe('BaseLayout wires the branded system', () => {
  it('imports the global Tailwind base and the self-hosted Geist fonts (admin keeps Spectral)', () => {
    expect(layout).toMatch(/styles\/global\.css/);
    expect(layout).toMatch(/@fontsource-variable\/geist['"]/);
    expect(layout).toMatch(/@fontsource-variable\/geist-mono/);
    expect(layout).toMatch(/@fontsource\/spectral/);
  });

  it('renders the branded header and footer chrome on every page', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(BaseLayout, {
      props: { title: 'Home', description: 'MadCoders.', path: '/' },
      slots: { default: '<p>page body</p>' },
    });
    expect(html).toContain('madcoders'); // tab bar wordmark
    expect(html).toContain('Madison, WI, 53706'); // footer
    expect(html).toContain('<p>page body</p>'); // slotted content
  });
});

describe('Header/Footer render their branded structure', () => {
  it('Header renders the wordmark in the editor tab bar', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Header);
    expect(html).toMatch(/font-mono[^"]*"[^>]*>\s*madcoders/);
  });

  it('Footer renders the wordmark and connect links', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Footer);
    expect(html).toContain('madcoders');
    expect(html).toContain('// connect');
  });
});
