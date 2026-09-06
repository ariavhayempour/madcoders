# Bulk-select delete for submissions

Replaces the per-row delete icon button in the admin submissions Edit mode with checkbox
multi-select and a single "Delete (N)" bulk-delete action.

## Problem

`InquiryTable.astro`'s Edit mode previously revealed a trash-icon button on every row; each
click fired its own `confirm()` + `DELETE /admin/api/submissions/[id]` request. Deleting several
submissions meant repeating that per row. This replaces it with select-then-delete-once.

## UI changes

- **Header checkbox**: a leading `<th>` "select all" checkbox, hidden unless editing (same
  `style="display:none"` toggle pattern the old delete-icon column used).
- **Row checkboxes**: each `<tr>` gets a leading `<td data-action="select">` checkbox, hidden
  until Edit is on. The per-row trash-icon button and its column are removed.
- **Edit-mode click behavior**: while editing, clicking a row toggles its checkbox instead of
  toggling read/unread. Outside edit mode, click-to-toggle-read is unchanged. Mixing both in the
  same mode was deemed too error-prone, so they're mutually exclusive per the approved design.
- **Delete button**: `submissions.astro`'s panel header gains a `Delete (N)` button next to
  `Edit`/`Done`, hidden when not editing or when nothing is selected; the count updates live as
  rows are (de)selected.
- **Done** clears all selections, hides the Delete button, and restores click-to-toggle-read.
- **Select-all** respects `InquiryFilters`-hidden rows (only affects currently visible rows) and
  reflects an indeterminate state when some but not all visible rows are selected.

## Delete flow

1. Edit → checkboxes + Delete button appear (Delete hidden/disabled at 0 selected).
2. Check rows → Delete button label updates to `Delete (N)`.
3. Click Delete → one `confirm('Delete N submissions?')`, then a single
   `DELETE /admin/api/submissions` request, body `{ ids: number[] }`.
4. Success → remove all selected rows from the DOM, reset selection state, dispatch
   `submissions:changed` once.
5. Failure → `alert()`, restore row opacity, keep selections so the user can retry.

## Backend — new bulk endpoint

New route `src/pages/admin/api/submissions/index.ts` (sibling to the existing `[id].ts`),
`prerender = false`, exporting `DELETE`:

| Condition | Status | Body |
|---|---|---|
| `ids` missing / not an array / empty / contains non-positive-integers | `400` | `{ ok: false }` |
| Valid ids, deleted | `200` | `{ ok: true }` |
| Unexpected DB failure | `500` | `{ ok: false }` |

`src/db/submission.ts` gains:

```ts
export async function deleteSubmissions(ids: number[]): Promise<void> {
  await sql`DELETE FROM submissions WHERE id = ANY(${ids})`;
}
```

Follows the same parameterized-query, no-error-detail-logged convention as the rest of the file.

## Old single-item DELETE route

`DELETE` in `src/pages/admin/api/submissions/[id].ts` is removed — the bulk endpoint fully
replaces it and nothing else in the codebase calls it. `PATCH` (read/unread toggle) in the same
file is untouched. No existing tests reference the single-item `DELETE` route directly, so
nothing needs updating there.

## Testing

`tests/submissions.test.ts` gains cases for the new bulk route: empty/malformed `ids` → `400`;
valid `ids` → `200` and `deleteSubmissions` called with them; DB error → `500`. Existing
`PATCH`/read-toggle tests are unaffected.

## Out of scope

No pagination-aware "select all across pages" (the table isn't paginated). No optimistic-UI
partial-failure reconciliation beyond the existing all-or-nothing `alert()` + revert pattern
already used for single delete.
