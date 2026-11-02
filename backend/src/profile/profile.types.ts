import type { User, UserPreference, UserProfile } from '../generated/prisma/client';
import { ContentLanguage, LearningGoal, ProficiencyLevel } from '../generated/prisma/enums';
import { formatDateOnly } from '../common/utils/date-only';
import { OnboardingOptions } from './profile.constants';

export interface ProfileDetailsView {
  headline: string | null;
  occupation: string | null;
  city: string | null;
  bio: string | null;
  dateOfBirth: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileView {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  timeZone: string;
  locale: string;
  onboardingCompletedAt: Date | null;
  createdAt: Date;
  profile: ProfileDetailsView;
}

export interface PreferencesView {
  learningGoal: LearningGoal | null;
  proficiency: ProficiencyLevel | null;
  explanationLanguage: ContentLanguage;
  dailyGoalMinutes: number;
  interests: string[];
  updatedAt: Date;
}

export interface OnboardingView {
  required: boolean;
  completedAt: Date | null;
  preferences: PreferencesView;
  options: OnboardingOptions;
}

export interface OnboardingCompletionView {
  completedAt: Date;
  preferences: PreferencesView;
}

export function toProfileView(user: User, profile: UserProfile): ProfileView {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    emailVerifiedAt: user.emailVerifiedAt,
    timeZone: user.timeZone,
    locale: user.locale,
    onboardingCompletedAt: user.onboardingCompletedAt,
    createdAt: user.createdAt,
    profile: {
      headline: profile.headline,
      occupation: profile.occupation,
      city: profile.city,
      bio: profile.bio,
      dateOfBirth: profile.dateOfBirth ? formatDateOnly(profile.dateOfBirth) : null,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    },
  };
}

export function toPreferencesView(preferences: UserPreference): PreferencesView {
  return {
    learningGoal: preferences.learningGoal,
    proficiency: preferences.proficiency,
    explanationLanguage: preferences.explanationLanguage,
    dailyGoalMinutes: preferences.dailyGoalMinutes,
    interests: preferences.interests,
    updatedAt: preferences.updatedAt,
  };
}
