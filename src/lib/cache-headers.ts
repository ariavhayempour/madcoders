// Shared Cache-Control for SSR pages reading live DB data: edge caches briefly, then revalidates.
export const REVALIDATE_CACHE_CONTROL = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';
