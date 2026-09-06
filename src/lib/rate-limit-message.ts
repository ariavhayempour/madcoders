const GENERIC = "You're sending these too quickly. Please try again shortly — your message has been kept.";

// Turns the server's retryAfterSeconds into user-facing copy; falls back to generic text when the value is absent or nonsensical.
export function rateLimitMessage(retryAfterSeconds: number | undefined): string {
  if (typeof retryAfterSeconds !== 'number' || !Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) {
    return GENERIC;
  }

  // Round up so we never invite a retry that would still be blocked.
  const minutes = Math.ceil(retryAfterSeconds / 60);
  const unit = minutes === 1 ? 'minute' : 'minutes';
  return `You're sending these too quickly. Please wait about ${minutes} more ${unit} before sending another message — your message has been kept.`;
}
