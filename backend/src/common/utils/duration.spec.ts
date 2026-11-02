import { addDays, parseDurationToSeconds } from './duration';

describe('duration utilities', () => {
  it('parses compact durations', () => {
    expect(parseDurationToSeconds('15m')).toBe(900);
    expect(parseDurationToSeconds('30d')).toBe(2_592_000);
    expect(parseDurationToSeconds('2h')).toBe(7_200);
    expect(parseDurationToSeconds('45')).toBe(45);
  });

  it('rejects malformed durations', () => {
    expect(() => parseDurationToSeconds('soon')).toThrow();
    expect(() => parseDurationToSeconds('0m')).toThrow();
    expect(() => parseDurationToSeconds('-5m')).toThrow();
  });

  it('adds calendar days', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    expect(addDays(start, 30).toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });
});
