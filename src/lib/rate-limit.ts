// Pure fixed-window rate-limit policy (no node:*/DB imports); the clock is injected so buckets stay deterministic and unit-testable.

export const WINDOW_MS = 60_000;
export const MAX_HITS = 5;

// Floor the instant to the start of its fixed window.
export function windowStart(nowMs: number): number {
  return Math.floor(nowMs / WINDOW_MS) * WINDOW_MS;
}

// One counter per endpoint + client + window.
export function bucketKey(endpoint: string, ip: string, nowMs: number): string {
  return `${endpoint}:${ip}:${windowStart(nowMs)}`;
}

// MAX_HITS requests are allowed per window; the next one is over.
export function isOverLimit(count: number): boolean {
  return count > MAX_HITS;
}

// The inquiry endpoint uses a rolling gap instead of a fixed window, so submissions can't burst across a boundary.
export const INQUIRY_MIN_GAP_MS = 180_000;

// A null lastHitMs means no prior submission, so nothing to wait for.
export function isWithinGap(lastHitMs: number | null, nowMs: number, gapMs: number): boolean {
  return lastHitMs !== null && nowMs - lastHitMs < gapMs;
}

// Remaining wait in whole seconds, rounded up so callers never advise retrying early; 0 once the gap has elapsed.
export function retryAfterSeconds(lastHitMs: number | null, nowMs: number, gapMs: number): number {
  if (lastHitMs === null) return 0;
  return Math.max(0, Math.ceil((lastHitMs + gapMs - nowMs) / 1000));
}
