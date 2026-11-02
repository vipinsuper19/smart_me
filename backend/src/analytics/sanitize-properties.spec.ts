import { sanitizeAnalyticsProperties } from './sanitize-properties';

describe('sanitizeAnalyticsProperties', () => {
  it('rejects values that are not a plain object', () => {
    expect(sanitizeAnalyticsProperties(null)).toBeNull();
    expect(sanitizeAnalyticsProperties(undefined)).toBeNull();
    expect(sanitizeAnalyticsProperties('lesson_opened')).toBeNull();
    expect(sanitizeAnalyticsProperties(42)).toBeNull();
    expect(sanitizeAnalyticsProperties([{ lessonId: 'lesson_1' }])).toBeNull();
  });

  it('keeps safe scalar properties', () => {
    expect(
      sanitizeAnalyticsProperties({
        lessonId: 'lesson_1',
        durationSeconds: 42,
        completed: true,
        rating: null,
      }),
    ).toEqual({
      lessonId: 'lesson_1',
      durationSeconds: 42,
      completed: true,
      rating: null,
    });
  });

  it('drops sensitive keys case-insensitively at any depth', () => {
    const sanitized = sanitizeAnalyticsProperties({
      lessonId: 'lesson_1',
      email: 'learner@example.com',
      userEmail: 'learner@example.com',
      password: 'secret',
      accessToken: 'abc',
      phoneNumber: '+911234567890',
      dateOfBirth: '1995-01-01',
      nested: {
        apiSecret: 'hidden',
        Authorization: 'Bearer x',
        deviceToken: 'token',
        safe: 'kept',
      },
    });

    expect(sanitized).toEqual({
      lessonId: 'lesson_1',
      nested: { safe: 'kept' },
    });
    expect(JSON.stringify(sanitized)).not.toContain('learner@example.com');
    expect(JSON.stringify(sanitized)).not.toContain('Bearer x');
  });

  it('keeps safe keys that merely contain short fragments', () => {
    expect(
      sanitizeAnalyticsProperties({
        companyName: 'SmartMe',
        panel: 'home',
        expanded: true,
        spelling: 'ok',
      }),
    ).toEqual({
      companyName: 'SmartMe',
      panel: 'home',
      expanded: true,
      spelling: 'ok',
    });
  });

  it('drops short sensitive identifiers only as whole words', () => {
    const sanitized = sanitizeAnalyticsProperties({
      panNumber: 'ABCDE1234F',
      pinCode: '110001',
      userOTP: '123456',
      dob: '1995-01-01',
      pinnedLesson: 'lesson_1',
    });

    expect(sanitized).toEqual({ pinnedLesson: 'lesson_1' });
  });

  it('bounds string length, array length and nesting depth', () => {
    const sanitized = sanitizeAnalyticsProperties({
      longText: 'x'.repeat(900),
      tags: Array.from({ length: 30 }, (_, index) => `tag-${index}`),
      level1: {
        level2: {
          level3: {
            tooDeep: true,
          },
        },
      },
    }) as Record<string, unknown>;

    expect((sanitized.longText as string).length).toBe(500);
    expect(sanitized.tags).toHaveLength(20);
    expect(sanitized.level1).toEqual({ level2: {} });
  });

  it('drops functions and undefined values instead of persisting them', () => {
    const sanitized = sanitizeAnalyticsProperties({
      kept: 'yes',
      missing: undefined,
      callback: () => 'no',
    });

    expect(sanitized).toEqual({ kept: 'yes' });
  });

  it('returns an empty object for empty properties', () => {
    expect(sanitizeAnalyticsProperties({})).toEqual({});
  });
});
