const TIME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = TIME_FORMATTERS.get(timeZone);
  if (cached) {
    return cached;
  }

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    // Mirrors the date-key helper: a bad stored zone must never crash a
    // reminder scan. UTC is the deliberate, documented fallback.
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  }

  TIME_FORMATTERS.set(timeZone, formatter);
  return formatter;
}

/**
 * Returns the user's local wall-clock time as `HH:MM` (24-hour).
 *
 * Reminder preferences store a local time, so comparing this key with
 * `reminderTimeLocal` avoids converting "19:00" through an arbitrary date and
 * keeps daylight-saving transitions correct.
 */
export function localTimeKey(instant: Date, timeZone: string): string {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('hour')}:${values.get('minute')}`;
}
