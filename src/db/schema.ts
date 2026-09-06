// Hand-mirrors migrations/*.sql; tests/db/schema.test.ts guards the sync (docs/claude/0006-database.md).

export const SUBMISSION_TYPES = ['inquiry', 'join', 'digest'] as const;
export type SubmissionType = (typeof SUBMISSION_TYPES)[number];

export const RSVP_STATUSES = ['pending', 'present', 'absent'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export interface RsvpRow {
  id: number;
  name: string;
  email: string;
  meeting: string;
  status: RsvpStatus;
  created_at: string;
}

export interface SubmissionRow {
  id: number;
  name: string;
  email: string;
  submission_type: SubmissionType;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface RateLimitHitRow {
  key: string;
  window_start: string;
  count: number;
  expires_at: string;
}

export interface EventRow {
  id: number;
  slug: string;
  date: string;
  title: string | null;
  time: string | null;
  location: string | null;
  created_at: string;
}

export const TABLES = {
  rsvps: 'rsvps',
  submissions: 'submissions',
  rateLimitHits: 'rate_limit_hits',
  events: 'events',
} as const;

export const RSVP_COLUMNS = {
  id: 'id',
  name: 'name',
  email: 'email',
  meeting: 'meeting',
  status: 'status',
  createdAt: 'created_at',
} as const;

export const SUBMISSION_COLUMNS = {
  id: 'id',
  name: 'name',
  email: 'email',
  submissionType: 'submission_type',
  message: 'message',
  createdAt: 'created_at',
} as const;

export const RATE_LIMIT_COLUMNS = {
  key: 'key',
  windowStart: 'window_start',
  count: 'count',
  expiresAt: 'expires_at',
  lastHitAt: 'last_hit_at',
} as const;

export const EVENT_COLUMNS = {
  id: 'id',
  slug: 'slug',
  date: 'date',
  title: 'title',
  time: 'time',
  location: 'location',
  createdAt: 'created_at',
} as const;
