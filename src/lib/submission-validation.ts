// Pure, browser-safe rules (no node:*/DB imports) shared by the client script and the API route.

import { SUBMISSION_TYPES, type SubmissionType } from '../db/schema';
import { MAX_NAME, MAX_EMAIL, MAX_MESSAGE, MAX_MESSAGE_WORDS } from './limits';

export interface SubmissionInput {
  name: string;
  email: string;
  type: SubmissionType;
  message: string;
}

export type SubmissionField = 'name' | 'email' | 'message' | 'type';

export interface SubmissionFieldError {
  field: SubmissionField;
  message: string;
}

// Local part, then optional subdomains, then wisc.edu as the final domain.
const WISC_EMAIL = /^[^\s@]+@([a-z0-9-]+\.)*wisc\.edu$/i;

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

export function validateSubmission(input: SubmissionInput): SubmissionFieldError[] {
  const errors: SubmissionFieldError[] = [];

  if (input.name.trim() === '') {
    errors.push({ field: 'name', message: 'Please enter your name.' });
  } else if (input.name.trim().length > MAX_NAME) {
    errors.push({ field: 'name', message: `Please keep your name under ${MAX_NAME} characters.` });
  }

  if (!WISC_EMAIL.test(input.email.trim())) {
    errors.push({ field: 'email', message: 'Please use your @wisc.edu email.' });
  } else if (input.email.trim().length > MAX_EMAIL) {
    errors.push({ field: 'email', message: `Please use an email under ${MAX_EMAIL} characters.` });
  }

  if (input.message.trim() === '') {
    errors.push({ field: 'message', message: 'Please enter a message.' });
  } else if (countWords(input.message) > MAX_MESSAGE_WORDS) {
    errors.push({ field: 'message', message: `Please keep your message to ${MAX_MESSAGE_WORDS} words or fewer.` });
  } else if (input.message.trim().length > MAX_MESSAGE) {
    errors.push({ field: 'message', message: `Please keep your message under ${MAX_MESSAGE} characters.` });
  }

  if (!SUBMISSION_TYPES.includes(input.type)) {
    errors.push({ field: 'type', message: 'Unknown submission type.' });
  }

  return errors;
}
