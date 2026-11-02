import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { ContentLanguage, LearningGoal } from '../generated/prisma/enums';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

function constraints(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.keys(error.constraints ?? {}),
    ...constraints(error.children ?? []),
  ]);
}

describe('Profile DTO validation', () => {
  it('accepts valid profile fields and date-only values', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      name: 'Learner',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      headline: 'Learning every day',
      occupation: 'Designer',
      city: 'Delhi',
      bio: 'Working on my English.',
      dateOfBirth: '1995-08-15',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects impossible, future and malformed dates', async () => {
    for (const dateOfBirth of ['2026-02-30', '2999-01-01', '15-08-1995']) {
      const dto = plainToInstance(UpdateProfileDto, { dateOfBirth });
      const errors = await validate(dto);
      expect(constraints(errors)).toContain('isDateOnly');
    }
  });

  it('rejects invalid avatar URLs and overlong text', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      avatarUrl: 'not-a-url',
      headline: 'x'.repeat(121),
    });
    const errors = await validate(dto);
    const names = constraints(errors);

    expect(names).toContain('isUrl');
    expect(names).toContain('maxLength');
  });

  it('accepts nullable profile fields for clearing values', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      avatarUrl: null,
      headline: null,
      dateOfBirth: null,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('normalises and validates interests', async () => {
    const dto = plainToInstance(UpdatePreferencesDto, {
      interests: [' Interviews ', 'english-speaking'],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.interests).toEqual(['interviews', 'english-speaking']);
  });

  it('rejects unsupported, duplicate and overlong interest lists', async () => {
    for (const interests of [
      ['unsupported'],
      ['interviews', 'interviews'],
      [
        'english-speaking',
        'interviews',
        'workplace-communication',
        'money-basics',
        'confidence',
        'interviews',
      ],
    ]) {
      const dto = plainToInstance(UpdatePreferencesDto, { interests });
      const errors = await validate(dto);
      expect(constraints(errors).length).toBeGreaterThan(0);
    }
  });

  it('rejects invalid daily goals, explanation languages and blank preferences', async () => {
    const invalidDailyGoal = plainToInstance(UpdatePreferencesDto, { dailyGoalMinutes: 7 });
    await expect(validate(invalidDailyGoal)).resolves.not.toHaveLength(0);

    const invalidLanguage = plainToInstance(UpdatePreferencesDto, {
      explanationLanguage: 'SPANISH',
    });
    await expect(validate(invalidLanguage)).resolves.not.toHaveLength(0);

    const nullLanguage = plainToInstance(UpdatePreferencesDto, {
      explanationLanguage: null,
    });
    await expect(validate(nullLanguage)).resolves.not.toHaveLength(0);
  });

  it('allows clearing nullable learning selections', async () => {
    const dto = plainToInstance(UpdatePreferencesDto, {
      learningGoal: null,
      proficiency: null,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepts a complete preference payload', async () => {
    const dto = plainToInstance(UpdatePreferencesDto, {
      learningGoal: LearningGoal.CAREER_SKILLS,
      proficiency: 'INTERMEDIATE',
      explanationLanguage: ContentLanguage.HINGLISH,
      dailyGoalMinutes: 15,
      interests: ['interviews'],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
