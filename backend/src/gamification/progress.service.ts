import { Injectable } from '@nestjs/common';
import { LessonProgressStatus, PublicationStatus } from '../generated/prisma/enums';
import { parseDateOnly } from '../common/utils/date-only';
import { PrismaService } from '../prisma/prisma.service';
import { userNotFound } from '../profile/profile.errors';
import { lastDateKeys, localDateKey } from './date-zone';
import { DEFAULT_DAILY_GOAL_MINUTES } from './gamification.constants';
import { GamificationService } from './gamification.service';
import {
  ProgressOverviewView,
  ProgressTopicView,
  ProgressWeeklyView,
  WeeklyDayView,
} from './gamification.types';

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  async getOverview(userId: string, now: Date = new Date()): Promise<ProgressOverviewView> {
    const summary = await this.gamification.getSummary(userId, now);
    const [lessonsStarted, lessonsCompleted, quizAttempts, paths] = await Promise.all([
      this.prisma.lessonProgress.count({ where: { userId } }),
      this.prisma.lessonProgress.count({
        where: { userId, status: LessonProgressStatus.COMPLETED },
      }),
      this.prisma.quizAttempt.count({ where: { userId } }),
      this.prisma.learningPath.findMany({
        where: { status: PublicationStatus.PUBLISHED },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          slug: true,
          title: true,
          courses: {
            where: { status: PublicationStatus.PUBLISHED },
            select: {
              modules: {
                select: {
                  lessons: {
                    where: { status: PublicationStatus.PUBLISHED },
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const lessonIds = paths.flatMap((path) =>
      path.courses.flatMap((course) =>
        course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)),
      ),
    );
    const progressRows =
      lessonIds.length > 0
        ? await this.prisma.lessonProgress.findMany({
            where: { userId, lessonId: { in: lessonIds } },
            select: { lessonId: true, status: true },
          })
        : [];
    const progressByLesson = new Map(
      progressRows.map((row) => [row.lessonId, row.status] as const),
    );

    const topics: ProgressTopicView[] = paths
      .map((path) => {
        const pathLessonIds = path.courses.flatMap((course) =>
          course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)),
        );
        const started = pathLessonIds.filter((id) => progressByLesson.has(id)).length;
        const completed = pathLessonIds.filter(
          (id) => progressByLesson.get(id) === LessonProgressStatus.COMPLETED,
        ).length;

        return {
          id: path.id,
          slug: path.slug,
          title: path.title,
          totalLessons: pathLessonIds.length,
          startedLessons: started,
          completedLessons: completed,
          percent:
            pathLessonIds.length > 0 ? Math.floor((completed / pathLessonIds.length) * 100) : 0,
        };
      })
      .filter((topic) => topic.totalLessons > 0);

    return {
      lessonsStarted,
      lessonsCompleted,
      quizAttempts,
      quizzesCompleted: summary.quizzesCompleted,
      minutesLearned: summary.minutesLearned,
      totalXp: summary.totalXp,
      level: summary.level,
      levelProgress: summary.levelProgress,
      currentStreak: summary.currentStreak,
      longestStreak: summary.longestStreak,
      dailyGoal: summary.dailyGoal,
      topics,
    };
  }

  async getWeekly(userId: string, now: Date = new Date()): Promise<ProgressWeeklyView> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        timeZone: true,
        preferences: { select: { dailyGoalMinutes: true } },
      },
    });
    if (!user) {
      throw userNotFound();
    }

    const todayKey = localDateKey(now, user.timeZone);
    const dateKeys = lastDateKeys(todayKey, 7);
    const dates = dateKeys.map((key) => {
      const value = parseDateOnly(key);
      if (!value) {
        throw new Error(`Invalid date-only value: ${key}`);
      }
      return value;
    });
    const goalMinutes = user.preferences?.dailyGoalMinutes ?? DEFAULT_DAILY_GOAL_MINUTES;
    const activities = await this.prisma.dailyActivity.findMany({
      where: { userId, activityDate: { in: dates } },
    });
    const activityByDate = new Map(
      activities.map((activity) => [activity.activityDate.toISOString().slice(0, 10), activity]),
    );

    const days: WeeklyDayView[] = dateKeys.map((date) => {
      const activity = activityByDate.get(date);
      return {
        date,
        lessonsCompleted: activity?.lessonsCompleted ?? 0,
        quizzesCompleted: activity?.quizzesCompleted ?? 0,
        minutesLearned: activity?.minutesLearned ?? 0,
        xpEarned: activity?.xpEarned ?? 0,
        dailyGoalMinutes: activity?.dailyGoalMinutes ?? goalMinutes,
        goalMet: activity?.goalMet ?? false,
      };
    });

    return {
      timeZone: user.timeZone,
      from: dateKeys[0],
      to: dateKeys[dateKeys.length - 1],
      days,
      totals: {
        lessonsCompleted: days.reduce((sum, day) => sum + day.lessonsCompleted, 0),
        quizzesCompleted: days.reduce((sum, day) => sum + day.quizzesCompleted, 0),
        minutesLearned: days.reduce((sum, day) => sum + day.minutesLearned, 0),
        xpEarned: days.reduce((sum, day) => sum + day.xpEarned, 0),
        goalDays: days.filter((day) => day.goalMet).length,
        activeDays: days.filter((day) => day.lessonsCompleted + day.quizzesCompleted > 0).length,
      },
    };
  }
}
