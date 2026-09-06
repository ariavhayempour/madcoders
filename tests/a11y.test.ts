import { describe, it, expect, vi } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { JSDOM, VirtualConsole } from 'jsdom';
import axe from 'axe-core';
import type { AxeResults, Result } from 'axe-core';

// /meetings is SSR over the events table; stub the read so the page renders without a live DB.
vi.mock('../src/db/event', () => ({ listEvents: async () => [] }));

import Index from '../src/pages/index.astro';
import Meetings from '../src/pages/meetings.astro';
import Team from '../src/pages/team.astro';
import CreateNextDigest from '../src/pages/create-next-digest.astro';
import Contact from '../src/pages/contact.astro';

// Audit gate: every page must carry no critical/serious axe violations (docs/claude/code-notes.md).
const PAGES = [
  { name: 'index', Comp: Index },
  { name: 'meetings', Comp: Meetings },
  { name: 'team', Comp: Team },
  { name: 'create-next-digest', Comp: CreateNextDigest },
  { name: 'contact', Comp: Contact },
];

const BLOCKING: ReadonlySet<string> = new Set(['critical', 'serious']);

async function audit(Comp: (typeof PAGES)[number]['Comp']): Promise<AxeResults> {
  const html = await (await AstroContainer.create()).renderToString(Comp);
  // Swallow jsdom's noisy "could not parse CSS" logging; irrelevant to the audit.
  const dom = new JSDOM(html, { runScripts: 'outside-only', virtualConsole: new VirtualConsole() });
  // Inject axe-core's trusted source into the jsdom realm and run it there (standard pattern).
  dom.window.eval(axe.source);
  return dom.window.axe.run(dom.window.document);
}

const summarize = (violations: readonly Result[]): string =>
  violations.map((v) => `${v.impact} · ${v.id} (${v.nodes.length}): ${v.help}`).join('\n');

describe('a11y — no critical/serious axe violations', () => {
  for (const { name, Comp } of PAGES) {
    it(`/${name} passes axe`, async () => {
      const { violations } = await audit(Comp);
      const blocking = violations.filter((v) => BLOCKING.has(v.impact ?? ''));
      expect(blocking, `\n${summarize(blocking)}`).toHaveLength(0);
    });
  }
});
