-- Initial schema: RSVP and unified submission tables for the durable data layer.
-- DDL here is the schema source of truth; src/db/schema.ts mirrors it.

CREATE TABLE rsvps (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  meeting    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One RSVP per email per meeting.
  CONSTRAINT rsvps_email_meeting_unique UNIQUE (email, meeting)
);

CREATE TABLE submissions (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name            TEXT        NOT NULL,
  email           TEXT        NOT NULL,
  -- CHECK (not ENUM) so adding a type later is a one-line migration.
  submission_type TEXT        NOT NULL
                    CHECK (submission_type IN ('inquiry', 'join', 'digest')),
  message         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rsvps_meeting_idx ON rsvps (meeting);
CREATE INDEX submissions_created_at_idx ON submissions (created_at DESC);
