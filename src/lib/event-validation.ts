// Pure, browser-safe (no node:*/DB imports) so admin pages and client scripts share one rules source.

import { MAX_TITLE, MAX_TIME, MAX_LOCATION } from './limits';

export interface EventInput {
  date: string;
  title: string;
  time: string;
  location: string;
}

export type EventField = 'date' | 'title' | 'time' | 'location';

export interface EventFieldError {
  field: EventField;
  message: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateEvent(input: EventInput): EventFieldError[] {
  const errors: EventFieldError[] = [];

  const date = input.date.trim();
  if (date === '') {
    errors.push({ field: 'date', message: 'Please enter a date.' });
  } else if (!isCalendarDate(date)) {
    errors.push({ field: 'date', message: 'Use the format YYYY-MM-DD.' });
  }

  requiredError(errors, 'title', input.title, MAX_TITLE);
  requiredError(errors, 'time', input.time, MAX_TIME);
  requiredError(errors, 'location', input.location, MAX_LOCATION);

  return errors;
}

// Round-trip check rejects calendar overflows (2026-13-40, 2026-02-30) Date.parse would silently roll over.
function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function requiredError(errors: EventFieldError[], field: EventField, value: string, max: number): void {
  const trimmed = value.trim();
  if (trimmed === '') {
    errors.push({ field, message: `Please enter a ${field}.` });
  } else if (trimmed.length > max) {
    errors.push({ field, message: `Please keep the ${field} under ${max} characters.` });
  }
}

// date alone when the title is empty; otherwise date + kebab(title). Deterministic.
export function slugifyEvent(date: string, title: string): string {
  const base = date.trim();
  const kebab = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return kebab === '' ? base : `${base}-${kebab}`;
}

export function extractTime(form: FormData): string {
  const rawTime = form.get('time');
  const timeVal = form.get('time_val');
  const timeAmpm = form.get('time_ampm');

  const mainTime = (typeof rawTime === 'string' && rawTime.trim() !== '') 
    ? rawTime.trim() 
    : (typeof timeVal === 'string' ? timeVal.trim() : '');

  if (mainTime === '') return '';

  if (/am|pm/i.test(mainTime)) {
    return mainTime;
  }

  const ampm = typeof timeAmpm === 'string' && timeAmpm.trim() ? timeAmpm.trim().toUpperCase() : 'PM';
  return `${mainTime} ${ampm}`;
}

