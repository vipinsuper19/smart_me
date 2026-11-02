import { localTimeKey } from './time-zone';

describe('localTimeKey', () => {
  it('returns the local wall-clock time for an IANA zone', () => {
    expect(localTimeKey(new Date('2026-11-01T14:30:00.000Z'), 'Asia/Kolkata')).toBe('20:00');
    expect(localTimeKey(new Date('2026-11-01T14:30:00.000Z'), 'UTC')).toBe('14:30');
    expect(localTimeKey(new Date('2026-11-01T03:05:00.000Z'), 'Asia/Kolkata')).toBe('08:35');
  });

  it('applies daylight-saving transitions rather than a fixed offset', () => {
    // New York is UTC-4 in July and UTC-5 in January.
    expect(localTimeKey(new Date('2026-07-01T12:00:00.000Z'), 'America/New_York')).toBe('08:00');
    expect(localTimeKey(new Date('2026-01-15T12:00:00.000Z'), 'America/New_York')).toBe('07:00');
  });

  it('uses midnight as 00:00 rather than 24:00', () => {
    expect(localTimeKey(new Date('2026-11-01T18:30:00.000Z'), 'Asia/Kolkata')).toBe('00:00');
  });

  it('falls back to UTC for an invalid stored zone instead of throwing', () => {
    expect(localTimeKey(new Date('2026-11-01T14:30:00.000Z'), 'Not/AZone')).toBe('14:30');
  });
});
