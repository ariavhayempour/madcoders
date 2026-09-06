import { isBotSubmission } from './honeypot';
import {
  WINDOW_MS,
  windowStart,
  bucketKey,
  isOverLimit,
  INQUIRY_MIN_GAP_MS,
  isWithinGap,
  retryAfterSeconds,
} from './rate-limit';
import { emailBucketKey } from './inquiry-identity';
import { hitRateLimit, touchRateLimit } from '../db/rate-limit';

// Context each route hands the guard.
export interface AbuseContext {
  body: unknown;
  endpoint: string;
  clientAddress?: string;
}

// Fallback key when the runtime can't supply a client IP, so the limiter still functions.
const SENTINEL_IP = 'unknown';

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Returns a short-circuit Response when a request should be blocked, else null to continue.
export async function checkAbuse({ body, endpoint, clientAddress }: AbuseContext): Promise<Response | null> {
  // Honeypot first so bot noise never burns a rate-limit slot; silent-accept returns the normal success shape without writing a row.
  if (isBotSubmission(body)) return json({ ok: true }, 201);

  try {
    const ip = clientAddress ?? SENTINEL_IP;
    return endpoint === 'inquiry'
      ? await checkInquiryGap(body, ip)
      : await checkFixedWindow(endpoint, ip);
  } catch {
    // Fail open: a limiter outage must never block legitimate submissions.
    return null;
  }
}

// Inquiries allow one submission per rolling gap, keyed on IP and email so neither rotation nor a shared NAT defeats it.
async function checkInquiryGap(body: unknown, ip: string): Promise<Response | null> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresAt = new Date(now + INQUIRY_MIN_GAP_MS).toISOString();

  // A malformed email yields no bucket, leaving IP-only throttling rather than an error.
  const keys = [`inquiry:ip:${ip}`, emailBucketKey(body)].filter((key): key is string => key !== null);

  // Every bucket is touched even once one trips, so a blocked bot keeps extending its own lockout.
  const previous = await Promise.all(keys.map((key) => touchRateLimit(key, nowIso, expiresAt)));

  const waits = previous
    .map((prev) => (prev === null ? null : Date.parse(prev)))
    .filter((ms): ms is number => ms !== null && Number.isFinite(ms))
    .filter((ms) => isWithinGap(ms, now, INQUIRY_MIN_GAP_MS))
    .map((ms) => retryAfterSeconds(ms, now, INQUIRY_MIN_GAP_MS));

  if (waits.length === 0) return null;
  return json({ ok: false, code: 'rate_limited', retryAfterSeconds: Math.max(...waits) }, 429);
}

// Other endpoints keep the fixed-window counter: several submissions per window are legitimate.
async function checkFixedWindow(endpoint: string, ip: string): Promise<Response | null> {
  const now = Date.now();
  const start = windowStart(now);
  const key = bucketKey(endpoint, ip, now);
  const count = await hitRateLimit(
    key,
    new Date(start).toISOString(),
    new Date(start + WINDOW_MS).toISOString(),
  );
  if (isOverLimit(count)) return json({ ok: false, code: 'rate_limited' }, 429);
  return null;
}
