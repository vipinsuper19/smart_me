import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ApiException } from '../common/errors/api-error';
import { parseDateOnly } from '../common/utils/date-only';
import {
  DevicePlatform,
  LessonProgressStatus,
  NotificationType,
  PublicationStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { ReminderService } from './reminder.service';
import type {
  NotificationMessage,
  NotificationSendResult,
  NotificationSender,
} from './senders/notification-sender';

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDatabase = DATABASE_URL ? describe : describe.skip;

const baseConfig = {
  DATABASE_URL: DATABASE_URL ?? '',
  DATABASE_POOL_MAX: 5,
};

const NOW = new Date('2026-11-01T14:30:00.000Z'); // 20:00 in Asia/Kolkata

class FakeSender implements NotificationSender {
  messages: { token: string; message: NotificationMessage }[] = [];
  invalidTokens = new Set<string>();

  async send(token: string, message: NotificationMessage): Promise<NotificationSendResult> {
    this.messages.push({ token, message });
    if (this.invalidTokens.has(token)) {
      return { token, success: false, invalidToken: true, error: 'UNREGISTERED' };
    }
    return { token, success: true };
  }

  forToken(token: string) {
    return this.messages.filter((entry) => entry.token === token);
  }

  reset() {
    this.messages = [];
    this.invalidTokens.clear();
  }
}

describeIfDatabase('Notifications integration', () => {
  jest.setTimeout(30_000);

  let prisma: PrismaService;
  let notifications: NotificationsService;
  let reminders: ReminderService;
  let sender: FakeSender;
  let pathId: string;
  let publishedLessonId: string;
  let incompleteLessonId: string;
  const emails: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService(new ConfigService(baseConfig));
    await prisma.$connect();
    notifications = new NotificationsService(prisma);
    sender = new FakeSender();
    reminders = new ReminderService(
      prisma,
      new ConfigService({
        ...baseConfig,
        NOTIFICATIONS_ENABLED: true,
        NOTIFICATIONS_MAX_PER_DAY: 3,
      }),
      sender,
    );

    const suffix = randomUUID().slice(0, 8);
    const path = await prisma.learningPath.create({
      data: {
        slug: `notifications-test-${suffix}`,
        title: 'Notifications Test Path',
        description: 'Content used by notification integration tests.',
        status: PublicationStatus.PUBLISHED,
        order: 9_700,
      },
    });
    pathId = path.id;

    const course = await prisma.course.create({
      data: {
        learningPathId: path.id,
        slug: `notifications-course-${suffix}`,
        title: 'Notifications Course',
        shortDescription: 'A course for reminder tests.',
        status: PublicationStatus.PUBLISHED,
        order: 0,
      },
    });
    const module = await prisma.courseModule.create({
      data: {
        courseId: course.id,
        slug: `notifications-module-${suffix}`,
        title: 'Notifications Module',
        order: 0,
      },
    });

    const published = await prisma.lesson.create({
      data: {
        moduleId: module.id,
        slug: `notifications-published-${suffix}`,
        title: 'A brand new lesson',
        summary: 'Published recently so it is eligible for an announcement.',
        objective: 'Verify the new lesson announcement.',
        status: PublicationStatus.PUBLISHED,
        publishedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
        order: 0,
      },
    });
    publishedLessonId = published.id;

    const incomplete = await prisma.lesson.create({
      data: {
        moduleId: module.id,
        slug: `notifications-incomplete-${suffix}`,
        title: 'An unfinished lesson',
        summary: 'Used to verify the incomplete lesson reminder.',
        objective: 'Verify the incomplete lesson reminder.',
        status: PublicationStatus.PUBLISHED,
        publishedAt: new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000),
        order: 1,
      },
    });
    incompleteLessonId = incomplete.id;
  });

  afterEach(async () => {
    if (emails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
      emails.length = 0;
    }
    sender.reset();
  });

  afterAll(async () => {
    await prisma.learningPath.deleteMany({ where: { id: pathId } });
    await prisma.$disconnect();
  });

  async function createUser(timeZone = 'Asia/Kolkata'): Promise<{ id: string; email: string }> {
    const email = `notifications-test-${randomUUID()}@example.com`;
    emails.push(email);
    return prisma.user.create({
      data: { email, name: 'Notifications Test', timeZone },
    });
  }

  function dateOnly(value: string): Date {
    const parsed = parseDateOnly(value);
    if (!parsed) {
      throw new Error(`Invalid test date: ${value}`);
    }
    return parsed;
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

  it('creates default preferences on first read and updates them partially', async () => {
    const user = await createUser();

    const defaults = await notifications.getPreferences(user.id);
    expect(defaults).toMatchObject({
      dailyReminder: true,
      incompleteLessonReminder: true,
      streakReminder: true,
      newLessonAnnouncements: true,
      reminderTimeLocal: '19:00',
      timeZone: 'Asia/Kolkata',
    });

    const updated = await notifications.updatePreferences(user.id, {
      streakReminder: false,
      reminderTimeLocal: '07:30',
    });
    expect(updated).toMatchObject({
      dailyReminder: true,
      streakReminder: false,
      newLessonAnnouncements: true,
      reminderTimeLocal: '07:30',
    });

    await expectApiError(notifications.getPreferences('missing-user'), 'USER_NOT_FOUND', 404);
  });

  it('registers, masks, lists and removes device tokens', async () => {
    const user = await createUser();
    const token = `fcm-token-abcdefgh-${randomUUID()}`;

    const device = await notifications.registerDevice(user.id, {
      token,
      platform: DevicePlatform.ANDROID,
    });
    expect(device).toMatchObject({ tokenSuffix: token.slice(-8), isActive: true });

    const listed = await notifications.listDevices(user.id);
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0].id).toBe(device.id);
    expect(JSON.stringify(listed)).not.toContain(token);

    const again = await notifications.registerDevice(user.id, {
      token,
      platform: DevicePlatform.ANDROID,
    });
    expect(again.id).toBe(device.id);
    expect((await notifications.listDevices(user.id)).items).toHaveLength(1);

    await notifications.removeDevice(user.id, device.id);
    expect((await notifications.listDevices(user.id)).items).toHaveLength(0);
    await expectApiError(notifications.removeDevice(user.id, device.id), 'DEVICE_NOT_FOUND', 404);
  });

  it('moves a token to whichever account signed in last', async () => {
    const first = await createUser();
    const second = await createUser();
    const token = `fcm-token-move-${randomUUID()}`;

    await notifications.registerDevice(first.id, { token, platform: DevicePlatform.ANDROID });
    await notifications.registerDevice(second.id, { token, platform: DevicePlatform.ANDROID });

    expect((await notifications.listDevices(first.id)).items).toHaveLength(0);
    expect((await notifications.listDevices(second.id)).items).toHaveLength(1);
  });

  it('caps the number of active devices per learner', async () => {
    const user = await createUser();

    for (let index = 0; index < 10; index += 1) {
      await notifications.registerDevice(user.id, {
        token: `fcm-token-${index}-${randomUUID()}`,
        platform: DevicePlatform.ANDROID,
      });
    }

    await expectApiError(
      notifications.registerDevice(user.id, {
        token: `fcm-token-overflow-${randomUUID()}`,
        platform: DevicePlatform.ANDROID,
      }),
      'DEVICE_LIMIT_REACHED',
      422,
    );
  });

  it('delivers each due reminder once and records a delivery ledger', async () => {
    const user = await createUser();
    const token = `fcm-token-dispatch-${randomUUID()}`;
    await notifications.registerDevice(user.id, { token, platform: DevicePlatform.ANDROID });
    await notifications.updatePreferences(user.id, { reminderTimeLocal: '19:00' });
    await prisma.userStats.create({
      data: {
        userId: user.id,
        currentStreak: 5,
        lastLearningDate: dateOnly('2026-10-31'),
      },
    });
    await prisma.lessonProgress.create({
      data: {
        userId: user.id,
        lessonId: incompleteLessonId,
        status: LessonProgressStatus.IN_PROGRESS,
        progressPercent: 40,
        lastAccessedAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
    });

    const first = await reminders.run(NOW);
    expect(first.enabled).toBe(true);
    expect(sender.forToken(token)).toHaveLength(3);

    const types = await prisma.notificationDelivery.findMany({
      where: { userId: user.id },
      select: { type: true },
    });
    expect(new Set(types.map((row) => row.type))).toEqual(
      new Set([
        NotificationType.STREAK_REMINDER,
        NotificationType.INCOMPLETE_LESSON,
        NotificationType.NEW_LESSON_ANNOUNCEMENT,
      ]),
    );

    const second = await reminders.run(NOW);
    expect(sender.forToken(token)).toHaveLength(3);
    expect(second.notificationsSent).toBe(0);
  });

  it('does not disturb learners who already learned today', async () => {
    const user = await createUser();
    const token = `fcm-token-active-${randomUUID()}`;
    await notifications.registerDevice(user.id, { token, platform: DevicePlatform.ANDROID });
    await notifications.updatePreferences(user.id, {
      reminderTimeLocal: '19:00',
      newLessonAnnouncements: false,
    });
    await prisma.userStats.create({
      data: {
        userId: user.id,
        currentStreak: 5,
        lastLearningDate: dateOnly('2026-11-01'),
      },
    });
    await prisma.dailyActivity.create({
      data: { userId: user.id, activityDate: dateOnly('2026-11-01'), lessonsCompleted: 1 },
    });

    await reminders.run(NOW);

    expect(sender.forToken(token)).toHaveLength(0);
  });

  it('sends nothing when notifications are disabled', async () => {
    const disabled = new ReminderService(
      prisma,
      new ConfigService({ ...baseConfig, NOTIFICATIONS_ENABLED: false }),
      sender,
    );

    const summary = await disabled.run(NOW);

    expect(summary).toEqual({
      enabled: false,
      usersScanned: 0,
      notificationsSent: 0,
      invalidTokensDeactivated: 0,
    });
    expect(sender.messages).toHaveLength(0);
  });

  it('deactivates tokens that FCM reports as unregistered', async () => {
    const user = await createUser();
    const token = `fcm-token-invalid-${randomUUID()}`;
    await notifications.registerDevice(user.id, { token, platform: DevicePlatform.ANDROID });
    await notifications.updatePreferences(user.id, {
      reminderTimeLocal: '19:00',
      newLessonAnnouncements: false,
      incompleteLessonReminder: false,
    });
    sender.invalidTokens.add(token);

    const summary = await reminders.run(NOW);

    expect(summary.invalidTokensDeactivated).toBe(1);
    const devices = await notifications.listDevices(user.id);
    expect(devices.items[0].isActive).toBe(false);
    expect(await prisma.notificationDelivery.count({ where: { userId: user.id } })).toBe(0);
  });

  it('respects the per-day maximum across reminder families', async () => {
    const capped = new ReminderService(
      prisma,
      new ConfigService({
        ...baseConfig,
        NOTIFICATIONS_ENABLED: true,
        NOTIFICATIONS_MAX_PER_DAY: 1,
      }),
      sender,
    );
    const user = await createUser();
    const token = `fcm-token-capped-${randomUUID()}`;
    await notifications.registerDevice(user.id, { token, platform: DevicePlatform.ANDROID });
    await notifications.updatePreferences(user.id, { reminderTimeLocal: '19:00' });
    await prisma.userStats.create({
      data: {
        userId: user.id,
        currentStreak: 2,
        lastLearningDate: dateOnly('2026-10-31'),
      },
    });
    await prisma.lessonProgress.create({
      data: {
        userId: user.id,
        lessonId: incompleteLessonId,
        status: LessonProgressStatus.IN_PROGRESS,
        lastAccessedAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
    });

    await capped.run(NOW);

    const messages = sender.forToken(token);
    expect(messages).toHaveLength(1);
    expect(messages[0].message.data?.type).toBe(NotificationType.STREAK_REMINDER);
  });

  it('does not plan reminders before the configured local time', async () => {
    const user = await createUser();
    const token = `fcm-token-early-${randomUUID()}`;
    await notifications.registerDevice(user.id, { token, platform: DevicePlatform.ANDROID });
    await notifications.updatePreferences(user.id, {
      reminderTimeLocal: '23:00',
      newLessonAnnouncements: false,
    });

    await reminders.run(NOW);

    expect(sender.forToken(token)).toHaveLength(0);
    expect(await prisma.notificationDelivery.count({ where: { userId: user.id } })).toBe(0);
  });

  it('announces a lesson only once even across separate days', async () => {
    const user = await createUser();
    const token = `fcm-token-once-${randomUUID()}`;
    await notifications.registerDevice(user.id, { token, platform: DevicePlatform.ANDROID });
    await notifications.updatePreferences(user.id, {
      reminderTimeLocal: '19:00',
      dailyReminder: false,
      streakReminder: false,
      incompleteLessonReminder: false,
    });

    await reminders.run(NOW);
    const firstMessages = sender.forToken(token);
    expect(firstMessages).toHaveLength(1);
    expect(firstMessages[0].message.data?.type).toBe(NotificationType.NEW_LESSON_ANNOUNCEMENT);

    // The next day the lesson is outside the 24-hour announcement window, and
    // the ledger plus lesson-id history still stop any repeat delivery.
    sender.reset();
    const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    await reminders.run(tomorrow);
    expect(sender.forToken(token)).toHaveLength(0);

    const deliveries = await prisma.notificationDelivery.findMany({
      where: { userId: user.id, type: NotificationType.NEW_LESSON_ANNOUNCEMENT },
    });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].dedupeKey).toBe(publishedLessonId);
  });
});
