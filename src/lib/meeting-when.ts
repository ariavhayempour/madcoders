// Pure date-only labeling for a meeting's RSVP-panel header pill; callers pass `todayIso` so this stays deterministic.

export type MeetingWhenBucket = 'upcoming' | 'past';

export interface MeetingWhen {
  bucket: MeetingWhenBucket;
  label: string;
}

const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.UTC(...parseIso(fromIso));
  const to = Date.UTC(...parseIso(toIso));
  return Math.round((to - from) / 86_400_000);
}

function parseIso(iso: string): [number, number, number] {
  const [year, month, day] = iso.split('-').map(Number);
  return [year, month - 1, day];
}

export function describeMeetingWhen(dateIso: string, todayIso: string): MeetingWhen {
  const bucket: MeetingWhenBucket = dateIso >= todayIso ? 'upcoming' : 'past';
  const shortDate = SHORT_DATE.format(new Date(Date.UTC(...parseIso(dateIso))));

  if (dateIso === todayIso) return { bucket, label: `Today · ${shortDate}` };
  if (bucket === 'past') return { bucket, label: `Past · ${shortDate}` };
  if (daysBetween(todayIso, dateIso) === 1) return { bucket, label: `Tomorrow · ${shortDate}` };
  return { bucket, label: shortDate };
}
