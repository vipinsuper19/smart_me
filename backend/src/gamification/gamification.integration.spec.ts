import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ContentService } from '../content/content.service';
import { PublicationStatus, XPReason } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from './gamification.service';
import { ProgressService } from './progress.service';

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDatabase = DATABASE_URL ? describe : describe.skip;

const baseConfig = {
  DATABASE_URL: DATABASE_URL ?? '',
  DATABASE_POOL_MAX: 5,
};

describeIfDatabase('Gamification and progress integration', () => {
  jest.setTimeout(30_000);

  let prisma: PrismaService;
  let gamification: GamificationService;
  let progress: ProgressService;
  let content: ContentService;
  let path: { id: string };
  let lessons: { id: string; estimatedMinutes: number }[];
  const emails: string[] = [];
  const pathIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService(new ConfigService(baseConfig));
    await prisma.$connect();
    gamification = new GamificationService(prisma);
    progress = new ProgressService(prisma, gamification);
    content = new ContentService(prisma, gamification);

    await seedAchievements(prisma);

    const suffix = randomUUID().slice(0, 8);
    path = await prisma.learningPath.create({
      data: {
        slug: `gamification-test-${suffix}`,
        title: 'Gamification Test Path',
        description: 'A published path used by gamification tests.',
        status: PublicationStatus.PUBLISHED,
        order: 9_500,
      },
    });
    pathIds.push(path.id);

    const course = await prisma.course.create({
      data: {
        learningPathId: path.id,
        slug: `gamification-course-${suffix}`,
        title: 'Gamification Course',
        shortDescription: 'A free course for reward tests.',
        status: PublicationStatus.PUBLISHED,
        order: 0,
      },
    });
    const module = await prisma.courseModule.create({
      data: {
        courseId: course.id,
        slug: `gamification-module-${suffix}`,
        title: 'Reward Module',
        order: 0,
      },
    });

    lessons = [];
    for (let index = 0; index < 10; index += 1) {
      lessons.push(
        await prisma.lesson.create({
          data: {
            moduleId: module.id,
            slug: `gamification-lesson-${suffix}-${index}`,
            title: `Reward Lesson ${index + 1}`,
            summary: 'A five minute lesson used to verify rewards.',
            objective: 'Verify server-authoritative XP.',
            status: PublicationStatus.PUBLISHED,
            order: index,
            estimatedMinutes: 5,
          },
          select: { id: true, estimatedMinutes: true },
        }),
      );
    }
  });

  afterAll(async () => {
    if (emails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
    }
    if (pathIds.length > 0) {
      await prisma.learningPath.deleteMany({ where: { id: { in: pathIds } } });
    }
    await prisma.$disconnect();
  });

  async function createUser(
    timeZone = 'Asia/Kolkata',
    dailyGoalMinutes = 10,
  ): Promise<{ id: string; email: string }> {
    const email = `gamification-test-${randomUUID()}@example.com`;
    emails.push(email);
    const user = await prisma.user.create({
      data: { email, name: 'Gamification Test', timeZone },
    });
    await prisma.userPreference.create({
      data: { userId: user.id, dailyGoalMinutes },
    });
    return user;
  }

  async function awardLesson(
    userId: string,
    lesson: { id: string; estimatedMinutes: number },
    now: Date,
    timeSpentSeconds = lesson.estimatedMinutes * 60,
  ) {
    return prisma.$transaction((tx) =>
      gamification.awardLessonCompletion(tx, {
        userId,
        lessonId: lesson.id,
        estimatedMinutes: lesson.estimatedMinutes,
        timeSpentSeconds,
        now,
      }),
    );
  }

  it('awards lesson XP once and keeps repeated completion idempotent', async () => {
    const user = await createUser();

    const completed = await content.completeLesson(user.id, lessons[0].id);
    expect(completed).toMatchObject({
      status: 'COMPLETED',
      progressPercent: 100,
      alreadyCompleted: false,
    });
    expect(completed.completedAt).not.toBeNull();
    expect(completed.rewards).toMatchObject({
      xpEarned: 10,
      totalXp: 10,
      level: 1,
      leveledUp: false,
      alreadyAwarded: false,
      currentStreak: 1,
      xpBreakdown: { lessonXp: 10, quizXp: 0, dailyGoalXp: 0, achievementXp: 0 },
    });
    expect(completed.rewards.achievementsUnlocked.map((item) => item.code)).toContain(
      'FIRST_LESSON',
    );

    const repeated = await content.completeLesson(user.id, lessons[0].id);
    expect(repeated.alreadyCompleted).toBe(true);
    expect(repeated.completedAt?.toISOString()).toBe(completed.completedAt?.toISOString());
    expect(repeated.rewards).toMatchObject({
      xpEarned: 0,
      totalXp: 10,
      alreadyAwarded: true,
      currentStreak: 1,
    });

    const stats = await prisma.userStats.findUniqueOrThrow({ where: { userId: user.id } });
    expect(stats).toMatchObject({
      totalXp: 10,
      currentLevel: 1,
      currentStreak: 1,
      longestStreak: 1,
      lessonsCompleted: 1,
      minutesLearned: 1,
    });
    await expect(prisma.xPTransaction.count({ where: { userId: user.id } })).resolves.toBe(1);
    await expect(
      prisma.dailyActivity.findFirstOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({
      lessonsCompleted: 1,
      xpEarned: 10,
      minutesLearned: 1,
      goalMet: false,
    });

    const summary = await gamification.getSummary(user.id);
    expect(summary).toMatchObject({
      totalXp: 10,
      level: 1,
      currentStreak: 1,
      longestStreak: 1,
      lessonsCompleted: 1,
      minutesLearned: 1,
    });
    expect(summary.dailyGoal).toMatchObject({ targetMinutes: 10, minutesLearned: 1, met: false });

    const transactions = await gamification.listTransactions(user.id, { page: 1, pageSize: 20 });
    expect(transactions.total).toBe(1);
    expect(transactions.items[0]).toMatchObject({
      amount: 10,
      reason: XPReason.LESSON_COMPLETED,
      sourceType: 'LESSON',
      sourceId: lessons[0].id,
      balanceAfter: 10,
    });
  });

  it('rewards a met daily goal once and unlocks goal achievements', async () => {
    const user = await createUser('Asia/Kolkata', 10);
    const now = new Date('2026-10-23T05:00:00.000Z');

    const first = await awardLesson(user.id, lessons[1], now, 300);
    expect(first).toMatchObject({
      xpEarned: 10,
      totalXp: 10,
      dailyGoal: { date: '2026-10-23', targetMinutes: 10, minutesLearned: 5, met: false },
    });

    const second = await awardLesson(user.id, lessons[2], now, 300);
    expect(second).toMatchObject({
      xpEarned: 15,
      totalXp: 25,
      dailyGoal: { minutesLearned: 10, percent: 100, met: true },
      xpBreakdown: { lessonXp: 10, quizXp: 0, dailyGoalXp: 5, achievementXp: 0 },
    });
    expect(second.achievementsUnlocked.map((item) => item.code)).toContain('DAILY_GOAL_ACHIEVED');

    const repeated = await awardLesson(user.id, lessons[2], now, 300);
    expect(repeated).toMatchObject({ xpEarned: 0, totalXp: 25, alreadyAwarded: true });

    const stats = await prisma.userStats.findUniqueOrThrow({ where: { userId: user.id } });
    expect(stats).toMatchObject({
      totalXp: 25,
      lessonsCompleted: 2,
      minutesLearned: 10,
    });
    const activity = await prisma.dailyActivity.findUniqueOrThrow({
      where: {
        userId_activityDate: {
          userId: user.id,
          activityDate: new Date('2026-10-23T00:00:00.000Z'),
        },
      },
    });
    expect(activity).toMatchObject({
      lessonsCompleted: 2,
      minutesLearned: 10,
      xpEarned: 25,
      goalMet: true,
    });
    await expect(
      prisma.xPTransaction.count({
        where: { userId: user.id, reason: XPReason.DAILY_GOAL_REACHED },
      }),
    ).resolves.toBe(1);

    const earned = await gamification.getAchievements(user.id);
    expect(earned.items.find((item) => item.code === 'DAILY_GOAL_ACHIEVED')).toMatchObject({
      earned: true,
      progress: { currentValue: 1, targetValue: 1, percent: 100 },
    });
  });

  it('levels up and unlocks the ten-lesson achievement', async () => {
    const user = await createUser('Asia/Kolkata', 15);
    const now = new Date('2026-10-25T05:00:00.000Z');

    let last = await awardLesson(user.id, lessons[0], now, 300);
    for (let index = 1; index < lessons.length; index += 1) {
      last = await awardLesson(user.id, lessons[index], now, 300);
    }

    expect(last).toMatchObject({
      xpEarned: 10,
      totalXp: 105,
      level: 2,
      leveledUp: true,
      alreadyAwarded: false,
    });
    expect(last.achievementsUnlocked.map((item) => item.code)).toContain('LESSONS_10');
    expect(last.dailyGoal).toMatchObject({ targetMinutes: 15, minutesLearned: 50, met: true });

    const stats = await prisma.userStats.findUniqueOrThrow({ where: { userId: user.id } });
    expect(stats).toMatchObject({
      totalXp: 105,
      currentLevel: 2,
      lessonsCompleted: 10,
      minutesLearned: 50,
    });
  });

  it('builds streaks from local days and returns seven-day activity', async () => {
    const user = await createUser('Asia/Kolkata', 15);

    await awardLesson(user.id, lessons[0], new Date('2026-10-20T18:31:00.000Z'), 300);
    await awardLesson(user.id, lessons[1], new Date('2026-10-21T18:31:00.000Z'), 300);
    // Same local day (22 Oct in India): must not increment the streak again.
    await awardLesson(user.id, lessons[2], new Date('2026-10-22T10:00:00.000Z'), 300);
    await awardLesson(user.id, lessons[3], new Date('2026-10-22T18:31:00.000Z'), 300);

    const stats = await prisma.userStats.findUniqueOrThrow({ where: { userId: user.id } });
    expect(stats).toMatchObject({
      totalXp: 40,
      currentStreak: 3,
      longestStreak: 3,
      lessonsCompleted: 4,
      minutesLearned: 20,
    });
    expect(
      (await gamification.getAchievements(user.id)).items.find((item) => item.code === 'STREAK_3'),
    ).toMatchObject({ earned: true, progress: { currentValue: 3, targetValue: 3 } });

    const summary = await gamification.getSummary(user.id, new Date('2026-10-23T05:00:00.000Z'));
    expect(summary).toMatchObject({
      timeZone: 'Asia/Kolkata',
      currentStreak: 3,
      longestStreak: 3,
      lastLearningDate: '2026-10-23',
      dailyGoal: { date: '2026-10-23', targetMinutes: 15, minutesLearned: 5, met: false },
    });

    const weekly = await progress.getWeekly(user.id, new Date('2026-10-23T12:00:00.000Z'));
    expect(weekly).toMatchObject({
      timeZone: 'Asia/Kolkata',
      from: '2026-10-17',
      to: '2026-10-23',
      totals: {
        lessonsCompleted: 4,
        quizzesCompleted: 0,
        minutesLearned: 20,
        xpEarned: 40,
        goalDays: 0,
        activeDays: 3,
      },
    });
    expect(weekly.days.filter((day) => day.lessonsCompleted > 0)).toEqual([
      expect.objectContaining({ date: '2026-10-21', lessonsCompleted: 1 }),
      expect.objectContaining({ date: '2026-10-22', lessonsCompleted: 2 }),
      expect.objectContaining({ date: '2026-10-23', lessonsCompleted: 1 }),
    ]);
  });

  it('applies the same instant to different local dates per user time zone', async () => {
    const india = await createUser('Asia/Kolkata', 10);
    const utc = await createUser('UTC', 10);
    const instant = new Date('2026-10-21T19:00:00.000Z');

    const indiaReward = await awardLesson(india.id, lessons[4], instant, 300);
    const utcReward = await awardLesson(utc.id, lessons[4], instant, 300);

    expect(indiaReward.dailyGoal.date).toBe('2026-10-22');
    expect(utcReward.dailyGoal.date).toBe('2026-10-21');
    expect(
      (await prisma.dailyActivity.findFirstOrThrow({ where: { userId: india.id } })).activityDate
        .toISOString()
        .slice(0, 10),
    ).toBe('2026-10-22');
    expect(
      (await prisma.dailyActivity.findFirstOrThrow({ where: { userId: utc.id } })).activityDate
        .toISOString()
        .slice(0, 10),
    ).toBe('2026-10-21');

    const indiaWeek = await progress.getWeekly(india.id, instant);
    const utcWeek = await progress.getWeekly(utc.id, instant);
    expect(indiaWeek.to).toBe('2026-10-22');
    expect(utcWeek.to).toBe('2026-10-21');
  });

  it('returns overview progress, achievements and filtered transactions', async () => {
    const user = await createUser();

    await content.completeLesson(user.id, lessons[0].id);
    await content.completeLesson(user.id, lessons[1].id);

    const overview = await progress.getOverview(user.id);
    expect(overview).toMatchObject({
      lessonsStarted: 2,
      lessonsCompleted: 2,
      quizAttempts: 0,
      quizzesCompleted: 0,
      totalXp: 20,
      level: 1,
      currentStreak: 1,
      longestStreak: 1,
    });
    expect(overview.topics.find((topic) => topic.id === path.id)).toMatchObject({
      totalLessons: 10,
      startedLessons: 2,
      completedLessons: 2,
      percent: 20,
    });

    const achievements = await gamification.getAchievements(user.id);
    expect(achievements.items.find((item) => item.code === 'FIRST_LESSON')).toMatchObject({
      earned: true,
      progress: { currentValue: 2, targetValue: 1, percent: 100 },
    });

    const all = await gamification.listTransactions(user.id, { page: 1, pageSize: 20 });
    expect(all.total).toBe(2);
    const filtered = await gamification.listTransactions(user.id, {
      page: 1,
      pageSize: 1,
      reason: XPReason.LESSON_COMPLETED,
    });
    expect(filtered).toMatchObject({ page: 1, pageSize: 1, total: 2 });
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0].amount).toBe(10);
  });

  it('provides an idempotent quiz-completion hook for Task 6', async () => {
    const user = await createUser();
    const attemptId = `attempt-${randomUUID()}`;
    const now = new Date('2026-10-24T05:00:00.000Z');

    const reward = await gamification.recordQuizCompletion({
      userId: user.id,
      attemptId,
      quizId: 'quiz-test',
      now,
    });
    expect(reward).toMatchObject({
      xpEarned: 5,
      totalXp: 5,
      currentStreak: 1,
      xpBreakdown: { lessonXp: 0, quizXp: 5, dailyGoalXp: 0, achievementXp: 0 },
      alreadyAwarded: false,
    });
    expect(reward.achievementsUnlocked.map((item) => item.code)).toContain('FIRST_QUIZ');

    const repeated = await gamification.recordQuizCompletion({
      userId: user.id,
      attemptId,
      quizId: 'quiz-test',
      now,
    });
    expect(repeated).toMatchObject({ xpEarned: 0, totalXp: 5, alreadyAwarded: true });

    const stats = await prisma.userStats.findUniqueOrThrow({ where: { userId: user.id } });
    expect(stats).toMatchObject({ totalXp: 5, quizzesCompleted: 1, currentStreak: 1 });
    await expect(prisma.xPTransaction.count({ where: { userId: user.id } })).resolves.toBe(1);
  });
});

async function seedAchievements(prisma: PrismaService): Promise<void> {
  const definitions = [
    {
      code: 'FIRST_LESSON',
      title: 'First Lesson',
      description: 'Complete your first lesson.',
      criteria: { type: 'LESSONS_COMPLETED', target: 1 },
      order: 1,
    },
    {
      code: 'FIRST_QUIZ',
      title: 'First Quiz',
      description: 'Complete your first quiz.',
      criteria: { type: 'QUIZZES_COMPLETED', target: 1 },
      order: 2,
    },
    {
      code: 'STREAK_3',
      title: 'Three-Day Streak',
      description: 'Learn for three days in a row.',
      criteria: { type: 'STREAK', target: 3 },
      order: 3,
    },
    {
      code: 'STREAK_7',
      title: 'Seven-Day Streak',
      description: 'Learn for seven days in a row.',
      criteria: { type: 'STREAK', target: 7 },
      order: 4,
    },
    {
      code: 'LESSONS_10',
      title: 'Ten Lessons',
      description: 'Complete ten lessons.',
      criteria: { type: 'LESSONS_COMPLETED', target: 10 },
      order: 5,
    },
    {
      code: 'DAILY_GOAL_ACHIEVED',
      title: 'Goal Getter',
      description: 'Reach your daily learning goal.',
      criteria: { type: 'DAILY_GOAL', target: 1 },
      order: 6,
    },
  ];

  for (const definition of definitions) {
    await prisma.achievement.upsert({
      where: { code: definition.code },
      update: { ...definition, isActive: true },
      create: { ...definition, isActive: true },
    });
  }
}
