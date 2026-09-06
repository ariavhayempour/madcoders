ALTER TABLE rsvps
  ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'present', 'absent'));
