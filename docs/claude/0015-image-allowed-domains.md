# 0015 — Fix: images 404 in production (`security.allowedDomains`)

## Symptom

Every locally-imported `<Image>` (header logo, homepage hero) rendered as a broken image on
`www.badgerjournals.org`. `GET /_image?...` returned `404 Not Found` for every request, with no
thrown exception in runtime logs.

## Root cause

Astro's built-in on-demand `/_image` endpoint (used for any `<Image>` on a page that isn't fully
prerendered — the homepage is SSR, not static) does not read the source file from disk. It
self-fetches the optimized asset over HTTP using the *incoming request's own origin*
(`new URL(transform.src, url.origin)`), then transforms the bytes it gets back.

Since Astro 5.14.2, that request origin is computed defensively: the `Host` and
`X-Forwarded-Host` headers are only trusted if they match `security.allowedDomains`
(`astro/dist/core/app/validate-headers.js`, `astro/dist/core/app/node.js`). With
`allowedDomains` left at its default `[]`, **both** headers are always rejected — not just
`X-Forwarded-Host` as the option's own doc text implies — and the adapter falls back to
`"localhost"` for the hostname (`astro/dist/core/app/node.js`, `NodeApp.createRequest`).

On Vercel, every request to an SSR route is proxied and arrives with `X-Forwarded-Host` set, so
this fallback fires on every request. The `/_image` handler then does
`fetch("https://localhost/_astro/<asset>")` from inside the serverless function — nothing is
listening there — the fetch throws, `loadRemoteImage` swallows the error and returns
`undefined`, and the endpoint responds `404`. The static assets themselves (`/_astro/*.jpg`)
were never broken; verified reachable directly (`200`) throughout.

Confirmed by re-running Astro's own `validateHost`/`validateForwardedHeaders` against the old
(`[]`) and new (populated) `security.allowedDomains` values — see commit for the exact repro.

## Fix

`astro.config.mjs` now sets:

```js
security: {
  allowedDomains: [
    { hostname: 'www.badgerjournals.org', protocol: 'https' },
    { hostname: 'badgerjournals.org', protocol: 'https' },
  ],
},
```

This lets Astro trust the real production host, so `url.origin` inside the `/_image` handler
resolves to `https://www.badgerjournals.org` instead of `localhost`, and the self-fetch reaches
a real server.

## Scope note

Only the production custom domains are allowlisted. Vercel's per-deployment preview URLs
(`badger-journals-*-ariav-hayempours-projects.vercel.app`) are still not in the list — they're
also gated behind Vercel's own Deployment Protection (SSO wall) for this project, so image
generation there was never the reported issue. If preview-URL image rendering becomes a
requirement, add a scoped hostname pattern (e.g. `*.vercel.app` is too broad — prefer a pattern
tied to this project's deployment prefix) rather than widening trust indiscriminately.
