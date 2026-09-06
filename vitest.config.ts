/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// Wire Vitest through Astro's Vite config so tests share Astro's resolution.
export default getViteConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
