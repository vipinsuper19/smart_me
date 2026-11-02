import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ApiException } from '../common/errors/api-error';
import { ContentLanguage, LearningGoal, ProficiencyLevel } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { PreferencesService } from './preferences.service';
import { ProfileService } from './profile.service';

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDatabase = DATABASE_URL ? describe : describe.skip;

const baseConfig = {
  DATABASE_URL: DATABASE_URL ?? '',
  DATABASE_POOL_MAX: 5,
};

describeIfDatabase('Profile, preferences and onboarding integration', () => {
  jest.setTimeout(30_000);

  let prisma: PrismaService;
  let profile: ProfileService;
  let preferences: PreferencesService;
  const emails: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService(new ConfigService(baseConfig));
    await prisma.$connect();
    profile = new ProfileService(prisma);
    preferences = new PreferencesService(prisma);
  });

  afterAll(async () => {
    if (emails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
    }
    await prisma.$disconnect();
  });

  async function createUser(): Promise<{ id: string; email: string }> {
    const email = `profile-test-${randomUUID()}@example.com`;
    emails.push(email);
    return prisma.user.create({ data: { email, name: 'Original Name' } });
  }

  async function expectApiError(
    promise: Promise<unknown>,
    code: string,
    status = 400,
  ): Promise<void> {
    let caught: unknown;
    try {
      await promise;
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiException);
    const exception = caught as ApiException;
    expect(exception.getStatus()).toBe(status);
    expect((exception.getResponse() as { code: string }).code).toBe(code);
  }

  it('returns an empty profile and creates the profile row on first read', async () => {
    const user = await createUser();

    const view = await profile.getProfile(user.id);

    expect(view).toMatchObject({
      id: user.id,
      email: user.email,
      name: 'Original Name',
      avatarUrl: null,
      timeZone: 'Asia/Kolkata',
      locale: 'en-IN',
      onboardingCompletedAt: null,
    });
    expect(view.profile).toMatchObject({
      headline: null,
      occupation: null,
      city: null,
      bio: null,
      dateOfBirth: null,
    });
    await expect(
      prisma.userProfile.findUnique({ where: { userId: user.id } }),
    ).resolves.not.toBeNull();
  });

  it('updates account and profile fields and returns a date-only value', async () => {
    const user = await createUser();

    const updated = await profile.updateProfile(user.id, {
      name: '  Updated Name  ',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      headline: '  Learning every day  ',
      occupation: 'Designer',
      city: 'Delhi',
      bio: 'Working on my English.',
      dateOfBirth: '1995-08-15',
    });

    expect(updated.name).toBe('Updated Name');
    expect(updated.avatarUrl).toBe('https://cdn.example.com/avatar.png');
    expect(updated.profile).toMatchObject({
      headline: 'Learning every day',
      occupation: 'Designer',
      city: 'Delhi',
      bio: 'Working on my English.',
      dateOfBirth: '1995-08-15',
    });

    const cleared = await profile.updateProfile(user.id, {
      avatarUrl: null,
      headline: null,
      dateOfBirth: null,
    });

    expect(cleared.name).toBe('Updated Name');
    expect(cleared.avatarUrl).toBeNull();
    expect(cleared.profile.headline).toBeNull();
    expect(cleared.profile.dateOfBirth).toBeNull();
    expect(cleared.profile.city).toBe('Delhi');
  });

  it('rejects malformed and future dates in the service as well as the DTO', async () => {
    const user = await createUser();

    await expectApiError(
      profile.updateProfile(user.id, { dateOfBirth: '2026-02-30' }),
      'VALIDATION_ERROR',
    );
    await expectApiError(
      profile.updateProfile(user.id, { dateOfBirth: '2999-01-01' }),
      'VALIDATION_ERROR',
    );
  });

  it('returns defaults and edits preferences partially', async () => {
    const user = await createUser();

    await expect(preferences.getPreferences(user.id)).resolves.toMatchObject({
      learningGoal: null,
      proficiency: null,
      explanationLanguage: ContentLanguage.HINGLISH,
      dailyGoalMinutes: 10,
      interests: [],
    });

    const updated = await preferences.updatePreferences(user.id, {
      learningGoal: LearningGoal.INTERVIEW_PREPARATION,
      proficiency: ProficiencyLevel.INTERMEDIATE,
      explanationLanguage: ContentLanguage.ENGLISH,
      dailyGoalMinutes: 15,
      interests: ['interviews', 'english-speaking'],
    });

    expect(updated).toMatchObject({
      learningGoal: LearningGoal.INTERVIEW_PREPARATION,
      proficiency: ProficiencyLevel.INTERMEDIATE,
      explanationLanguage: ContentLanguage.ENGLISH,
      dailyGoalMinutes: 15,
      interests: ['interviews', 'english-speaking'],
    });

    const partial = await preferences.updatePreferences(user.id, {
      dailyGoalMinutes: 5,
    });

    expect(partial).toMatchObject({
      learningGoal: LearningGoal.INTERVIEW_PREPARATION,
      proficiency: ProficiencyLevel.INTERMEDIATE,
      explanationLanguage: ContentLanguage.ENGLISH,
      dailyGoalMinutes: 5,
      interests: ['interviews', 'english-speaking'],
    });

    const cleared = await preferences.updatePreferences(user.id, {
      learningGoal: null,
      proficiency: null,
      interests: [],
    });

    expect(cleared).toMatchObject({
      learningGoal: null,
      proficiency: null,
      dailyGoalMinutes: 5,
      interests: [],
    });
  });

  it('enforces daily-goal and interest invariants in the service', async () => {
    const user = await createUser();

    await expectApiError(
      preferences.updatePreferences(user.id, { dailyGoalMinutes: 7 }),
      'VALIDATION_ERROR',
    );
    await expectApiError(
      preferences.updatePreferences(user.id, { interests: ['interviews', 'interviews'] }),
      'VALIDATION_ERROR',
    );
    await expectApiError(
      preferences.updatePreferences(user.id, { interests: ['unsupported'] }),
      'VALIDATION_ERROR',
    );
  });

  it('completes onboarding with preferences, is idempotent and can be skipped', async () => {
    const user = await createUser();

    const initial = await preferences.getOnboarding(user.id);
    expect(initial.required).toBe(true);
    expect(initial.completedAt).toBeNull();
    expect(initial.preferences.dailyGoalMinutes).toBe(10);
    expect(initial.options.dailyGoalMinutes).toEqual([5, 10, 15]);
    expect(initial.options.learningGoals.map((option) => option.value)).toContain(
      LearningGoal.CONFIDENCE_COMMUNICATION,
    );
    expect(initial.options.interests.map((option) => option.value)).toContain('interviews');

    const completed = await preferences.completeOnboarding(user.id, {
      learningGoal: LearningGoal.CAREER_SKILLS,
      proficiency: ProficiencyLevel.BEGINNER,
      explanationLanguage: ContentLanguage.HINGLISH,
      dailyGoalMinutes: 15,
      interests: ['workplace-communication'],
    });

    expect(completed.completedAt).toBeInstanceOf(Date);
    expect(completed.preferences).toMatchObject({
      learningGoal: LearningGoal.CAREER_SKILLS,
      proficiency: ProficiencyLevel.BEGINNER,
      explanationLanguage: ContentLanguage.HINGLISH,
      dailyGoalMinutes: 15,
      interests: ['workplace-communication'],
    });

    const after = await preferences.getOnboarding(user.id);
    expect(after.required).toBe(false);
    expect(after.completedAt).toEqual(completed.completedAt);

    const repeated = await preferences.completeOnboarding(user.id, {});
    expect(repeated.completedAt).toEqual(completed.completedAt);
    expect(repeated.preferences).toMatchObject({
      learningGoal: LearningGoal.CAREER_SKILLS,
      interests: ['workplace-communication'],
    });

    await preferences.updatePreferences(user.id, { dailyGoalMinutes: 5 });
    const userAfterEdit = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { onboardingCompletedAt: true },
    });
    expect(userAfterEdit.onboardingCompletedAt).toEqual(completed.completedAt);

    const skippedUser = await createUser();
    const skipped = await preferences.completeOnboarding(skippedUser.id, {});
    expect(skipped.completedAt).toBeInstanceOf(Date);
    expect(skipped.preferences).toMatchObject({
      learningGoal: null,
      proficiency: null,
      explanationLanguage: ContentLanguage.HINGLISH,
      dailyGoalMinutes: 10,
      interests: [],
    });
  });

  it('returns USER_NOT_FOUND instead of leaking a relation conflict for missing users', async () => {
    const missingUserId = randomUUID();

    await expectApiError(profile.getProfile(missingUserId), 'USER_NOT_FOUND', 404);
    await expectApiError(
      profile.updateProfile(missingUserId, { headline: 'Missing user' }),
      'USER_NOT_FOUND',
      404,
    );
    await expectApiError(
      profile.updateProfile(missingUserId, { name: 'Missing user' }),
      'USER_NOT_FOUND',
      404,
    );
    await expectApiError(preferences.getPreferences(missingUserId), 'USER_NOT_FOUND', 404);
    await expectApiError(
      preferences.updatePreferences(missingUserId, { dailyGoalMinutes: 5 }),
      'USER_NOT_FOUND',
      404,
    );
    await expectApiError(preferences.getOnboarding(missingUserId), 'USER_NOT_FOUND', 404);
    await expectApiError(preferences.completeOnboarding(missingUserId, {}), 'USER_NOT_FOUND', 404);
  });
});
