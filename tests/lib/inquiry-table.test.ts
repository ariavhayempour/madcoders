import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import InquiryTable from '../../src/components/InquiryTable.astro';
import type { SubmissionRow } from '../../src/db/schema';

async function render(submissions: SubmissionRow[]): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(InquiryTable, { props: { submissions } });
}

const sample: SubmissionRow = {
  id: 7,
  name: 'Grace Hopper',
  email: 'grace@wisc.edu',
  submission_type: 'inquiry',
  message: 'When is the next meeting?',
  created_at: '2026-07-10T15:30:00.000Z',
  is_read: false,
};

describe('InquiryTable', () => {
  it('shows an empty state when there are no submissions', async () => {
    const html = await render([]);
    expect(html).toContain('No submissions yet.');
    expect(html).not.toContain('<table');
  });

  it('renders name, email, type, and message for a submission', async () => {
    const html = await render([sample]);
    expect(html).not.toContain('No submissions yet.');
    expect(html).toContain('Grace Hopper');
    expect(html).toContain('grace@wisc.edu');
    expect(html).toContain('Inquiry'); // human label for the 'inquiry' submission type
    expect(html).toContain('When is the next meeting?');
  });

  it('renders one row per submission', async () => {
    const html = await render([
      sample,
      { ...sample, id: 8, name: 'Ada Lovelace', email: 'ada@wisc.edu' },
    ]);
    expect(html).toContain('Grace Hopper');
    expect(html).toContain('Ada Lovelace');
  });
});

describe('InquiryTable — bulk selection', () => {
  it('renders a select checkbox in every row, hidden until edit mode', async () => {
    const html = await render([sample, { ...sample, id: 8 }]);
    const cells = html.match(/<td[^>]*data-action="select"[^>]*>/g) ?? [];
    expect(cells).toHaveLength(2);
    for (const cell of cells) expect(cell).toMatch(/style="display:\s*none;?"/);
  });

  it('renders a select-all checkbox in the header, hidden until edit mode', async () => {
    const html = await render([sample]);
    const header = /<th[^>]*data-select-all-cell[^>]*>/.exec(html);
    expect(header, 'select-all header cell').not.toBeNull();
    expect(header![0]).toMatch(/style="display:\s*none;?"/);
    expect(html).toMatch(/<input[^>]*id="select-all-submissions"[^>]*type="checkbox"|<input[^>]*type="checkbox"[^>]*id="select-all-submissions"/);
  });

  it('gives each row checkbox an accessible label', async () => {
    const html = await render([sample]);
    const box = /<input[^>]*data-select-row[^>]*>/.exec(html);
    expect(box, 'row checkbox').not.toBeNull();
    expect(box![0]).toMatch(/type="checkbox"/);
    expect(box![0]).toMatch(/aria-label="[^"]+"/);
  });

  it('no longer renders the per-row delete button', async () => {
    const html = await render([sample]);
    expect(html).not.toContain('data-action="delete"');
    expect(html).not.toContain('Delete submission');
  });
});
