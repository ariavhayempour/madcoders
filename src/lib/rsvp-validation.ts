// Pure, browser-safe RSVP validation (no node:*/DB imports) so the client script and API route share one rules source.

export interface RsvpInput {
  name: string;
  email: string;
  meeting: string;
}

import { MAX_NAME, MAX_EMAIL } from './limits';
import { RSVP_STATUSES, type RsvpStatus } from '../db/schema';

export type RsvpField = 'name' | 'email' | 'meeting' | 'status';

export interface RsvpFieldError {
  field: RsvpField;
  message: string;
}

// Admin edit only changes attendance status; name/email stay read-only.
export interface RsvpEditInput {
  status: RsvpStatus;
}

// Local part, then optional subdomains, then wisc.edu as the final domain.
const WISC_EMAIL = /^[^\s@]+@([a-z0-9-]+\.)*wisc\.edu$/i;

function nameErrors(name: string): RsvpFieldError[] {
  if (name.trim() === '') return [{ field: 'name', message: 'Please enter your name.' }];
  if (name.trim().length > MAX_NAME) {
    return [{ field: 'name', message: `Please keep your name under ${MAX_NAME} characters.` }];
  }
  return [];
}

function emailErrors(email: string): RsvpFieldError[] {
  if (!WISC_EMAIL.test(email.trim())) {
    return [{ field: 'email', message: 'Please use your @wisc.edu email.' }];
  }
  if (email.trim().length > MAX_EMAIL) {
    return [{ field: 'email', message: `Please use an email under ${MAX_EMAIL} characters.` }];
  }
  return [];
}

export function validateRsvp(input: RsvpInput): RsvpFieldError[] {
  const errors: RsvpFieldError[] = [...nameErrors(input.name), ...emailErrors(input.email)];

  if (input.meeting.trim() === '') {
    errors.push({ field: 'meeting', message: 'Missing meeting.' });
  }

  return errors;
}

// Admin edit of an existing RSVP: attendance status only.
export function validateRsvpEdit(input: RsvpEditInput): RsvpFieldError[] {
  if (!RSVP_STATUSES.includes(input.status)) {
    return [{ field: 'status', message: 'Please choose a valid status.' }];
  }
  return [];
}
