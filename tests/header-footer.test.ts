import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import HeaderCmp from '../src/components/Header.astro';
import FooterCmp from '../src/components/Footer.astro';
import header from '../src/components/Header.astro?raw';
import footer from '../src/components/Footer.astro?raw';

describe('branded Header (Tailwind + tokens)', () => {
  it('sets the wordmark in the serif display family', () => {
    expect(header).toMatch(/font-serif/);
  });

  it('applies a Cardinal (primary) brand accent', () => {
    expect(header).toMatch(/\b(text-primary|bg-primary)\b/);
  });

  it('styles via design tokens, not raw hex', () => {
    expect(header).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it('renders the wordmark and the primary nav', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(HeaderCmp);
    expect(html).toContain('Badger Journals');
    for (const href of ['/', '/meetings', '/create-next-digest', '/contact']) {
      expect(html).toContain(`href="${href}"`);
    }
  });
});

describe('branded Footer (Tailwind + tokens)', () => {
  it('uses no raw hex colors', () => {
    expect(footer).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it('renders the wordmark and social links', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(FooterCmp);
    expect(html).toContain('Badger Journals');
    expect(html).toContain('https://www.instagram.com/badgerjournals/');
    expect(html).toContain('https://www.linkedin.com/company/badger-journals/home/');
  });

  it('carries the Team link (moved out of the primary nav) and the admin link', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(FooterCmp);
    expect(html).toMatch(/href="\/team"/);
    expect(html).toMatch(/<a[^>]*href="\/admin"[^>]*>[^<]*Admin/);
  });
});
