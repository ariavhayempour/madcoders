# 0017 — RSVP attendance status

Admin "Manage RSVPs" edits an attendance **status** per guest; name and email are
read-only there (edit them at the source if ever needed, not in this flow).

## Data

`migrations/0005_rsvp_status.sql` adds `rsvps.status TEXT NOT NULL DEFAULT 'pending'`
with `CHECK (status IN ('pending', 'present', 'absent'))`. Existing rows backfill to
`pending`. `RSVP_STATUSES` in `src/db/schema.ts` mirrors the CHECK (guarded by
`tests/db/schema.test.ts`).

## Statuses & colors

| Status  | Default | Badge            |
|---------|---------|------------------|
| pending | ✓       | grey (`muted`)   |
| present |         | green (`success`)|
| absent  |         | red (`destructive/10`)|

## Edit path

`updateRsvp` sets `status` only (no name/email/meeting mutation, so no unique-violation
path). `validateRsvpEdit({ status })` rejects anything outside `RSVP_STATUSES`. The
`PATCH /admin/api/rsvps/[id]` route takes `{ status }`; the RsvpTable client swaps the
status badge for a `<select>` in manage mode and PATCHes the chosen value.

`STATUS_META` (component frontmatter) and `STATUS` (client script) hold the same
label/badge map — keep them in sync.
