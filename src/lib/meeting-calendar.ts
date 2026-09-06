// Pure month/calendar math for the meetings page. Browser-safe: no node:* or DB imports.
// All dates are ISO YYYY-MM-DD strings, parsed and compared as UTC to avoid timezone drift.
import type { MeetingView } from './split-meetings';

export interface DayCell {
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
}

export interface DateGroup {
  date: string;
  items: MeetingView[];
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIso(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function addDaysUTC(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

export function monthParam(year: number, month: number): string {
  return `${year}-${pad2(month + 1)}`;
}

export function parseMonthParam(param: string | null | undefined): { year: number; month: number } | null {
  const match = param ? /^(\d{4})-(\d{2})$/.exec(param) : null;
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return null;
  return { year, month };
}

// Priority: an explicit ?month= param, else the month of the nearest upcoming meeting, else the current month.
export function resolveFocusMonth(
  param: string | null | undefined,
  events: MeetingView[],
  todayISO: string,
): { year: number; month: number } {
  const fromParam = parseMonthParam(param);
  if (fromParam) return fromParam;
  const nextUpcoming = events
    .filter((e) => e.date >= todayISO)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const anchorISO = nextUpcoming?.date ?? todayISO;
  const d = new Date(`${anchorISO}T00:00:00Z`);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

// Always starts on a Sunday and covers full weeks; trims trailing weeks that are entirely
// next-month, down to a floor of 4 weeks (28 days) — the shortest a month view can be.
export function buildMonthCells(year: number, month: number, todayISO: string): DayCell[] {
  const first = new Date(Date.UTC(year, month, 1));
  const gridStart = addDaysUTC(first, -first.getUTCDay());
  let cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = addDaysUTC(gridStart, i);
    const iso = toIso(d);
    cells.push({ iso, day: d.getUTCDate(), inMonth: d.getUTCMonth() === month, isToday: iso === todayISO });
  }
  while (cells.length > 28 && cells.slice(-7).every((c) => !c.inMonth)) {
    cells = cells.slice(0, -7);
  }
  return cells;
}

export function eventsInMonth(events: MeetingView[], year: number, month: number): MeetingView[] {
  const prefix = monthParam(year, month);
  return events.filter((e) => e.date.startsWith(prefix)).sort((a, b) => a.date.localeCompare(b.date));
}

// Assumes ascending-by-date input (eventsInMonth already sorts) so same-day meetings land in one group.
export function groupByDate(events: MeetingView[]): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const e of events) {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) {
      last.items.push(e);
    } else {
      groups.push({ date: e.date, items: [e] });
    }
  }
  return groups;
}

export function nearestUpcoming(events: MeetingView[], todayISO: string): MeetingView | undefined {
  return events
    .filter((e) => e.date >= todayISO)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
}
