import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import SEO from '../src/components/SEO.astro';
import Header from '../src/components/Header.astro';
import Footer from '../src/components/Footer.astro';
import BaseLayout from '../src/layouts/BaseLayout.astro';

describe('SEO.astro', () => {
  it('emits a page-specific title suffixed with the site name', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SEO, {
      props: { title: 'Mission', description: 'Why Badger Journals exists.', path: '/mission' },
    });
    expect(html).toContain('<title>Mission · Badger Journals</title>');
  });

  it('emits description and Open Graph tags from props', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SEO, {
      props: { title: 'Mission', description: 'Why Badger Journals exists.', path: '/mission' },
    });
    expect(html).toContain('name="description" content="Why Badger Journals exists."');
    expect(html).toContain('property="og:title" content="Mission"');
    expect(html).toContain('property="og:description" content="Why Badger Journals exists."');
  });

  it('builds an absolute canonical URL that includes the page path', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SEO, {
      props: { title: 'Mission', description: 'Why Badger Journals exists.', path: '/mission' },
    });
    expect(html).toMatch(/rel="canonical" href="https?:\/\/[^"]+\/mission"/);
    expect(html).toMatch(/property="og:url" content="https?:\/\/[^"]+\/mission"/);
  });
});

describe('Header.astro', () => {
  it('links to every top-level route with real hrefs', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Header);
    for (const href of ['/', '/meetings', '/create-next-digest', '/contact']) {
      expect(html).toContain(`href="${href}"`);
    }
  });
});

describe('Footer.astro', () => {
  it('shows the club address and social links', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Footer);
    expect(html).toContain('Madison, WI, 53706');
    expect(html).toContain('https://www.instagram.com/badgerjournals/');
    expect(html).toContain('https://www.linkedin.com/company/badger-journals/home/');
  });
});

describe('BaseLayout.astro', () => {
  it('wraps slotted content in an html shell with SEO, header, and footer', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(BaseLayout, {
      props: { title: 'Mission', description: 'Why Badger Journals exists.', path: '/mission' },
      slots: { default: '<p>slot content here</p>' },
    });
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('<title>Mission · Badger Journals</title>');
    expect(html).toContain('href="/meetings"'); // header nav present
    expect(html).toContain('Madison, WI, 53706'); // footer present
    expect(html).toContain('<p>slot content here</p>'); // slotted page content
  });
});
