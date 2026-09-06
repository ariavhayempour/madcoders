import type { RsvpRow } from '../db/schema';

export interface MeetingGroup {
  meeting: string;
  rsvps: RsvpRow[];
}

// Pure rows → groups, ordered by recency and stable on ties; see docs/claude/0012-admin-dashboard.md
export function groupRsvpsByMeeting(rows: RsvpRow[]): MeetingGroup[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const groups: MeetingGroup[] = [];
  const byMeeting = new Map<string, MeetingGroup>();
  for (const rsvp of sorted) {
    let group = byMeeting.get(rsvp.meeting);
    if (!group) {
      group = { meeting: rsvp.meeting, rsvps: [] };
      byMeeting.set(rsvp.meeting, group);
      groups.push(group);
    }
    group.rsvps.push(rsvp);
  }
  return groups;
}
