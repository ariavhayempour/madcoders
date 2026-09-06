import { createHash } from 'node:crypto';

// Bucket keys are hashed so a submitted email never lands in the rate-limit table as plain text.
export function emailBucketKey(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const value = (body as Record<string, unknown>).email;
  if (typeof value !== 'string') return null;

  // Case and padding are normalized away so one submitter can't split their own bucket.
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return null;

  return `inquiry:email:${createHash('sha256').update(normalized).digest('hex')}`;
}
