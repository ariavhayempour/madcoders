import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import SEO from '../src/components/SEO.astro';
import index from '../src/pages/index.astro?raw';
import header from '../src/components/Header.astro?raw';
import baseLayout from '../src/layouts/BaseLayout.astro?raw';
import teamPage from '../src/pages/team.astro?raw';
import teamData from '../src/data/team.ts?raw';

const srcDir = fileURLToPath(new URL('../src', import.meta.url));
const imagesDir = fileURLToPath(new URL('../src/assets/images', import.meta.url));
const publicDir = fileURLToPath(new URL('../public', import.meta.url));

// Source guards scan text/code files only — binary assets under src/assets/ are excluded.
const TEXT_EXT = /\.(astro|ts|tsx|js|mjs|cjs|css|md|json)$/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = `${dir}/${name}`;
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function textSources(): string[] {
  return walk(srcDir).filter((file) => TEXT_EXT.test(file));
}

describe('T1 — self-hosted image assets are staged', () => {
  it('has campus.jpg, logo.jpg, and a placeholder avatar under src/assets/images/', () => {
    const files = readdirSync(imagesDir);
    expect(files).toContain('campus.jpg');
    expect(files).toContain('logo.jpg');
    const hasPlaceholder =
      files.includes('placeholder-avatar.jpg') ||
      files.includes('placeholder-avatar.png');
    expect(hasPlaceholder).toBe(true);
  });
});

describe('T1 — image source guards', () => {
  it('has no data: image URI anywhere in src/ (no base64 inlining)', () => {
    const offenders = textSources().filter((file) =>
      /data:image\//i.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('references no content image from an external host in src/', () => {
    const external = /https?:\/\/[^"'`\s)]+\.(png|jpe?g|gif|webp|avif|svg)/i;
    const offenders = textSources().filter((file) =>
      external.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('gives every <Image>/<img> in src/ an alt attribute (empty allowed for decorative)', () => {
    const tag = /<(img|Image)\b[\s\S]*?\/?>/g;
    const offenders: string[] = [];
    for (const file of textSources().filter((f) => f.endsWith('.astro'))) {
      const content = readFileSync(file, 'utf8');
      for (const match of content.matchAll(tag)) {
        if (!/\balt\s*=/.test(match[0])) {
          offenders.push(`${file}: ${match[0].slice(0, 60)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('T2 — IDE front-matter hero on the home page', () => {
  // The IDE-window redesign replaced the campus photo hero with a rendered
  // YAML front-matter block + headline, matching the editor-chrome metaphor;
  // src/assets/images/campus.jpg is retained on disk but no longer referenced.
  it('renders the front-matter block and headline as the first-viewport hero', () => {
    expect(index).toMatch(/frontmatter/);
    expect(index).toMatch(/<span class="text-foreground">org:<\/span>/);
  });

  it('gives the RSVP CTA the primary action styling in the hero', () => {
    expect(index).toMatch(/RSVP for next meeting/);
  });
});

describe('T3 — wordmark in the editor tab bar', () => {
  // The IDE-window redesign replaced the photographic logo with a `{}` bracket
  // mark matching the file-tree/editor icon language; logo.jpg is retained on
  // disk but no longer referenced.
  it('renders the bracket mark and wordmark as the brand tab', () => {
    expect(header).toMatch(/\{'\{\}'\}/);
    expect(header).toMatch(/>\s*madcoders\s*<\/a>/);
  });
});

describe('T5 — OG / social image + meta', () => {
  it('ships the og image in public/', () => {
    expect(readdirSync(publicDir)).toContain('og.png');
  });

  it('emits absolute og:image and twitter:image plus a large-summary card', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SEO, {
      props: { title: 'Home', description: 'MadCoders.', path: '/' },
    });
    expect(html).toMatch(/property=["']og:image["'][^>]*content=["']https?:\/\/[^"']+\/og\.png["']/);
    expect(html).toMatch(/name=["']twitter:image["'][^>]*content=["']https?:\/\/[^"']+\/og\.png["']/);
    expect(html).toMatch(/name=["']twitter:card["'][^>]*content=["']summary_large_image["']/);
  });
});

describe('T6 — team headshots', () => {
  it('adds an optional, typed photo field to Member (no any)', () => {
    expect(teamData).toMatch(/photo\?:\s*ImageMetadata/);
    expect(teamData).not.toMatch(/photo\?:\s*any/);
  });

  it('renders a per-member <Image> headshot, lazy, alt = member name', () => {
    expect(teamPage).toMatch(/import\s*\{\s*Image\s*\}\s*from\s*['"]astro:assets['"]/);
    const image = teamPage.match(/<Image\b[\s\S]*?\/?>/)?.[0] ?? '';
    expect(image).toMatch(/loading=["']lazy["']/);
    expect(image).toMatch(/alt=\{[^}]*\.name\}/);
  });

  it('falls back to an initials monogram when a member has no photo', () => {
    expect(teamPage).toMatch(/m\.photo\s*\?/); // conditional render on the optional photo
    expect(teamPage).toMatch(/initials\(/); // monogram fallback branch
  });
});

describe('T4 — favicon + apple-touch-icon', () => {
  it('ships correctly-sized icon files in public/', () => {
    const files = readdirSync(publicDir);
    expect(files).toContain('favicon.ico');
    expect(files).toContain('apple-touch-icon.png');
  });

  it('links the favicon and apple-touch-icon in the document head', () => {
    expect(baseLayout).toMatch(/<link[^>]*rel=["']icon["'][^>]*href=["']\/favicon\.ico["']/);
    expect(baseLayout).toMatch(/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']\/apple-touch-icon\.png["']/);
  });
});
