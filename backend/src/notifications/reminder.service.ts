import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isPrismaErrorWithCode } from '../common/prisma/prisma-errors';
import { formatDateOnly, parseDateOnly } from '../common/utils/date-only';
import { localDateKey } from '../gamification/date-zone';
import {
  LessonProgressStatus,
  NotificationType,
  PublicationStatus,
  UserStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { planReminders } from './reminder-planner';
import type { ReminderHistory } from './reminder-planner';
import { NOTIFICATION_SENDER } from './senders/notification-sender';
import type { NotificationSender } from './senders/notification-sender';
import type { ReminderRunSummary } from './notifications.types';

const INCOMPLETE_AFTER_MS = 24 * 60 * 60 * 1000;
const NEW_LESSON_WINDOW_MS = 24 * 60 * 60 * 1000;
const NEW_LESSON_LIMIT = 20;
const USER_BATCH_SIZE = 100;

const DEFAULT_FLAGS = {
  dailyReminder: true,
  incompleteLessonReminder: true,
  streakReminder: true,
  newLessonAnnouncements: true,
} as const;

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(NOTIFICATION_SENDER) private readonly sender: NotificationSender,
  ) {}

  get enabled(): boolean {
    return this.config.get<boolean>('NOTIFICATIONS_ENABLED') === true;
  }

  /**
   * Plans and delivers every reminder that is due. Safe to call repeatedly:
   * the delivery ledger and the per-day cap make repeated ticks idempotent.
   */
  async run(now = new Date()): Promise<ReminderRunSummary> {
    const summary: ReminderRunSummary = {
      enabled: this.enabled,
      usersScanned: 0,
      notificationsSent: 0,
      invalidTokensDeactivated: 0,
    };

    if (!this.enabled) {
      return summary;
    }

    const maxPerDay = this.config.get<number>('NOTIFICATIONS_MAX_PER_DAY') ?? 2;
    const newLessons = await this.prisma.lesson.findMany({
      where: {
        status: PublicationStatus.PUBLISHED,
        publishedAt: {
          gte: new Date(now.getTime() - NEW_LESSON_WINDOW_MS),
          lte: now,
        },
      },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: NEW_LESSON_LIMIT,
      select: { id: true, title: true },
    });
    const newLessonIds = newLessons.map((lesson) => lesson.id);

    let cursor: string | undefined;
    for (;;) {
      const users = await this.prisma.user.findMany({
        where: {
          status: UserStatus.ACTIVE,
          deletedAt: null,
          deviceTokens: { some: { isActive: true } },
        },
        orderBy: { id: 'asc' },
        take: USER_BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          timeZone: true,
          notificationPreference: true,
          stats: { select: { currentStreak: true, lastLearningDate: true } },
          deviceTokens: { where: { isActive: true }, select: { token: true } },
        },
      });

      if (users.length === 0) {
        break;
      }

      cursor = users[users.length - 1].id;

      for (const user of users) {
        summary.usersScanned += 1;
        await this.processUser(user, now, maxPerDay, newLessons, newLessonIds, summary);
      }

      if (users.length < USER_BATCH_SIZE) {
        break;
      }
    }

    return summary;
  }

  private async processUser(
    user: {
      id: string;
      timeZone: string;
      notificationPreference: {
        dailyReminder: boolean;
        incompleteLessonReminder: boolean;
        streakReminder: boolean;
        newLessonAnnouncements: boolean;
        reminderTimeLocal: string;
      } | null;
      stats: { currentStreak: number; lastLearningDate: Date | null } | null;
      deviceTokens: { token: string }[];
    },
    now: Date,
    maxPerDay: number,
    newLessons: { id: string; title: string }[],
    newLessonIds: string[],
    summary: ReminderRunSummary,
  ): Promise<void> {
    const today = localDateKey(now, user.timeZone);
    const activityDate = parseDateOnly(today);
    const prefs = user.notificationPreference;

    const [activity, deliveriesToday, incomplete, announced] = await Promise.all([
      activityDate
        ? this.prisma.dailyActivity.findUnique({
            where: { userId_activityDate: { userId: user.id, activityDate } },
            select: { lessonsCompleted: true, quizzesCompleted: true, minutesLearned: true },
          })
        : Promise.resolve(null),
      this.prisma.notificationDelivery.findMany({
        where: { userId: user.id, localDate: today },
        select: { type: true, dedupeKey: true },
      }),
      this.prisma.lessonProgress.findFirst({
        where: {
          userId: user.id,
          status: LessonProgressStatus.IN_PROGRESS,
          lastAccessedAt: { lte: new Date(now.getTime() - INCOMPLETE_AFTER_MS) },
          lesson: { status: PublicationStatus.PUBLISHED },
        },
        orderBy: [{ lastAccessedAt: 'desc' }, { id: 'desc' }],
        select: { lessonId: true, lesson: { select: { title: true } } },
      }),
      newLessonIds.length > 0
        ? this.prisma.notificationDelivery.findMany({
            where: {
              userId: user.id,
              type: NotificationType.NEW_LESSON_ANNOUNCEMENT,
              dedupeKey: { in: newLessonIds },
            },
            select: { dedupeKey: true },
          })
        : Promise.resolve([]),
    ]);

    const history: ReminderHistory = {
      sentToday: deliveriesToday.length,
      deliveredKeys: new Set(
        deliveriesToday.map((delivery) => `${delivery.type}:${delivery.dedupeKey}`),
      ),
      newLessonAnnouncedToday: deliveriesToday.some(
        (delivery) => delivery.type === NotificationType.NEW_LESSON_ANNOUNCEMENT,
      ),
      announcedLessonIds: new Set(announced.map((delivery) => delivery.dedupeKey)),
    };

    const learnedToday =
      (user.stats?.lastLearningDate
        ? formatDateOnly(user.stats.lastLearningDate) === today
        : false) ||
      Boolean(
        activity &&
        (activity.lessonsCompleted > 0 ||
          activity.quizzesCompleted > 0 ||
          activity.minutesLearned > 0),
      );

    const planned = planReminders({
      now,
      timeZone: user.timeZone,
      reminderTimeLocal: prefs?.reminderTimeLocal ?? '19:00',
      preferences: prefs ?? DEFAULT_FLAGS,
      currentStreak: user.stats?.currentStreak ?? 0,
      learnedToday,
      incompleteLesson: incomplete
        ? { id: incomplete.lessonId, title: incomplete.lesson.title }
        : null,
      newLessons,
      history,
      maxPerDay,
    });

    for (const reminder of planned) {
      const tokens = user.deviceTokens.map((device) => device.token);
      if (tokens.length === 0) {
        continue;
      }

      let results;
      try {
        results = await Promise.all(
          tokens.map((token) =>
            this.sender.send(token, {
              title: reminder.title,
              body: reminder.body,
              data: { type: reminder.type },
            }),
          ),
        );
      } catch (error) {
        this.logger.warn(
          `Reminder ${reminder.type} for ${user.id} could not be sent: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        continue;
      }

      const invalid = results.filter((result) => !result.success && result.invalidToken);
      if (invalid.length > 0) {
        await this.prisma.deviceToken.updateMany({
          where: { token: { in: invalid.map((result) => result.token) } },
          data: { isActive: false },
        });
        summary.invalidTokensDeactivated += invalid.length;
      }

      const delivered = results.filter((result) => result.success).length;
      if (delivered === 0) {
        continue;
      }

      try {
        await this.prisma.notificationDelivery.create({
          data: {
            userId: user.id,
            type: reminder.type,
            dedupeKey: reminder.dedupeKey,
            localDate: today,
            title: reminder.title,
            body: reminder.body,
            deviceCount: delivered,
          },
        });
        summary.notificationsSent += 1;
      } catch (error) {
        // A concurrent tick already recorded this reminder.
        if (!isPrismaErrorWithCode(error, 'P2002')) {
          throw error;
        }
      }
    }
  }
}
