-- Club meetings; forward-only migration (docs/claude/0013-events-admin.md).

CREATE TABLE events (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- rsvps.meeting points at this value, no FK; regenerated from date+title on edit.
  slug       TEXT        NOT NULL UNIQUE,
  -- ISO 'YYYY-MM-DD'; sorts lexicographically, matching splitMeetings.
  date       TEXT        NOT NULL,
  title      TEXT,
  time       TEXT,
  location   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX events_date_idx ON events (date);
