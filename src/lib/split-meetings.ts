// Pure split/ordering for the meetings view. Browser-safe: no node:* or DB imports.

export interface MeetingView {
  id: string; // slug identity; also the RSVP key
  date: string; // ISO YYYY-MM-DD; sorts lexicographically
  title?: string;
  time?: string;
  location?: string;
}

export interface SplitMeetings {
  upcoming: MeetingView[];
  past: MeetingView[];
}

// Upcoming (>= today) ascending, past (< today) descending — ISO dates compare lexicographically.
export function splitMeetings(all: MeetingView[], todayISO: string): SplitMeetings {
  const byDateAsc = (a: MeetingView, b: MeetingView): number => a.date.localeCompare(b.date);
  const upcoming = all.filter((m) => m.date >= todayISO).sort(byDateAsc);
  const past = all
    .filter((m) => m.date < todayISO)
    .sort(byDateAsc)
    .reverse();
  return { upcoming, past };
}
