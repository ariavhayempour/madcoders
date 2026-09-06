import { fileURLToPath } from 'node:url';

// Astro 7/Vite 8 keys the module registry by resolved path, so a `vi.doMock` specifier written
// relative to the test file misses the copy the module under test imports. See docs/claude/0018-astro-7-upgrade.md
export const src = (path: string): string =>
  fileURLToPath(new URL(`../src/${path}.ts`, import.meta.url));
