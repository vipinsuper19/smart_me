import { localDateKey, lastDateKeys, nextStreak, shiftDateKey } from './date-zone';
import { levelForXp } from './gamification.constants';

describe('local-day calculation', () => {
  it('uses the configured IANA time zone at the midnight boundary', () => {
    expect(localDateKey(new Date('2026-10-21T18:29:59.000Z'), 'Asia/Kolkata')).toBe('2026-10-21');
    expect(localDateKey(new Date('2026-10-21T18:30:00.000Z'), 'Asia/Kolkata')).toBe('2026-10-22');
    expect(localDateKey(new Date('2026-10-21T18:30:00.000Z'), 'UTC')).toBe('2026-10-21');
  });

  it('handles daylight-saving transitions without shifting the calendar date', () => {
    expect(localDateKey(new Date('2026-03-08T06:59:00.000Z'), 'America/New_York')).toBe(
      '2026-03-08',
    );
    expect(localDateKey(new Date('2026-03-09T03:59:00.000Z'), 'America/New_York')).toBe(
      '2026-03-08',
    );
    expect(localDateKey(new Date('2026-03-09T04:00:00.000Z'), 'America/New_York')).toBe(
      '2026-03-09',
    );
    expect(localDateKey(new Date('2026-11-01T04:30:00.000Z'), 'America/New_York')).toBe(
      '2026-11-01',
    );
  });

  it('falls back to UTC for an invalid stored time zone', () => {
    expect(localDateKey(new Date('2026-10-21T23:30:00.000Z'), 'Not/AZone')).toBe('2026-10-21');
  });

  it('shifts and lists date-only keys across month boundaries', () => {
    expect(shiftDateKey('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(lastDateKeys('2026-11-02', 7)).toEqual([
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });
});

describe('streak calculation', () => {
  const date = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

  it('starts at one on the first learning day', () => {
    expect(nextStreak(null, 0, '2026-10-21')).toBe(1);
  });

  it('does not increment twice on the same local day', () => {
    expect(nextStreak(date('2026-10-21'), 4, '2026-10-21')).toBe(4);
    expect(nextStreak(date('2026-10-21'), 0, '2026-10-21')).toBe(1);
  });

  it('increments for a consecutive local day', () => {
    expect(nextStreak(date('2026-10-21'), 4, '2026-10-22')).toBe(5);
    expect(nextStreak(date('2026-10-31'), 2, '2026-11-01')).toBe(3);
  });

  it('restarts after a missed day or an inconsistent future date', () => {
    expect(nextStreak(date('2026-10-19'), 8, '2026-10-21')).toBe(1);
    expect(nextStreak(date('2026-10-23'), 6, '2026-10-21')).toBe(1);
  });
});

describe('levels', () => {
  it('maps cumulative XP thresholds without resetting XP', () => {
    expect(levelForXp(0)).toMatchObject({ level: 1, xpIntoLevel: 0, xpToNextLevel: 100 });
    expect(levelForXp(99).level).toBe(1);
    expect(levelForXp(100)).toMatchObject({ level: 2, xpIntoLevel: 0, xpForNextLevel: 150 });
    expect(levelForXp(249).level).toBe(2);
    expect(levelForXp(250).level).toBe(3);
    expect(levelForXp(4_499).level).toBe(9);
    expect(levelForXp(4_500).level).toBe(10);
    expect(levelForXp(6_999).level).toBe(10);
    expect(levelForXp(7_000).level).toBe(11);
    expect(levelForXp(10_000).level).toBe(12);
  });

  it('reports progress inside the current level', () => {
    expect(levelForXp(50)).toMatchObject({
      level: 1,
      xpIntoLevel: 50,
      xpToNextLevel: 50,
      progressPercent: 50,
    });
  });

  it('never decreases a level as XP grows', () => {
    let previous = 1;
    for (let xp = 0; xp <= 20_000; xp += 137) {
      const level = levelForXp(xp).level;
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });
});
