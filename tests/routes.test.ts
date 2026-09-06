import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Team from '../src/pages/team.astro';
import CreateNextDigest from '../src/pages/create-next-digest.astro';
import Contact from '../src/pages/contact.astro';

// /meetings is now SSR, so it moved out of this fully-static set (docs/claude/0013-events-admin.md).
const STATIC_PAGES = [
  { name: 'team', Comp: Team, title: 'Our Team · Badger Journals', ogTitle: 'Our Team', h1: 'Built by Badgers.' },
  { name: 'create-next-digest', Comp: CreateNextDigest, title: 'Create the Next Digest · Badger Journals', ogTitle: 'Create the Next Digest', h1: 'Create the next digest.' },
  { name: 'contact', Comp: Contact, title: 'Contact Us · Badger Journals', ogTitle: 'Contact Us', h1: 'Get in touch.' },
];

async function render(Comp: (typeof STATIC_PAGES)[number]['Comp']): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(Comp);
}

describe('static route rendering', () => {
  for (const page of STATIC_PAGES) {
    it(`/${page.name} renders its own title, meta, and heading`, async () => {
      const html = await render(page.Comp);
      expect(html).toContain(`<title>${page.title}</title>`);
      expect(html).toContain(`property="og:title" content="${page.ogTitle}"`);
      const h1 = page.h1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(html).toMatch(new RegExp(`>\\s*${h1}\\s*</h1>`)); // heading text (whitespace-tolerant)

    });
  }

  it('gives every page a distinct title', async () => {
    const titles = await Promise.all(
      STATIC_PAGES.map(async (p) => {
        const html = await render(p.Comp);
        return /<title>([^<]*)<\/title>/.exec(html)?.[1];
      }),
    );
    expect(new Set(titles).size).toBe(STATIC_PAGES.length);
  });
});

describe('contact page inquiry form', () => {
  it('renders contact page with an inquiry form posting to /api/inquiry', async () => {
    const html = await render(Contact);
    expect(html).toContain('Get in touch');
    expect(html).toContain('Send us a message');
    expect(html).toMatch(/<form[^>]*action="\/api\/inquiry"/);
  });
});

describe('team + create-next-digest contact links', () => {
  it('team page links to contact form with type=join', async () => {
    const html = await render(Team);
    expect(html).toMatch(/href="\/contact\?type=join"/);
  });

  it('create-next-digest page links to contact form with type=digest', async () => {
    const html = await render(CreateNextDigest);
    expect(html).toMatch(/href="\/contact\?type=digest"/);
  });
});
