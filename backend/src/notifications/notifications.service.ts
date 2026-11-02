import { Injectable } from '@nestjs/common';
import { isPrismaErrorWithCode } from '../common/prisma/prisma-errors';
import type { DeviceToken, NotificationPreference } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { userNotFound } from '../profile/profile.errors';
import { RegisterDeviceDto, UpdateNotificationPreferencesDto } from './dto/notifications.dto';
import { deviceLimitReached, deviceTokenNotFound } from './notifications.errors';
import type { DeviceTokenView, NotificationPreferenceView } from './notifications.types';

/** Enough for a phone, tablet, reinstall and a spare without unbounded tokens. */
const MAX_ACTIVE_DEVICES = 10;

interface NotificationPreferenceData {
  dailyReminder?: boolean;
  incompleteLessonReminder?: boolean;
  streakReminder?: boolean;
  newLessonAnnouncements?: boolean;
  reminderTimeLocal?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(userId: string): Promise<NotificationPreferenceView> {
    const user = await this.requireUser(userId);
    const preferences = await this.upsertPreferences(userId, {});
    return this.toPreferenceView(preferences, user.timeZone);
  }

  async updatePreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferenceView> {
    const user = await this.requireUser(userId);

    const data: NotificationPreferenceData = {};

    if (dto.dailyReminder !== undefined) {
      data.dailyReminder = dto.dailyReminder;
    }
    if (dto.incompleteLessonReminder !== undefined) {
      data.incompleteLessonReminder = dto.incompleteLessonReminder;
    }
    if (dto.streakReminder !== undefined) {
      data.streakReminder = dto.streakReminder;
    }
    if (dto.newLessonAnnouncements !== undefined) {
      data.newLessonAnnouncements = dto.newLessonAnnouncements;
    }
    if (dto.reminderTimeLocal !== undefined) {
      data.reminderTimeLocal = dto.reminderTimeLocal;
    }

    const preferences = await this.upsertPreferences(userId, data);
    return this.toPreferenceView(preferences, user.timeZone);
  }

  async listDevices(userId: string): Promise<{ items: DeviceTokenView[] }> {
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId },
      orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
    });

    return { items: devices.map((device) => this.toDeviceView(device)) };
  }

  /**
   * Registers or refreshes an FCM token. Tokens are globally unique, so a token
   * that signs into a different account is moved rather than duplicated.
   */
  async registerDevice(userId: string, dto: RegisterDeviceDto): Promise<DeviceTokenView> {
    const now = new Date();
    const existing = await this.prisma.deviceToken.findUnique({
      where: { token: dto.token },
    });

    if (existing) {
      if (existing.userId !== userId) {
        await this.assertDeviceCapacity(userId);
      }

      const updated = await this.prisma.deviceToken.update({
        where: { id: existing.id },
        data: {
          userId,
          platform: dto.platform,
          isActive: true,
          lastSeenAt: now,
        },
      });
      return this.toDeviceView(updated);
    }

    await this.assertDeviceCapacity(userId);

    try {
      const created = await this.prisma.deviceToken.create({
        data: {
          userId,
          token: dto.token,
          platform: dto.platform,
          lastSeenAt: now,
        },
      });
      return this.toDeviceView(created);
    } catch (error) {
      if (isPrismaErrorWithCode(error, 'P2003') || isPrismaErrorWithCode(error, 'P2025')) {
        throw userNotFound();
      }
      throw error;
    }
  }

  async removeDevice(userId: string, deviceId: string): Promise<void> {
    const deleted = await this.prisma.deviceToken.deleteMany({
      where: { id: deviceId, userId },
    });

    if (deleted.count === 0) {
      throw deviceTokenNotFound();
    }
  }

  private async assertDeviceCapacity(userId: string): Promise<void> {
    const active = await this.prisma.deviceToken.count({
      where: { userId, isActive: true },
    });

    if (active >= MAX_ACTIVE_DEVICES) {
      throw deviceLimitReached();
    }
  }

  private async requireUser(userId: string): Promise<{ timeZone: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timeZone: true },
    });

    if (!user) {
      throw userNotFound();
    }

    return user;
  }

  private async upsertPreferences(
    userId: string,
    data: NotificationPreferenceData,
  ): Promise<NotificationPreference> {
    try {
      return await this.prisma.notificationPreference.upsert({
        where: { userId },
        update: data,
        create: { userId, ...data },
      });
    } catch (error) {
      if (isPrismaErrorWithCode(error, 'P2003') || isPrismaErrorWithCode(error, 'P2025')) {
        throw userNotFound();
      }
      throw error;
    }
  }

  private toPreferenceView(
    preferences: NotificationPreference,
    timeZone: string,
  ): NotificationPreferenceView {
    return {
      dailyReminder: preferences.dailyReminder,
      incompleteLessonReminder: preferences.incompleteLessonReminder,
      streakReminder: preferences.streakReminder,
      newLessonAnnouncements: preferences.newLessonAnnouncements,
      reminderTimeLocal: preferences.reminderTimeLocal,
      timeZone,
      updatedAt: preferences.updatedAt,
    };
  }

  private toDeviceView(device: DeviceToken): DeviceTokenView {
    return {
      id: device.id,
      platform: device.platform,
      tokenSuffix: device.token.slice(-8),
      isActive: device.isActive,
      lastSeenAt: device.lastSeenAt,
      createdAt: device.createdAt,
    };
  }
}
