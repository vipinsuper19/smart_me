import { formatDateOnly, parseDateOnly } from '../common/utils/date-only';

const DATE_KEY_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = DATE_KEY_FORMATTERS.get(timeZone);
  if (cached) {
    return cached;
  }

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    // A user row can only contain a valid IANA zone through the API, but a bad
    // value must never crash progress reads. Fall back to UTC deliberately.
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  DATE_KEY_FORMATTERS.set(timeZone, formatter);
  return formatter;
}

/**
 * Returns the user's local calendar date (`YYYY-MM-DD`) for an instant.
 * `Intl` applies the IANA zone including daylight-saving transitions, while
 * date-only comparisons avoid the DST pitfalls of adding 24-hour milliseconds.
 */
export function localDateKey(instant: Date, timeZone: string): string {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

/** Shifts a calendar date key by a number of whole days using UTC arithmetic. */
export function shiftDateKey(dateKey: string, days: number): string {
  const date = parseDateOnly(dateKey);
  if (!date) {
    throw new Error(`Invalid date-only value: ${dateKey}`);
  }

  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

/** Inclusive list of the last `count` local dates, oldest first, ending at `today`. */
export function lastDateKeys(today: string, count: number): string[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('count must be a positive integer');
  }

  return Array.from({ length: count }, (_, index) => shiftDateKey(today, index - (count - 1)));
}

/**
 * Streak rule: a learning day qualifies when at least one eligible lesson or
 * quiz is completed. Completing another activity on the same local day does
 * not increment the streak. A missed day restarts it at one.
 */
export function nextStreak(
  lastLearningDate: Date | null,
  currentStreak: number,
  todayKey: string,
): number {
  if (!lastLearningDate) {
    return 1;
  }

  const lastKey = formatDateOnly(lastLearningDate);
  if (lastKey === todayKey) {
    return Math.max(1, currentStreak);
  }

  return lastKey === shiftDateKey(todayKey, -1) ? Math.max(0, currentStreak) + 1 : 1;
}
