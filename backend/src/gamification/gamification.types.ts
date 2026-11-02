import type {
  Achievement,
  UserAchievement,
  UserAchievementProgress,
  XPTransaction,
} from '../generated/prisma/client';
import type { LevelInfo } from './gamification.constants';

export interface LevelProgressView {
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  xpToNextLevel: number;
  nextLevelAt: number;
  progressPercent: number;
}

export function toLevelProgressView(info: LevelInfo): LevelProgressView {
  return {
    level: info.level,
    totalXp: info.totalXp,
    xpIntoLevel: info.xpIntoLevel,
    xpForNextLevel: info.xpForNextLevel,
    xpToNextLevel: info.xpToNextLevel,
    nextLevelAt: info.nextLevelAt,
    progressPercent: info.progressPercent,
  };
}

export interface DailyGoalView {
  date: string;
  targetMinutes: number;
  minutesLearned: number;
  percent: number;
  met: boolean;
}

export interface RewardBreakdownView {
  lessonXp: number;
  quizXp: number;
  dailyGoalXp: number;
  achievementXp: number;
}

export interface UnlockedAchievementView {
  code: string;
  title: string;
  description: string;
  iconUrl: string | null;
  xpReward: number;
  earnedAt: Date;
}

export interface RewardResultView {
  xpEarned: number;
  xpBreakdown: RewardBreakdownView;
  totalXp: number;
  level: number;
  levelProgress: LevelProgressView;
  leveledUp: boolean;
  currentStreak: number;
  longestStreak: number;
  dailyGoal: DailyGoalView;
  achievementsUnlocked: UnlockedAchievementView[];
  /** True when the activity's reward had already been granted by an earlier request. */
  alreadyAwarded: boolean;
}

export interface GamificationSummaryView {
  timeZone: string;
  totalXp: number;
  level: number;
  levelProgress: LevelProgressView;
  currentStreak: number;
  longestStreak: number;
  lastLearningDate: string | null;
  lessonsCompleted: number;
  quizzesCompleted: number;
  minutesLearned: number;
  dailyGoal: DailyGoalView;
}

export interface AchievementProgressView {
  currentValue: number;
  targetValue: number;
  percent: number;
  completedAt: Date | null;
}

export interface AchievementView {
  code: string;
  title: string;
  description: string;
  iconUrl: string | null;
  xpReward: number;
  order: number;
  earned: boolean;
  earnedAt: Date | null;
  progress: AchievementProgressView;
}

export interface AchievementListView {
  items: AchievementView[];
  earnedCount: number;
  totalCount: number;
}

export interface XPTransactionView {
  id: string;
  amount: number;
  reason: XPTransaction['reason'];
  sourceType: string;
  sourceId: string | null;
  description: string | null;
  balanceAfter: number | null;
  createdAt: Date;
}

export function toXPTransactionView(transaction: XPTransaction): XPTransactionView {
  return {
    id: transaction.id,
    amount: transaction.amount,
    reason: transaction.reason,
    sourceType: transaction.sourceType,
    sourceId: transaction.sourceId,
    description: transaction.description,
    balanceAfter: transaction.balanceAfter,
    createdAt: transaction.createdAt,
  };
}

export interface XPTransactionListView {
  items: XPTransactionView[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ProgressTopicView {
  id: string;
  slug: string;
  title: string;
  totalLessons: number;
  startedLessons: number;
  completedLessons: number;
  percent: number;
}

export interface ProgressOverviewView {
  lessonsStarted: number;
  lessonsCompleted: number;
  quizAttempts: number;
  quizzesCompleted: number;
  minutesLearned: number;
  totalXp: number;
  level: number;
  levelProgress: LevelProgressView;
  currentStreak: number;
  longestStreak: number;
  dailyGoal: DailyGoalView;
  topics: ProgressTopicView[];
}

export interface WeeklyDayView {
  date: string;
  lessonsCompleted: number;
  quizzesCompleted: number;
  minutesLearned: number;
  xpEarned: number;
  dailyGoalMinutes: number;
  goalMet: boolean;
}

export interface ProgressWeeklyView {
  timeZone: string;
  from: string;
  to: string;
  days: WeeklyDayView[];
  totals: {
    lessonsCompleted: number;
    quizzesCompleted: number;
    minutesLearned: number;
    xpEarned: number;
    goalDays: number;
    activeDays: number;
  };
}

export function toAchievementView(
  achievement: Achievement,
  earned: UserAchievement | undefined,
  progress: UserAchievementProgress | undefined,
  fallbackTarget: number,
): AchievementView {
  const target = progress?.targetValue ?? fallbackTarget;
  const current = progress?.currentValue ?? 0;

  return {
    code: achievement.code,
    title: achievement.title,
    description: achievement.description,
    iconUrl: achievement.iconUrl,
    xpReward: achievement.xpReward,
    order: achievement.order,
    earned: Boolean(earned),
    earnedAt: earned?.earnedAt ?? null,
    progress: {
      currentValue: current,
      targetValue: target,
      percent: target > 0 ? Math.min(100, Math.floor((current / target) * 100)) : 100,
      completedAt: progress?.completedAt ?? earned?.earnedAt ?? null,
    },
  };
}
