# 0016 — React dedupe for client islands

## Symptom

Every `client:load` React island (e.g. `DeleteEventButton`, `AdminNav`, `MobileNav`)
failed to hydrate in dev with:

```
Invalid hook call. Hooks can only be called inside of the body of a function component.
... You might have more than one copy of React in the same app
Uncaught TypeError: Cannot read properties of null (reading 'useContext')
```

Visible effect: the admin "Delete event" confirmation dialog never opened — the
trigger rendered but its click handler was never attached because the island
threw during hydration.

## Cause

Only one React (`react@19.2.8`) is installed, but Vite was resolving two
*instances* of it across the island's dependency graph (`@base-ui/react`,
`lucide-react`, `@floating-ui/react-dom`, the app itself). Two React instances
means two dispatchers, so hooks resolve against a `null` dispatcher.

A wedged, duplicated dev-server state (multiple `astro dev` processes sharing one
`node_modules/.vite` cache) initially masked this as `504 (Outdated Optimize Dep)`.

## Fix

Force a single copy in `astro.config.mjs`:

```js
vite: {
  resolve: { dedupe: ['react', 'react-dom'] },
}
```

## Notes

- Run a single `astro dev` at a time; multiple servers stomp the shared
  `node_modules/.vite` optimize cache and surface as `504 Outdated Optimize Dep`.
- The Vercel adapter does not support `astro preview`; verify islands in `pnpm dev`.
