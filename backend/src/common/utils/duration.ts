const UNIT_SECONDS = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
  w: 7 * 24 * 60 * 60,
} as const;

/**
 * Parses the compact duration format used by environment variables, e.g.
 * `15m`, `30d`, `3600`, `2h`. A missing unit means seconds.
 */
export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)\s*([smhdw])?$/i.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration "${value}". Use a value such as 15m, 30d or 3600.`);
  }

  const amount = Number(match[1]);
  const unit = (match[2]?.toLowerCase() ?? 's') as keyof typeof UNIT_SECONDS;

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`Duration "${value}" must be a positive whole number.`);
  }

  return amount * UNIT_SECONDS[unit];
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
