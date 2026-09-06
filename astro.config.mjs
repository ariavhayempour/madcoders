import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import clerk from '@clerk/astro';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// SSR on Vercel serverless — server output enables per-request rendering.
export default defineConfig({
  // `site` gives SEO components an absolute base for canonical + Open Graph URLs.
  site: 'https://www.badgerjournals.org',

  output: 'server',

  // Trusts the production host so /_image's self-fetch doesn't fall back to "localhost". See docs/claude/0015-image-allowed-domains.md
  security: {
    allowedDomains: [
      { hostname: 'www.badgerjournals.org', protocol: 'https' },
      { hostname: 'badgerjournals.org', protocol: 'https' },
    ],
  },

  // Clerk provides hosted admin auth; sign-out returns to the admin gate.
  integrations: [clerk({ afterSignOutUrl: '/admin/login' }), react()],

  adapter: vercel(),

  vite: {
    plugins: [tailwindcss()],
    // Force a single React instance so client islands don't hit "invalid hook call". See docs/claude/0016-react-dedupe.md
    resolve: { dedupe: ['react', 'react-dom'] },
  },
});