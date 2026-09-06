import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Reflow guard: static heuristic over every stylesheet + scoped <style> block, catching fixed widths that force horizontal scroll (docs/claude/code-notes.md).
const VIEWPORT = 320; // narrowest supported width, in px
const MAIN_PADDING = 48; // main's 1.5rem (var(--space-6)) inline padding, both sides
const CONTENT_BUDGET = VIEWPORT - MAIN_PADDING; // px available to content at 320

const srcDir = fileURLToPath(new URL('../src', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = `${dir}/${name}`;
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function stylesheets(): { file: string; css: string }[] {
  return walk(srcDir)
    .filter((f) => f.endsWith('.css') || f.endsWith('.astro'))
    .map((file) => {
      const raw = readFileSync(file, 'utf8');
      const css = file.endsWith('.css')
        ? raw
        : [...raw.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
      return { file, css };
    })
    .filter(({ css }) => css.trim().length > 0);
}

const toPx = (value: string, unit: string): number => Number(value) * (unit === 'rem' ? 16 : 1);

const SHEETS = stylesheets();

describe('reflow — no fixed widths force horizontal scroll at 320px', () => {
  it('no width / min-width is wider than the viewport', () => {
    const offenders: string[] = [];
    for (const { file, css } of SHEETS) {
      // Leading (?<![-\w]) skips `max-width` and keeps `width` / `min-width`.
      for (const m of css.matchAll(/(?<![-\w])(min-width|width)\s*:\s*([\d.]+)(px|rem)/gi)) {
        if (toPx(m[2], m[3]) > VIEWPORT) offenders.push(`${file}: ${m[0]}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('every grid minmax() column min fits the mobile content budget', () => {
    const offenders: string[] = [];
    for (const { file, css } of SHEETS) {
      for (const m of css.matchAll(/minmax\(\s*([\d.]+)(px|rem)/gi)) {
        if (toPx(m[1], m[2]) > CONTENT_BUDGET) offenders.push(`${file}: ${m[0]} > ${CONTENT_BUDGET}px`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('no white-space: nowrap on content (would prevent wrapping)', () => {
    const offenders = SHEETS.filter(({ css }) => /white-space\s*:\s*nowrap/i.test(css)).map((s) => s.file);
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
