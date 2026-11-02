import { localTimeKey } from '../common/utils/time-zone';
import { localDateKey } from '../gamification/date-zone';
import { NotificationType } from '../generated/prisma/enums';
import type { PlannedReminder, ReminderPreferenceFlags } from './notifications.types';

const MAX_TITLE_IN_BODY = 80;

export interface ReminderHistory {
  sentToday: number;
  /** Keys already delivered today, as `${type}:${dedupeKey}`. */
  deliveredKeys: Set<string>;
  newLessonAnnouncedToday: boolean;
  /** Lessons ever announced to this learner, regardless of date. */
  announcedLessonIds: Set<string>;
}

export interface ReminderPlanInput {
  now: Date;
  timeZone: string;
  reminderTimeLocal: string;
  preferences: ReminderPreferenceFlags;
  currentStreak: number;
  learnedToday: boolean;
  incompleteLesson: { id: string; title: string } | null;
  newLessons: { id: string; title: string }[];
  history: ReminderHistory;
  maxPerDay: number;
}

function alreadyDelivered(
  history: ReminderHistory,
  type: NotificationType,
  dedupeKey: string,
): boolean {
  return history.deliveredKeys.has(`${type}:${dedupeKey}`);
}

function shorten(title: string): string {
  const trimmed = title.trim();
  return trimmed.length > MAX_TITLE_IN_BODY
    ? `${trimmed.slice(0, MAX_TITLE_IN_BODY - 1)}…`
    : trimmed;
}

/**
 * Pure reminder planner.
 *
 * Rules:
 * - Nothing is planned before the learner's local reminder time.
 * - A learner who already completed an eligible activity today gets nothing.
 * - One streak/daily nudge per local day, one incomplete-lesson nudge per lesson
 *   per day, and at most one new-lesson announcement per day.
 * - The global daily cap is respected across all types.
 * - Copy never includes a name, email, score or other personal data.
 */
export function planReminders(input: ReminderPlanInput): PlannedReminder[] {
  const localTime = localTimeKey(input.now, input.timeZone);
  if (localTime < input.reminderTimeLocal) {
    return [];
  }

  const today = localDateKey(input.now, input.timeZone);
  const remaining = input.maxPerDay - input.history.sentToday;
  if (remaining <= 0) {
    return [];
  }

  const planned: PlannedReminder[] = [];

  if (!input.learnedToday) {
    const canStreak = input.currentStreak > 0 && input.preferences.streakReminder;
    const canDaily = input.preferences.dailyReminder;

    if (canStreak && !alreadyDelivered(input.history, NotificationType.STREAK_REMINDER, today)) {
      planned.push({
        type: NotificationType.STREAK_REMINDER,
        dedupeKey: today,
        title: 'Keep your streak alive',
        body: 'A few minutes of learning keeps your momentum going.',
      });
    } else if (
      canDaily &&
      !alreadyDelivered(input.history, NotificationType.DAILY_REMINDER, today)
    ) {
      planned.push({
        type: NotificationType.DAILY_REMINDER,
        dedupeKey: today,
        title: 'A few minutes for you?',
        body: 'Pick up a short lesson and make today count.',
      });
    }
  }

  const incomplete = input.incompleteLesson;
  if (
    incomplete &&
    input.preferences.incompleteLessonReminder &&
    !alreadyDelivered(
      input.history,
      NotificationType.INCOMPLETE_LESSON,
      `${incomplete.id}:${today}`,
    )
  ) {
    planned.push({
      type: NotificationType.INCOMPLETE_LESSON,
      dedupeKey: `${incomplete.id}:${today}`,
      title: 'Continue where you left off',
      body: `Finish “${shorten(incomplete.title)}” in a few minutes.`,
    });
  }

  if (input.preferences.newLessonAnnouncements && !input.history.newLessonAnnouncedToday) {
    const nextLesson = input.newLessons.find(
      (lesson) => !input.history.announcedLessonIds.has(lesson.id),
    );
    if (nextLesson) {
      planned.push({
        type: NotificationType.NEW_LESSON_ANNOUNCEMENT,
        dedupeKey: nextLesson.id,
        title: 'New lesson available',
        body: `“${shorten(nextLesson.title)}” just landed. Take a look when you have a moment.`,
      });
    }
  }

  return planned.slice(0, remaining);
}
