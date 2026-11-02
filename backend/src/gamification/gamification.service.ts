import { Injectable } from '@nestjs/common';
import type { Achievement, DailyActivity, Prisma, UserStats } from '../generated/prisma/client';
import { XPReason } from '../generated/prisma/enums';
import { parseDateOnly } from '../common/utils/date-only';
import { PrismaService } from '../prisma/prisma.service';
import { userNotFound } from '../profile/profile.errors';
import { localDateKey, nextStreak } from './date-zone';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import {
  DEFAULT_DAILY_GOAL_MINUTES,
  levelForXp,
  LevelInfo,
  XP_REWARDS,
} from './gamification.constants';
import {
  AchievementListView,
  DailyGoalView,
  GamificationSummaryView,
  RewardBreakdownView,
  RewardResultView,
  toAchievementView,
  toLevelProgressView,
  toXPTransactionView,
  UnlockedAchievementView,
  XPTransactionListView,
} from './gamification.types';

interface RewardContext {
  tx: Prisma.TransactionClient;
  userId: string;
  now: Date;
  timeZone: string;
  todayKey: string;
  today: Date;
  goalMinutes: number;
  startingLevel: number;
  stats: UserStats;
  activity: DailyActivity | null;
  xpEarned: number;
  breakdown: RewardBreakdownView;
  achievementsUnlocked: UnlockedAchievementView[];
  alreadyAwarded: boolean;
}

interface AwardXpParams {
  amount: number;
  reason: XPReason;
  sourceType: string;
  sourceId: string | null;
  idempotencyKey: string;
  description: string | null;
}

interface ActivityDelta {
  lessonsCompleted?: number;
  quizzesCompleted?: number;
  minutesLearned?: number;
  xpEarned?: number;
}

interface LessonCompletionRewardParams {
  userId: string;
  lessonId: string;
  estimatedMinutes: number;
  timeSpentSeconds: number;
  now?: Date;
}

export interface QuizCompletionRewardParams {
  userId: string;
  attemptId: string;
  quizId: string;
  /** Quiz-specific reward from the published quiz, defaulting to the PRD rule. */
  xpAmount?: number;
  now?: Date;
}

interface AchievementCriteria {
  type: string;
  target: number;
}

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Applied inside the lesson-completion transaction so progress, XP, daily
   * activity and achievements either all commit or all roll back.
   */
  async awardLessonCompletion(
    tx: Prisma.TransactionClient,
    params: LessonCompletionRewardParams,
  ): Promise<RewardResultView> {
    const context = await this.createRewardContext(tx, params.userId, params.now);
    const idempotencyKey = `lesson-completed:${params.userId}:${params.lessonId}`;
    const alreadyGranted = await tx.xPTransaction.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    });
    if (alreadyGranted) {
      context.alreadyAwarded = true;
      return this.finalize(context);
    }

    const awarded = await this.awardXp(context, {
      amount: XP_REWARDS.LESSON_COMPLETED,
      reason: XPReason.LESSON_COMPLETED,
      sourceType: 'LESSON',
      sourceId: params.lessonId,
      idempotencyKey,
      description: 'Lesson completed.',
    });
    if (!awarded) {
      context.alreadyAwarded = true;
      return this.finalize(context);
    }

    const minutes = this.creditedMinutes(params.estimatedMinutes, params.timeSpentSeconds);
    context.stats = await tx.userStats.update({
      where: { userId: params.userId },
      data: {
        lessonsCompleted: { increment: 1 },
        minutesLearned: { increment: minutes },
        ...this.streakUpdate(context),
      },
    });
    await this.recordActivity(context, {
      lessonsCompleted: 1,
      minutesLearned: minutes,
      xpEarned: XP_REWARDS.LESSON_COMPLETED,
    });
    await this.maybeAwardDailyGoal(context);
    await this.unlockAchievements(context);

    return this.finalize(context);
  }

  /**
   * Quiz submission calls this inside its own transaction. The attempt id is
   * the natural idempotency key, so retries and duplicate submissions cannot
   * grant XP twice.
   */
  async awardQuizCompletion(
    tx: Prisma.TransactionClient,
    params: QuizCompletionRewardParams,
  ): Promise<RewardResultView> {
    const context = await this.createRewardContext(tx, params.userId, params.now);
    const idempotencyKey = `quiz-completed:${params.userId}:${params.attemptId}`;
    const alreadyGranted = await tx.xPTransaction.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    });
    if (alreadyGranted) {
      context.alreadyAwarded = true;
      return this.finalize(context);
    }

    const amount = Math.max(0, Math.floor(params.xpAmount ?? XP_REWARDS.QUIZ_COMPLETED));
    const awarded = await this.awardXp(context, {
      amount,
      reason: XPReason.QUIZ_COMPLETED,
      sourceType: 'QUIZ_ATTEMPT',
      sourceId: params.attemptId,
      idempotencyKey,
      description: 'Quiz completed.',
    });
    if (!awarded) {
      context.alreadyAwarded = true;
      return this.finalize(context);
    }

    context.stats = await tx.userStats.update({
      where: { userId: params.userId },
      data: {
        quizzesCompleted: { increment: 1 },
        ...this.streakUpdate(context),
      },
    });
    await this.recordActivity(context, {
      quizzesCompleted: 1,
      xpEarned: amount,
    });
    await this.maybeAwardDailyGoal(context);
    await this.unlockAchievements(context);

    return this.finalize(context);
  }

  /** Convenience wrapper for callers that are not already in a transaction. */
  async recordQuizCompletion(params: QuizCompletionRewardParams): Promise<RewardResultView> {
    return this.prisma.$transaction((tx) => this.awardQuizCompletion(tx, params));
  }

  async getSummary(userId: string, now: Date = new Date()): Promise<GamificationSummaryView> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        timeZone: true,
        stats: true,
        preferences: { select: { dailyGoalMinutes: true } },
      },
    });
    if (!user) {
      throw userNotFound();
    }

    const stats = user.stats;
    const totalXp = stats?.totalXp ?? 0;
    const level = levelForXp(totalXp);
    const todayKey = localDateKey(now, user.timeZone);
    const goalMinutes = user.preferences?.dailyGoalMinutes ?? DEFAULT_DAILY_GOAL_MINUTES;
    const activity = await this.prisma.dailyActivity.findUnique({
      where: { userId_activityDate: { userId, activityDate: this.dateOnly(todayKey) } },
    });

    return {
      timeZone: user.timeZone,
      totalXp,
      level: level.level,
      levelProgress: this.levelView(level),
      currentStreak: stats?.currentStreak ?? 0,
      longestStreak: stats?.longestStreak ?? 0,
      lastLearningDate: stats?.lastLearningDate
        ? stats.lastLearningDate.toISOString().slice(0, 10)
        : null,
      lessonsCompleted: stats?.lessonsCompleted ?? 0,
      quizzesCompleted: stats?.quizzesCompleted ?? 0,
      minutesLearned: stats?.minutesLearned ?? 0,
      dailyGoal: this.dailyGoalView(activity, goalMinutes, todayKey),
    };
  }

  async getAchievements(userId: string): Promise<AchievementListView> {
    await this.requireUser(userId);

    const [achievements, earned, progress] = await Promise.all([
      this.prisma.achievement.findMany({
        where: { isActive: true },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.userAchievement.findMany({ where: { userId } }),
      this.prisma.userAchievementProgress.findMany({ where: { userId } }),
    ]);
    const earnedByAchievement = new Map(earned.map((row) => [row.achievementId, row] as const));
    const progressByAchievement = new Map(progress.map((row) => [row.achievementId, row] as const));
    const items = achievements.map((achievement) => {
      const criteria = this.parseCriteria(achievement.criteria);
      return toAchievementView(
        achievement,
        earnedByAchievement.get(achievement.id),
        progressByAchievement.get(achievement.id),
        criteria?.target ?? 1,
      );
    });

    return {
      items,
      earnedCount: items.filter((item) => item.earned).length,
      totalCount: items.length,
    };
  }

  async listTransactions(
    userId: string,
    query: ListTransactionsQueryDto,
  ): Promise<XPTransactionListView> {
    await this.requireUser(userId);

    const where: Prisma.XPTransactionWhereInput = {
      userId,
      ...(query.reason ? { reason: query.reason } : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.xPTransaction.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize,
      }),
      this.prisma.xPTransaction.count({ where }),
    ]);

    return {
      items: transactions.map(toXPTransactionView),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  private async createRewardContext(
    tx: Prisma.TransactionClient,
    userId: string,
    now: Date = new Date(),
  ): Promise<RewardContext> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        timeZone: true,
        preferences: { select: { dailyGoalMinutes: true } },
      },
    });
    if (!user) {
      throw userNotFound();
    }

    const stats = await tx.userStats.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    const todayKey = localDateKey(now, user.timeZone);

    return {
      tx,
      userId,
      now,
      timeZone: user.timeZone,
      todayKey,
      today: this.dateOnly(todayKey),
      goalMinutes: user.preferences?.dailyGoalMinutes ?? DEFAULT_DAILY_GOAL_MINUTES,
      startingLevel: levelForXp(stats.totalXp).level,
      stats,
      activity: null,
      xpEarned: 0,
      breakdown: { lessonXp: 0, quizXp: 0, dailyGoalXp: 0, achievementXp: 0 },
      achievementsUnlocked: [],
      alreadyAwarded: false,
    };
  }

  private async awardXp(context: RewardContext, params: AwardXpParams): Promise<boolean> {
    const inserted = await context.tx.xPTransaction.createMany({
      data: [
        {
          userId: context.userId,
          amount: params.amount,
          reason: params.reason,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          idempotencyKey: params.idempotencyKey,
          description: params.description,
          balanceAfter: context.stats.totalXp + params.amount,
        },
      ],
      skipDuplicates: true,
    });
    if (inserted.count === 0) {
      return false;
    }

    context.stats = await context.tx.userStats.update({
      where: { userId: context.userId },
      data: { totalXp: { increment: params.amount } },
    });
    context.xpEarned += params.amount;

    switch (params.reason) {
      case XPReason.LESSON_COMPLETED:
        context.breakdown.lessonXp += params.amount;
        break;
      case XPReason.QUIZ_COMPLETED:
        context.breakdown.quizXp += params.amount;
        break;
      case XPReason.DAILY_GOAL_REACHED:
        context.breakdown.dailyGoalXp += params.amount;
        break;
      case XPReason.ACHIEVEMENT_UNLOCKED:
        context.breakdown.achievementXp += params.amount;
        break;
      default:
        break;
    }

    return true;
  }

  private async recordActivity(context: RewardContext, delta: ActivityDelta): Promise<void> {
    const existing = await context.tx.dailyActivity.findUnique({
      where: {
        userId_activityDate: {
          userId: context.userId,
          activityDate: context.today,
        },
      },
    });
    const minutesLearned = (existing?.minutesLearned ?? 0) + (delta.minutesLearned ?? 0);
    const goalMet = minutesLearned >= context.goalMinutes;

    context.activity = await context.tx.dailyActivity.upsert({
      where: {
        userId_activityDate: {
          userId: context.userId,
          activityDate: context.today,
        },
      },
      create: {
        userId: context.userId,
        activityDate: context.today,
        lessonsCompleted: delta.lessonsCompleted ?? 0,
        quizzesCompleted: delta.quizzesCompleted ?? 0,
        minutesLearned,
        xpEarned: delta.xpEarned ?? 0,
        dailyGoalMinutes: context.goalMinutes,
        goalMet,
      },
      update: {
        lessonsCompleted: { increment: delta.lessonsCompleted ?? 0 },
        quizzesCompleted: { increment: delta.quizzesCompleted ?? 0 },
        minutesLearned: { increment: delta.minutesLearned ?? 0 },
        xpEarned: { increment: delta.xpEarned ?? 0 },
        dailyGoalMinutes: context.goalMinutes,
        goalMet,
      },
    });
  }

  private async maybeAwardDailyGoal(context: RewardContext): Promise<void> {
    if (!context.activity?.goalMet) {
      return;
    }

    const awarded = await this.awardXp(context, {
      amount: XP_REWARDS.DAILY_GOAL_REACHED,
      reason: XPReason.DAILY_GOAL_REACHED,
      sourceType: 'DAILY_ACTIVITY',
      sourceId: context.todayKey,
      idempotencyKey: `daily-goal:${context.userId}:${context.todayKey}`,
      description: 'Daily learning goal reached.',
    });
    if (awarded) {
      await this.incrementActivityXp(context, XP_REWARDS.DAILY_GOAL_REACHED);
    }
  }

  private async unlockAchievements(context: RewardContext): Promise<void> {
    const achievements = await context.tx.achievement.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    if (achievements.length === 0) {
      return;
    }

    const [goalDays, earnedRows, progressRows] = await Promise.all([
      context.tx.dailyActivity.count({ where: { userId: context.userId, goalMet: true } }),
      context.tx.userAchievement.findMany({
        where: { userId: context.userId },
        select: { achievementId: true },
      }),
      context.tx.userAchievementProgress.findMany({ where: { userId: context.userId } }),
    ]);
    const earnedIds = new Set(earnedRows.map((row) => row.achievementId));
    const progressByAchievement = new Map(
      progressRows.map((row) => [row.achievementId, row] as const),
    );

    for (const achievement of achievements) {
      const criteria = this.parseCriteria(achievement.criteria);
      if (!criteria) {
        continue;
      }

      const currentValue = this.achievementValue(criteria.type, context.stats, goalDays);
      const reached = currentValue >= criteria.target;
      const previous = progressByAchievement.get(achievement.id);
      const completedAt = reached ? (previous?.completedAt ?? context.now) : null;

      await context.tx.userAchievementProgress.upsert({
        where: {
          userId_achievementId: {
            userId: context.userId,
            achievementId: achievement.id,
          },
        },
        create: {
          userId: context.userId,
          achievementId: achievement.id,
          currentValue,
          targetValue: criteria.target,
          completedAt,
        },
        update: {
          currentValue,
          targetValue: criteria.target,
          ...(completedAt ? { completedAt } : {}),
        },
      });

      if (!reached || earnedIds.has(achievement.id)) {
        continue;
      }

      const inserted = await context.tx.userAchievement.createMany({
        data: [
          {
            userId: context.userId,
            achievementId: achievement.id,
            earnedAt: context.now,
          },
        ],
        skipDuplicates: true,
      });
      if (inserted.count === 0) {
        continue;
      }

      earnedIds.add(achievement.id);
      context.achievementsUnlocked.push(this.toUnlockedAchievement(achievement, context.now));
      if (achievement.xpReward > 0) {
        const rewarded = await this.awardXp(context, {
          amount: achievement.xpReward,
          reason: XPReason.ACHIEVEMENT_UNLOCKED,
          sourceType: 'ACHIEVEMENT',
          sourceId: achievement.id,
          idempotencyKey: `achievement:${context.userId}:${achievement.code}`,
          description: `Achievement unlocked: ${achievement.title}.`,
        });
        if (rewarded) {
          await this.incrementActivityXp(context, achievement.xpReward);
        }
      }
    }
  }

  private async incrementActivityXp(context: RewardContext, amount: number): Promise<void> {
    context.activity = await context.tx.dailyActivity.update({
      where: {
        userId_activityDate: {
          userId: context.userId,
          activityDate: context.today,
        },
      },
      data: { xpEarned: { increment: amount } },
    });
  }

  private async finalize(context: RewardContext): Promise<RewardResultView> {
    const level = levelForXp(context.stats.totalXp);
    if (context.stats.currentLevel !== level.level) {
      context.stats = await context.tx.userStats.update({
        where: { userId: context.userId },
        data: { currentLevel: level.level },
      });
    }
    const activity =
      context.activity ??
      (await context.tx.dailyActivity.findUnique({
        where: {
          userId_activityDate: {
            userId: context.userId,
            activityDate: context.today,
          },
        },
      }));

    return {
      xpEarned: context.xpEarned,
      xpBreakdown: context.breakdown,
      totalXp: context.stats.totalXp,
      level: level.level,
      levelProgress: this.levelView(level),
      leveledUp: level.level > context.startingLevel,
      currentStreak: context.stats.currentStreak,
      longestStreak: context.stats.longestStreak,
      dailyGoal: this.dailyGoalView(activity, context.goalMinutes, context.todayKey),
      achievementsUnlocked: context.achievementsUnlocked,
      alreadyAwarded: context.alreadyAwarded,
    };
  }

  private streakUpdate(context: RewardContext): {
    currentStreak: number;
    longestStreak: number;
    lastLearningDate: Date;
  } {
    const currentStreak = nextStreak(
      context.stats.lastLearningDate,
      context.stats.currentStreak,
      context.todayKey,
    );

    return {
      currentStreak,
      longestStreak: Math.max(context.stats.longestStreak, currentStreak),
      lastLearningDate: context.today,
    };
  }

  private creditedMinutes(estimatedMinutes: number, timeSpentSeconds: number): number {
    const cap = Math.max(1, estimatedMinutes);
    const tracked = Math.max(1, Math.ceil(Math.max(0, timeSpentSeconds) / 60));
    return Math.min(cap, tracked);
  }

  private achievementValue(type: string, stats: UserStats, goalDays: number): number {
    switch (type) {
      case 'LESSONS_COMPLETED':
        return stats.lessonsCompleted;
      case 'QUIZZES_COMPLETED':
        return stats.quizzesCompleted;
      case 'STREAK':
        return stats.currentStreak;
      case 'DAILY_GOAL':
        return goalDays;
      default:
        return 0;
    }
  }

  private parseCriteria(criteria: Prisma.JsonValue): AchievementCriteria | null {
    if (typeof criteria !== 'object' || criteria === null || Array.isArray(criteria)) {
      return null;
    }

    const record = criteria as Record<string, unknown>;
    if (
      typeof record.type !== 'string' ||
      typeof record.target !== 'number' ||
      !Number.isFinite(record.target) ||
      record.target <= 0
    ) {
      return null;
    }

    return { type: record.type, target: Math.floor(record.target) };
  }

  private toUnlockedAchievement(achievement: Achievement, earnedAt: Date): UnlockedAchievementView {
    return {
      code: achievement.code,
      title: achievement.title,
      description: achievement.description,
      iconUrl: achievement.iconUrl,
      xpReward: achievement.xpReward,
      earnedAt,
    };
  }

  private dailyGoalView(
    activity: DailyActivity | null,
    goalMinutes: number,
    dateKey: string,
  ): DailyGoalView {
    const targetMinutes = activity?.dailyGoalMinutes ?? goalMinutes;
    const minutesLearned = activity?.minutesLearned ?? 0;

    return {
      date: dateKey,
      targetMinutes,
      minutesLearned,
      percent:
        targetMinutes > 0 ? Math.min(100, Math.floor((minutesLearned / targetMinutes) * 100)) : 0,
      met: minutesLearned >= targetMinutes,
    };
  }

  private levelView(level: LevelInfo) {
    return toLevelProgressView(level);
  }

  private dateOnly(dateKey: string): Date {
    const value = parseDateOnly(dateKey);
    if (!value) {
      throw new Error(`Invalid date-only value: ${dateKey}`);
    }
    return value;
  }

  private async requireUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw userNotFound();
    }
  }
}
