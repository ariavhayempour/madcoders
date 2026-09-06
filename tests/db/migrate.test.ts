import { describe, it, expect } from 'vitest';
import { selectPending } from '../../scripts/migrate';

describe('selectPending', () => {
  it('returns pending migrations sorted ascending by filename', () => {
    const all = ['0002_add_col.sql', '0001_init.sql', '0003_index.sql'];
    expect(selectPending(all, [])).toEqual([
      '0001_init.sql',
      '0002_add_col.sql',
      '0003_index.sql',
    ]);
  });

  it('excludes migrations already recorded as applied', () => {
    const all = ['0001_init.sql', '0002_add_col.sql'];
    expect(selectPending(all, ['0001_init.sql'])).toEqual(['0002_add_col.sql']);
  });

  it('is a no-op (empty) when every migration is applied', () => {
    const all = ['0001_init.sql', '0002_add_col.sql'];
    expect(selectPending(all, ['0001_init.sql', '0002_add_col.sql'])).toEqual([]);
  });

  it('ignores non-.sql entries in the migrations directory', () => {
    const all = ['0001_init.sql', 'README.md', '.DS_Store'];
    expect(selectPending(all, [])).toEqual(['0001_init.sql']);
  });
});
