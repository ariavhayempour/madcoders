import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Assert WCAG 2.1 AA (4.5:1) from the OKLCH token values in global.css — axe's contrast rule can't run under jsdom (docs/claude/code-notes.md).
const css = readFileSync(fileURLToPath(new URL('../src/styles/global.css', import.meta.url)), 'utf8');
const AA_NORMAL = 4.5;

function oklch(token: string): [number, number, number] {
  const m = new RegExp(`--${token}:\\s*oklch\\(\\s*([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)`).exec(css);
  if (!m) throw new Error(`token --${token} not found as an oklch() literal in global.css`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

// OKLCH → linear sRGB (Björn Ottosson's OKLab matrices); WCAG luminance uses linear channels directly.
function luminance([L, C, H]: [number, number, number]): number {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(bl);
}

function ratio(fg: string, bg: string): number {
  const [hi, lo] = [luminance(oklch(fg)), luminance(oklch(bg))].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

// Foreground text over background, as painted across the pages, chrome, and admin badges.
const PAIRS = [
  { label: 'body ink on paper', fg: 'foreground', bg: 'background' },
  { label: 'muted body on paper', fg: 'muted-foreground', bg: 'background' },
  { label: 'muted body on cream/muted surface', fg: 'muted-foreground', bg: 'muted' },
  { label: 'primary (Cardinal) link on paper', fg: 'primary', bg: 'background' },
  { label: 'white label on primary button', fg: 'primary-foreground', bg: 'primary' },
  { label: 'cardinal-700 on paper', fg: 'cardinal-700', bg: 'background' },
  { label: 'digest badge text on cardinal tint', fg: 'cardinal-700', bg: 'cardinal-tint' },
  { label: 'confirmed badge text on success tint', fg: 'success', bg: 'success-tint' },
  { label: 'join badge text on info tint', fg: 'info', bg: 'info-tint' },
  { label: 'warn badge text on warn tint', fg: 'warn', bg: 'warn-tint' },
];

describe('contrast — OKLCH token pairs meet WCAG AA (4.5:1)', () => {
  for (const { label, fg, bg } of PAIRS) {
    it(`${label} ≥ ${AA_NORMAL}:1`, () => {
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  }
});
