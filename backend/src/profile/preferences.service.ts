import { Injectable } from '@nestjs/common';
import { validationError } from '../common/errors/validation-error';
import { isPrismaErrorWithCode } from '../common/prisma/prisma-errors';
import { parseDateOnly } from '../common/utils/date-only';
import { localDateKey } from '../gamification/date-zone';
import type { Prisma, UserPreference } from '../generated/prisma/client';
import { ContentLanguage, LearningGoal, ProficiencyLevel } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { DAILY_GOAL_VALUES, INTEREST_VALUES, ONBOARDING_OPTIONS } from './profile.constants';
import { userNotFound } from './profile.errors';
import {
  OnboardingCompletionView,
  OnboardingView,
  PreferencesView,
  toPreferencesView,
} from './profile.types';

interface PreferenceUpdateData {
  learningGoal?: LearningGoal | null;
  proficiency?: ProficiencyLevel | null;
  explanationLanguage?: ContentLanguage;
  dailyGoalMinutes?: number;
  interests?: string[];
}

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(userId: string): Promise<PreferencesView> {
    return toPreferencesView(await this.upsertPreferences(userId, {}));
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto): Promise<PreferencesView> {
    const data = this.preferenceData(dto);
    const goalMinutes = data.dailyGoalMinutes;

    if (goalMinutes === undefined) {
      return toPreferencesView(await this.upsertPreferences(userId, data));
    }

    const now = new Date();
    const preferences = await this.prisma
      .$transaction(async (tx) => {
        const updated = await tx.userPreference.upsert({
          where: { userId },
          update: data,
          create: { userId, ...data },
        });

        await this.syncTodayDailyGoal(tx, userId, goalMinutes, now);
        return updated;
      })
      .catch((error: unknown) => {
        throw this.mapMissingUserError(error);
      });

    return toPreferencesView(preferences);
  }

  async getOnboarding(userId: string): Promise<OnboardingView> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingCompletedAt: true },
    });

    if (!user) {
      throw userNotFound();
    }

    return {
      required: user.onboardingCompletedAt === null,
      completedAt: user.onboardingCompletedAt,
      preferences: await this.getPreferences(userId),
      options: ONBOARDING_OPTIONS,
    };
  }

  async completeOnboarding(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<OnboardingCompletionView> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingCompletedAt: true },
    });

    if (!user) {
      throw userNotFound();
    }

    const data = this.preferenceData(dto);
    const goalMinutes = data.dailyGoalMinutes;
    const now = new Date();

    const result = await this.prisma
      .$transaction(async (tx) => {
        const preferences = await tx.userPreference.upsert({
          where: { userId },
          update: data,
          create: { userId, ...data },
        });

        if (goalMinutes !== undefined) {
          await this.syncTodayDailyGoal(tx, userId, goalMinutes, now);
        }

        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { onboardingCompletedAt: user.onboardingCompletedAt ?? now },
        });

        return { preferences, updatedUser };
      })
      .catch((error: unknown) => {
        throw this.mapMissingUserError(error);
      });

    return {
      completedAt: result.updatedUser.onboardingCompletedAt ?? now,
      preferences: toPreferencesView(result.preferences),
    };
  }

  private async upsertPreferences(
    userId: string,
    data: PreferenceUpdateData,
  ): Promise<UserPreference> {
    try {
      return await this.prisma.userPreference.upsert({
        where: { userId },
        update: data,
        create: { userId, ...data },
      });
    } catch (error) {
      throw this.mapMissingUserError(error);
    }
  }

  /**
   * Today's goal is snapshotted on `daily_activity`, so a preference change
   * must also refresh the current day or the app keeps showing the old target
   * until tomorrow. Past days stay untouched on purpose: they record the goal
   * that was in force at the time.
   */
  private async syncTodayDailyGoal(
    tx: Prisma.TransactionClient,
    userId: string,
    goalMinutes: number,
    now: Date,
  ): Promise<void> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { timeZone: true },
    });

    if (!user) {
      throw userNotFound();
    }

    const today = parseDateOnly(localDateKey(now, user.timeZone));
    if (!today) {
      return;
    }

    const where = { userId_activityDate: { userId, activityDate: today } };
    const activity = await tx.dailyActivity.findUnique({
      where,
      select: { minutesLearned: true },
    });

    if (!activity) {
      return;
    }

    await tx.dailyActivity.update({
      where,
      data: {
        dailyGoalMinutes: goalMinutes,
        goalMet: activity.minutesLearned >= goalMinutes,
      },
    });
  }

  private mapMissingUserError(error: unknown): unknown {
    if (isPrismaErrorWithCode(error, 'P2003') || isPrismaErrorWithCode(error, 'P2025')) {
      return userNotFound();
    }

    return error;
  }

  /**
   * Business invariants live here as well as in the DTO so future internal
   * callers cannot persist values the API would reject.
   */
  private preferenceData(dto: UpdatePreferencesDto): PreferenceUpdateData {
    const data: PreferenceUpdateData = {};

    if (dto.learningGoal !== undefined) {
      data.learningGoal = dto.learningGoal;
    }

    if (dto.proficiency !== undefined) {
      data.proficiency = dto.proficiency;
    }

    if (dto.explanationLanguage !== undefined) {
      if (!dto.explanationLanguage) {
        throw validationError('explanationLanguage', 'explanationLanguage is required.');
      }
      data.explanationLanguage = dto.explanationLanguage;
    }

    if (dto.dailyGoalMinutes !== undefined) {
      if (!DAILY_GOAL_VALUES.includes(dto.dailyGoalMinutes)) {
        throw validationError('dailyGoalMinutes', 'dailyGoalMinutes must be 5, 10 or 15.');
      }
      data.dailyGoalMinutes = dto.dailyGoalMinutes;
    }

    if (dto.interests !== undefined) {
      if (!Array.isArray(dto.interests)) {
        throw validationError('interests', 'interests must be an array.');
      }

      const interests = dto.interests.map((interest) =>
        typeof interest === 'string' ? interest.trim().toLowerCase() : '',
      );

      if (interests.length > INTEREST_VALUES.length) {
        throw validationError('interests', `Select at most ${INTEREST_VALUES.length} interests.`);
      }

      if (new Set(interests).size !== interests.length) {
        throw validationError('interests', 'interests must not contain duplicates.');
      }

      if (interests.some((interest) => !INTEREST_VALUES.includes(interest))) {
        throw validationError('interests', 'One or more interests are not supported.');
      }

      data.interests = interests;
    }

    return data;
  }
}
