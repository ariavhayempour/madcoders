import { neon, types } from '@neondatabase/serverless';
import { parseDate, parseTimestamp } from './timestamps';

// The driver returns date/time columns as JS Date by default, contradicting schema.ts's `string` types.
types.setTypeParser(types.builtins.TIMESTAMPTZ, parseTimestamp);
types.setTypeParser(types.builtins.TIMESTAMP, parseTimestamp);
types.setTypeParser(types.builtins.DATE, parseDate);

// Single construction point so a missing secret fails loudly at first use, not mid-query.
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

export const sql = neon(url);
