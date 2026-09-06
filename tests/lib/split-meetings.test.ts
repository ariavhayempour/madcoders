import { describe, it, expect } from 'vitest';
import { splitMeetings, type MeetingView } from '../../src/lib/split-meetings';

const PAST: MeetingView = { id: '2000-01-01-retro', date: '2000-01-01', title: 'Retro kickoff' };
const FUTURE: MeetingView = { id: '2099-12-31-future', date: '2099-12-31', title: 'Future session' };
const TODAY = '2050-06-15'; // between PAST and FUTURE

describe('splitMeetings — pure ordering/split logic', () => {
  it('sorts upcoming ascending and past descending from unordered input', () => {
    const input: MeetingView[] = [
      { id: 'm-2050-08-01', date: '2050-08-01' },
      { id: 'm-2050-07-01', date: '2050-07-01' },
      { id: 'm-2050-01-01', date: '2050-01-01' },
      { id: 'm-2050-03-01', date: '2050-03-01' },
    ];
    const { upcoming, past } = splitMeetings(input, TODAY);
    expect(upcoming.map((m) => m.date)).toEqual(['2050-07-01', '2050-08-01']);
    expect(past.map((m) => m.date)).toEqual(['2050-03-01', '2050-01-01']);
  });

  it('places a far-future meeting in upcoming and a far-past meeting in past', () => {
    const { upcoming, past } = splitMeetings([FUTURE, PAST], TODAY);
    expect(upcoming).toEqual([FUTURE]);
    expect(past).toEqual([PAST]);
  });

  it('treats a meeting dated exactly today as upcoming', () => {
    const { upcoming, past } = splitMeetings([{ id: 'm-today', date: TODAY }], TODAY);
    expect(upcoming).toHaveLength(1);
    expect(past).toHaveLength(0);
  });

  it('returns empty upcoming when every meeting is past', () => {
    expect(splitMeetings([PAST], TODAY).upcoming).toHaveLength(0);
  });

  it('returns two empty lists for no meetings', () => {
    expect(splitMeetings([], TODAY)).toEqual({ upcoming: [], past: [] });
  });
});
