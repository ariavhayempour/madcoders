// Hidden field name humans never see or fill, but bots that autofill every input do.
export const HONEYPOT_FIELD = 'company';

// True only when the honeypot carries meaningful text, so blank human submissions pass.
export function isBotSubmission(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const value = (body as Record<string, unknown>)[HONEYPOT_FIELD];
  return typeof value === 'string' && value.trim().length > 0;
}
