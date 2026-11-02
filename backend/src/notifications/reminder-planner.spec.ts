import { NotificationType } from '../generated/prisma/enums';
import { planReminders } from './reminder-planner';
import type { ReminderPlanInput } from './reminder-planner';

const NOW = new Date('2026-11-01T14:30:00.000Z'); // 20:00 in Asia/Kolkata
const TODAY = '2026-11-01';

const allEnabled = {
  dailyReminder: true,
  incompleteLessonReminder: true,
  streakReminder: true,
  newLessonAnnouncements: true,
};

function input(overrides: Partial<ReminderPlanInput> = {}): ReminderPlanInput {
  return {
    now: NOW,
    timeZone: 'Asia/Kolkata',
    reminderTimeLocal: '19:00',
    preferences: allEnabled,
    currentStreak: 0,
    learnedToday: false,
    incompleteLesson: null,
    newLessons: [],
    history: {
      sentToday: 0,
      deliveredKeys: new Set<string>(),
      newLessonAnnouncedToday: false,
      announcedLessonIds: new Set<string>(),
    },
    maxPerDay: 3,
    ...overrides,
  };
}

describe('planReminders', () => {
  it('plans nothing before the learner reminder time', () => {
    expect(planReminders(input({ reminderTimeLocal: '21:00' }))).toEqual([]);
  });

  it('plans at exactly the reminder time', () => {
    const planned = planReminders(input({ reminderTimeLocal: '20:00' }));
    expect(planned).toHaveLength(1);
    expect(planned[0].type).toBe(NotificationType.DAILY_REMINDER);
  });

  it('sends a daily reminder with no streak or recent activity', () => {
    const planned = planReminders(input());
    expect(planned).toEqual([
      {
        type: NotificationType.DAILY_REMINDER,
        dedupeKey: TODAY,
        title: 'A few minutes for you?',
        body: 'Pick up a short lesson and make today count.',
      },
    ]);
  });

  it('prefers a streak reminder over the generic daily nudge', () => {
    const planned = planReminders(input({ currentStreak: 4 }));
    expect(planned).toHaveLength(1);
    expect(planned[0]).toMatchObject({
      type: NotificationType.STREAK_REMINDER,
      dedupeKey: TODAY,
      title: 'Keep your streak alive',
    });
  });

  it('does not nudge a learner who already learned today', () => {
    const planned = planReminders(
      input({ currentStreak: 4, learnedToday: true, incompleteLesson: null }),
    );
    expect(planned).toEqual([]);
  });

  it('does not repeat a reminder already delivered today', () => {
    const planned = planReminders(
      input({
        history: { ...input().history, deliveredKeys: new Set([`DAILY_REMINDER:${TODAY}`]) },
      }),
    );
    expect(planned).toEqual([]);
  });

  it('adds a single incomplete-lesson reminder and truncates long titles', () => {
    const longTitle = 'A'.repeat(120);
    const planned = planReminders(
      input({ incompleteLesson: { id: 'lesson_1', title: longTitle } }),
    );

    const incomplete = planned.find(
      (reminder) => reminder.type === NotificationType.INCOMPLETE_LESSON,
    );
    expect(incomplete).toBeDefined();
    expect(incomplete?.dedupeKey).toBe(`lesson_1:${TODAY}`);
    const shortened = `${'A'.repeat(79)}…`;
    expect(incomplete?.body).toBe(`Finish “${shortened}” in a few minutes.`);
    expect(incomplete?.body).toHaveLength('Finish “” in a few minutes.'.length + shortened.length);
  });

  it('skips the incomplete reminder when the preference is off', () => {
    const planned = planReminders(
      input({
        preferences: { ...allEnabled, incompleteLessonReminder: false },
        incompleteLesson: { id: 'lesson_1', title: 'Finish me' },
      }),
    );
    expect(planned.map((reminder) => reminder.type)).not.toContain(
      NotificationType.INCOMPLETE_LESSON,
    );
  });

  it('announces one unseen new lesson per day', () => {
    const planned = planReminders(
      input({
        newLessons: [
          { id: 'lesson_old', title: 'Already announced' },
          { id: 'lesson_new', title: 'Fresh lesson' },
        ],
        history: {
          ...input().history,
          announcedLessonIds: new Set(['lesson_old']),
        },
      }),
    );

    const announcement = planned.find(
      (reminder) => reminder.type === NotificationType.NEW_LESSON_ANNOUNCEMENT,
    );
    expect(announcement).toMatchObject({
      dedupeKey: 'lesson_new',
      title: 'New lesson available',
    });
    expect(announcement?.body).toContain('Fresh lesson');
  });

  it('does not announce a second lesson on the same day', () => {
    const planned = planReminders(
      input({
        newLessons: [{ id: 'lesson_new', title: 'Fresh lesson' }],
        history: { ...input().history, newLessonAnnouncedToday: true },
      }),
    );
    expect(planned.map((reminder) => reminder.type)).not.toContain(
      NotificationType.NEW_LESSON_ANNOUNCEMENT,
    );
  });

  it('respects the per-day cap across reminder types', () => {
    const planned = planReminders(
      input({
        maxPerDay: 1,
        currentStreak: 3,
        incompleteLesson: { id: 'lesson_1', title: 'Finish me' },
        newLessons: [{ id: 'lesson_new', title: 'Fresh lesson' }],
      }),
    );
    expect(planned).toHaveLength(1);
    expect(planned[0].type).toBe(NotificationType.STREAK_REMINDER);
  });

  it('plans nothing when the cap has already been reached', () => {
    const planned = planReminders(
      input({
        maxPerDay: 2,
        history: { ...input().history, sentToday: 2 },
      }),
    );
    expect(planned).toEqual([]);
  });

  it('plans nothing when every reminder family is disabled', () => {
    const planned = planReminders(
      input({
        preferences: {
          dailyReminder: false,
          incompleteLessonReminder: false,
          streakReminder: false,
          newLessonAnnouncements: false,
        },
        incompleteLesson: { id: 'lesson_1', title: 'Finish me' },
        newLessons: [{ id: 'lesson_new', title: 'Fresh lesson' }],
      }),
    );
    expect(planned).toEqual([]);
  });

  it('orders reminders streak, incomplete, then announcement', () => {
    const planned = planReminders(
      input({
        currentStreak: 2,
        incompleteLesson: { id: 'lesson_1', title: 'Finish me' },
        newLessons: [{ id: 'lesson_new', title: 'Fresh lesson' }],
      }),
    );
    expect(planned.map((reminder) => reminder.type)).toEqual([
      NotificationType.STREAK_REMINDER,
      NotificationType.INCOMPLETE_LESSON,
      NotificationType.NEW_LESSON_ANNOUNCEMENT,
    ]);
  });
});
