-- Fixed-window rate-limit counters. Forward-only; do not edit 0001.
-- DDL here is the schema source of truth; src/db/schema.ts mirrors it.

CREATE TABLE rate_limit_hits (
  key          TEXT        PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  count        INTEGER     NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ NOT NULL
);

-- Supports the opportunistic cleanup of expired buckets.
CREATE INDEX rate_limit_hits_expires_at_idx ON rate_limit_hits (expires_at);
