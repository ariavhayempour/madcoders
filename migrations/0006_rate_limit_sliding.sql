-- Sliding-gap support for the inquiry endpoint. Forward-only; do not edit 0002.
-- Nullable so existing rows migrate without a rewrite; a null means "no prior hit recorded".

ALTER TABLE rate_limit_hits ADD COLUMN IF NOT EXISTS last_hit_at TIMESTAMPTZ;
