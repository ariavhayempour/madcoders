import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import HeaderCmp from '../src/components/Header.astro';
import FooterCmp from '../src/components/Footer.astro';
import header from '../src/components/Header.astro?raw';
import footer from '../src/components/Footer.astro?raw';

describe('branded Header (Tailwind + tokens)', () => {
  it('sets the wordmark in the editor tab-bar mono family', () => {
    expect(header).toMatch(/font-mono/);
  });

  it('applies a Cardinal (primary) brand accent', () => {
    expect(header).toMatch(/\bbg-cardinal\b/);
  });

  it('styles via design tokens, with only the fixed macOS traffic-light hex as a literal-convention exception', () => {
    const withoutTrafficLights = header.replace(/#ff5f57|#febc2e|#28c840/gi, '');
    expect(withoutTrafficLights).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it('renders the wordmark and the primary tab-bar nav', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(HeaderCmp);
    expect(html).toContain('madcoders');
    // Primary tabs mirror the file tree (index/meetings/team/contact); digest creation
    // is reachable from the homepage's project list, not the top-level tab bar.
    for (const href of ['/', '/meetings', '/team', '/contact']) {
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
    expect(html).toContain('madcoders');
    expect(html).toContain('https://www.instagram.com/madcodersuw/');
  });

  it('carries the Team link (moved out of the primary nav) and the admin link', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(FooterCmp);
    expect(html).toMatch(/href="\/team"/);
    expect(html).toMatch(/<a[^>]*href="\/admin"[^>]*>[^<]*admin portal/i);
  });
});
