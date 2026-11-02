import { ContentLanguage, LearningGoal, ProficiencyLevel } from '../generated/prisma/enums';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface OnboardingOptions {
  learningGoals: SelectOption<LearningGoal>[];
  proficiencyLevels: SelectOption<ProficiencyLevel>[];
  explanationLanguages: SelectOption<ContentLanguage>[];
  dailyGoalMinutes: number[];
  interests: SelectOption<string>[];
}

/** Values in the persisted `UserPreference` enum columns. */
export const LEARNING_GOAL_OPTIONS: SelectOption<LearningGoal>[] = [
  { value: LearningGoal.IMPROVE_ENGLISH, label: 'Improve English' },
  { value: LearningGoal.INTERVIEW_PREPARATION, label: 'Prepare for interviews' },
  { value: LearningGoal.CAREER_SKILLS, label: 'Develop career skills' },
  {
    value: LearningGoal.CONFIDENCE_COMMUNICATION,
    label: 'Improve confidence and communication',
  },
];

export const PROFICIENCY_OPTIONS: SelectOption<ProficiencyLevel>[] = [
  { value: ProficiencyLevel.BEGINNER, label: 'Beginner' },
  { value: ProficiencyLevel.ELEMENTARY, label: 'Elementary' },
  { value: ProficiencyLevel.INTERMEDIATE, label: 'Intermediate' },
  { value: ProficiencyLevel.ADVANCED, label: 'Advanced' },
];

export const EXPLANATION_LANGUAGE_OPTIONS: SelectOption<ContentLanguage>[] = [
  { value: ContentLanguage.ENGLISH, label: 'English' },
  { value: ContentLanguage.HINDI, label: 'Hindi' },
  { value: ContentLanguage.HINGLISH, label: 'Hinglish' },
];

/** PRD daily-goal choices. */
export const DAILY_GOAL_OPTIONS = [5, 10, 15] as const;
export const DAILY_GOAL_VALUES: number[] = [...DAILY_GOAL_OPTIONS];
export type DailyGoalMinutes = (typeof DAILY_GOAL_OPTIONS)[number];

/**
 * Interests are intentionally a small curated taxonomy for MVP. The array is
 * stored as strings so content can add categories later without a join table.
 */
export const INTEREST_OPTIONS: SelectOption<string>[] = [
  { value: 'english-speaking', label: 'Everyday English' },
  { value: 'interviews', label: 'Interview preparation' },
  { value: 'workplace-communication', label: 'Workplace communication' },
  { value: 'money-basics', label: 'Money basics' },
  { value: 'confidence', label: 'Confidence and communication' },
];

export const INTEREST_VALUES: string[] = INTEREST_OPTIONS.map((option) => option.value);

export const ONBOARDING_OPTIONS: OnboardingOptions = {
  learningGoals: LEARNING_GOAL_OPTIONS,
  proficiencyLevels: PROFICIENCY_OPTIONS,
  explanationLanguages: EXPLANATION_LANGUAGE_OPTIONS,
  dailyGoalMinutes: [...DAILY_GOAL_OPTIONS],
  interests: INTEREST_OPTIONS,
};
