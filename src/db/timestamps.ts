// Postgres date/time columns arrive as text; these keep them strings so schema.ts's `string` types hold at runtime.
// See docs/claude/timestamp-parsing.md

const TIMESTAMP_LIKE = /^\d{4}-\d{2}-\d{2}[ T]/;
const HAS_TZ = /(?:[+-]\d{2}(?::?\d{2})?|Z)$/;

// TIMESTAMP / TIMESTAMPTZ -> strict ISO-8601 UTC, so lexicographic order matches chronological order.
export function parseTimestamp(value: string): string {
  if (!TIMESTAMP_LIKE.test(value)) return value;
  // Postgres emits '+00'; ISO-8601 requires '+00:00' or 'Z', which Date would otherwise reject.
  const normalized = value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  const parsed = new Date(HAS_TZ.test(normalized) ? normalized : `${normalized}Z`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

// DATE -> the plain 'YYYY-MM-DD' string; widening it to a UTC timestamp would break string date comparisons.
export function parseDate(value: string): string {
  return value;
}
