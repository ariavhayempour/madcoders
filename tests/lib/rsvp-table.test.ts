import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import RsvpTable from '../../src/components/RsvpTable.astro';
import type { MeetingGroup } from '../../src/lib/rsvp-grouping';
import type { EventRow } from '../../src/db/schema';

async function render(groups: MeetingGroup[], events: EventRow[] = [], today = '2026-07-15'): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(RsvpTable, { props: { groups, events, today } });
}

const group: MeetingGroup = {
  meeting: 'fall-kickoff',
  rsvps: [
    {
      id: 1,
      name: 'Ada Lovelace',
      email: 'ada@wisc.edu',
      meeting: 'fall-kickoff',
      status: 'pending',
      created_at: '2026-07-10T15:30:00.000Z',
    },
  ],
};

function event(overrides: Partial<EventRow>): EventRow {
  return {
    id: 1,
    slug: 'fall-kickoff',
    date: '2026-07-20',
    title: 'Fall Kickoff',
    time: '6:00 PM',
    location: 'Union South',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('RsvpTable', () => {
  it('shows an empty state when there are no groups', async () => {
    const html = await render([]);
    expect(html).toContain('No RSVPs yet.');
    expect(html).not.toContain('<table');
  });

  it('labels each meeting and renders its RSVP rows', async () => {
    const html = await render([group]);
    expect(html).not.toContain('No RSVPs yet.');
    expect(html).toContain('fall-kickoff');
    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('ada@wisc.edu');
  });

  it('renders a section per meeting', async () => {
    const html = await render([
      group,
      {
        meeting: 'spring-finale',
        rsvps: [
          {
            id: 2,
            name: 'Grace Hopper',
            email: 'grace@wisc.edu',
            meeting: 'spring-finale',
            status: 'present',
            created_at: '2026-07-12T15:30:00.000Z',
          },
        ],
      },
    ]);
    expect(html).toContain('fall-kickoff');
    expect(html).toContain('spring-finale');
    expect(html).toContain('Grace Hopper');
  });

  it('falls back to the raw meeting slug as the title when no event matches', async () => {
    const html = await render([group], []);
    expect(html).toContain('fall-kickoff');
  });

  it('prefers the joined event title, date pill, and time/location line when an event matches', async () => {
    const html = await render([group], [event({})]);
    expect(html).toContain('Fall Kickoff');
    expect(html).toContain('6:00 PM');
    expect(html).toContain('Union South');
  });

  it('labels an upcoming meeting distinctly from a past one', async () => {
    const upcoming = await render([group], [event({ date: '2026-07-20' })], '2026-07-15');
    const past = await render([group], [event({ date: '2026-07-01' })], '2026-07-15');
    expect(upcoming).toContain('data-when="upcoming"');
    expect(past).toContain('data-when="past"');
  });

  it('renders row-level edit and delete actions for each RSVP', async () => {
    const html = await render([group]);
    expect(html).toMatch(/data-action="edit"/);
    expect(html).toMatch(/data-action="delete"/);
    expect(html).toMatch(/data-action="save"/);
    expect(html).toMatch(/data-action="cancel"/);
  });

  it('tags each row with its RSVP id for the client script to target', async () => {
    const html = await render([group]);
    expect(html).toContain('data-rsvp-id="1"');
  });

  it('renders the attendance status as a labelled badge with its value on the cell', async () => {
    const html = await render([group]);
    expect(html).toMatch(/data-field="status"[^>]*data-status="pending"/);
    expect(html).toContain('Pending');
  });
});
