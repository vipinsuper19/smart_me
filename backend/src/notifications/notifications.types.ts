import type { DevicePlatform, NotificationType } from '../generated/prisma/enums';

export interface NotificationPreferenceView {
  dailyReminder: boolean;
  incompleteLessonReminder: boolean;
  streakReminder: boolean;
  newLessonAnnouncements: boolean;
  /** Local wall-clock time, `HH:MM` (24-hour). */
  reminderTimeLocal: string;
  /** IANA zone used to interpret `reminderTimeLocal`. */
  timeZone: string;
  updatedAt: Date | null;
}

export interface DeviceTokenView {
  id: string;
  platform: DevicePlatform;
  /** Last eight characters only; the full token is never returned. */
  tokenSuffix: string;
  isActive: boolean;
  lastSeenAt: Date;
  createdAt: Date;
}

export interface ReminderRunSummary {
  enabled: boolean;
  usersScanned: number;
  notificationsSent: number;
  invalidTokensDeactivated: number;
}

export interface ReminderPreferenceFlags {
  dailyReminder: boolean;
  incompleteLessonReminder: boolean;
  streakReminder: boolean;
  newLessonAnnouncements: boolean;
}

export interface PlannedReminder {
  type: NotificationType;
  dedupeKey: string;
  title: string;
  body: string;
}
