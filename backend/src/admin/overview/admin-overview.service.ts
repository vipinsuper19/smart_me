import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  AccessTier,
  LessonProgressStatus,
  PublicationStatus,
  QuizAttemptStatus,
  SubscriptionStatus,
  UserStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { userNotFound, subscriptionNotFound } from '../admin.errors';
import {
  AnalyticsQueryDto,
  ListSubscriptionsQueryDto,
  ListUsersQueryDto,
} from '../dto/overview.dto';

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function statusCounts(
  rows: { status: PublicationStatus; _count: { _all: number } }[],
): Record<PublicationStatus, number> {
  const counts = {
    [PublicationStatus.DRAFT]: 0,
    [PublicationStatus.IN_REVIEW]: 0,
    [PublicationStatus.PUBLISHED]: 0,
    [PublicationStatus.ARCHIVED]: 0,
  };
  for (const row of rows) {
    counts[row.status] = row._count._all;
  }
  return counts;
}

@Injectable()
export class AdminOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsers7d,
      activeUsers7d,
      lessonStatuses,
      courseStatuses,
      pathStatuses,
      lessonsInReview,
      completedLessons,
      submittedAttempts,
      averageScore,
      activeSubscriptions,
      premiumEntitlements,
      totalXp,
      recentAudit,
      recentUsers,
      needsReview,
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: { not: UserStatus.DELETED } } }),
      this.prisma.user.count({
        where: { createdAt: { gte: sevenDaysAgo }, status: { not: UserStatus.DELETED } },
      }),
      this.prisma.user.count({
        where: { lastActiveAt: { gte: sevenDaysAgo }, status: { not: UserStatus.DELETED } },
      }),
      this.prisma.lesson.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.course.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.learningPath.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.lesson.count({ where: { status: PublicationStatus.IN_REVIEW } }),
      this.prisma.lessonProgress.count({
        where: { status: LessonProgressStatus.COMPLETED },
      }),
      this.prisma.quizAttempt.count({
        where: { status: QuizAttemptStatus.SUBMITTED },
      }),
      this.prisma.quizAttempt.aggregate({
        where: { status: QuizAttemptStatus.SUBMITTED },
        _avg: { score: true },
      }),
      this.prisma.subscription.count({
        where: {
          status: {
            in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE_PERIOD],
          },
        },
      }),
      this.prisma.entitlement.count({
        where: {
          isActive: true,
          tier: AccessTier.PREMIUM,
          OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        },
      }),
      this.prisma.userStats.aggregate({ _sum: { totalXp: true } }),
      this.prisma.auditLog.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 10,
        include: { adminUser: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.user.findMany({
        where: { status: { not: UserStatus.DELETED } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          createdAt: true,
          lastActiveAt: true,
        },
      }),
      this.prisma.lesson.findMany({
        where: { status: PublicationStatus.IN_REVIEW },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 5,
        select: {
          id: true,
          slug: true,
          title: true,
          updatedAt: true,
          module: {
            select: {
              id: true,
              title: true,
              course: {
                select: {
                  id: true,
                  title: true,
                  learningPath: { select: { id: true, title: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      generatedAt: now,
      users: {
        total: totalUsers,
        newLast7Days: newUsers7d,
        activeLast7Days: activeUsers7d,
      },
      content: {
        learningPaths: statusCounts(pathStatuses),
        courses: statusCounts(courseStatuses),
        lessons: statusCounts(lessonStatuses),
        lessonsInReview,
      },
      learning: {
        completedLessons,
        submittedQuizAttempts: submittedAttempts,
        averageQuizScore:
          averageScore._avg.score === null ? null : Math.round(averageScore._avg.score),
        totalXp: totalXp._sum.totalXp ?? 0,
      },
      monetization: {
        activeSubscriptions,
        premiumEntitlements,
      },
      recentAudit,
      recentUsers,
      needsReview,
    };
  }

  async listUsers(query: ListUsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          emailVerifiedAt: true,
          onboardingCompletedAt: true,
          lastActiveAt: true,
          createdAt: true,
          stats: true,
          entitlement: true,
          _count: { select: { lessonProgress: true, quizAttempts: true, subscriptions: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        status: true,
        emailVerifiedAt: true,
        timeZone: true,
        locale: true,
        onboardingCompletedAt: true,
        lastActiveAt: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        profile: true,
        preferences: true,
        stats: true,
        entitlement: true,
        identities: { select: { provider: true, providerEmail: true, lastUsedAt: true } },
        subscriptions: {
          orderBy: [{ createdAt: 'desc' }],
          include: { plan: true },
        },
        lessonProgress: {
          orderBy: [{ lastAccessedAt: 'desc' }],
          take: 10,
          include: { lesson: { select: { id: true, slug: true, title: true } } },
        },
        quizAttempts: {
          orderBy: [{ startedAt: 'desc' }],
          take: 10,
          include: { quiz: { select: { id: true, slug: true, title: true } } },
        },
        deletionRequests: {
          orderBy: [{ requestedAt: 'desc' }],
          take: 5,
        },
      },
    });

    if (!user) {
      throw userNotFound();
    }

    return user;
  }

  async listSubscriptions(query: ListSubscriptionsQueryDto) {
    const where: Prisma.SubscriptionWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.planId ? { planId: query.planId } : {}),
      ...(query.search
        ? {
            user: {
              OR: [
                { email: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize,
        include: {
          user: { select: { id: true, email: true, name: true, status: true } },
          plan: true,
          entitlement: true,
          _count: { select: { purchases: true, billingEvents: true } },
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getSubscription(id: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true, status: true } },
        plan: true,
        entitlement: true,
        purchases: { orderBy: [{ createdAt: 'desc' }], take: 20 },
        billingEvents: { orderBy: [{ createdAt: 'desc' }], take: 20 },
      },
    });

    if (!subscription) {
      throw subscriptionNotFound();
    }

    return subscription;
  }

  async listPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { subscriptions: true } } },
    });

    return { items: plans };
  }

  async analytics(query: AnalyticsQueryDto) {
    const now = new Date();
    const end = startOfUtcDay(now);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (query.days - 1));

    const [
      activity,
      distinctLearners,
      newUsers,
      attempts,
      completedByLesson,
      xp,
      productEventRows,
    ] = await Promise.all([
      this.prisma.dailyActivity.groupBy({
        by: ['activityDate'],
        where: { activityDate: { gte: start, lte: end } },
        _sum: {
          lessonsCompleted: true,
          quizzesCompleted: true,
          minutesLearned: true,
          xpEarned: true,
        },
        _count: { _all: true },
        orderBy: { activityDate: 'asc' },
      }),
      this.prisma.dailyActivity.groupBy({
        by: ['userId'],
        where: { activityDate: { gte: start, lte: end } },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: start } },
        select: { createdAt: true },
      }),
      this.prisma.quizAttempt.aggregate({
        where: {
          status: QuizAttemptStatus.SUBMITTED,
          submittedAt: { gte: start },
        },
        _count: { _all: true },
        _avg: { score: true },
      }),
      this.prisma.lessonProgress.groupBy({
        by: ['lessonId'],
        where: { status: LessonProgressStatus.COMPLETED, completedAt: { gte: start } },
        _count: { _all: true },
      }),
      this.prisma.xPTransaction.aggregate({
        where: { createdAt: { gte: start } },
        _sum: { amount: true },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['name'],
        where: { createdAt: { gte: start } },
        _count: { _all: true },
      }),
    ]);

    const topCompleted = [...completedByLesson]
      .sort((left, right) => right._count._all - left._count._all)
      .slice(0, 5);
    const lessons = await this.prisma.lesson.findMany({
      where: { id: { in: topCompleted.map((row) => row.lessonId) } },
      select: { id: true, title: true, slug: true },
    });
    const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));

    const activityByDate = new Map(activity.map((row) => [dateKey(row.activityDate), row]));
    const newUsersByDate = new Map<string, number>();
    for (const user of newUsers) {
      const key = dateKey(user.createdAt);
      newUsersByDate.set(key, (newUsersByDate.get(key) ?? 0) + 1);
    }

    const daily: {
      date: string;
      activeLearners: number;
      newUsers: number;
      lessonsCompleted: number;
      quizzesCompleted: number;
      minutesLearned: number;
      xpEarned: number;
    }[] = [];
    for (let offset = 0; offset < query.days; offset += 1) {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + offset);
      const key = dateKey(day);
      const row = activityByDate.get(key);
      daily.push({
        date: key,
        activeLearners: row?._count._all ?? 0,
        newUsers: newUsersByDate.get(key) ?? 0,
        lessonsCompleted: row?._sum.lessonsCompleted ?? 0,
        quizzesCompleted: row?._sum.quizzesCompleted ?? 0,
        minutesLearned: row?._sum.minutesLearned ?? 0,
        xpEarned: row?._sum.xpEarned ?? 0,
      });
    }

    const topProductEvents = [...productEventRows]
      .sort((left, right) => right._count._all - left._count._all)
      .slice(0, 5)
      .map((row) => ({ name: row.name, count: row._count._all }));
    const productEventsTotal = productEventRows.reduce((sum, row) => sum + row._count._all, 0);

    return {
      range: { days: query.days, from: start, to: end },
      totals: {
        activeLearners: distinctLearners.length,
        newUsers: newUsers.length,
        lessonsCompleted: activity.reduce((sum, row) => sum + (row._sum.lessonsCompleted ?? 0), 0),
        quizzesCompleted: activity.reduce((sum, row) => sum + (row._sum.quizzesCompleted ?? 0), 0),
        minutesLearned: activity.reduce((sum, row) => sum + (row._sum.minutesLearned ?? 0), 0),
        xpEarned: xp._sum.amount ?? 0,
        submittedQuizAttempts: attempts._count._all,
        averageQuizScore: attempts._avg.score === null ? null : Math.round(attempts._avg.score),
      },
      topLessons: topCompleted.map((row) => ({
        lesson: lessonById.get(row.lessonId) ?? null,
        completions: row._count._all,
      })),
      productEvents: {
        total: productEventsTotal,
        top: topProductEvents,
      },
      daily,
    };
  }
}
