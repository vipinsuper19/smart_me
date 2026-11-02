import { Injectable } from '@nestjs/common';
import { validationError } from '../common/errors/validation-error';
import { isPrismaErrorWithCode } from '../common/prisma/prisma-errors';
import { parseDateOnly } from '../common/utils/date-only';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { userNotFound } from './profile.errors';
import { ProfileView, toProfileView } from './profile.types';

interface UserUpdateData {
  name?: string | null;
  avatarUrl?: string | null;
}

interface ProfileUpdateData {
  headline?: string | null;
  occupation?: string | null;
  city?: string | null;
  bio?: string | null;
  dateOfBirth?: Date | null;
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<ProfileView> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw userNotFound();
    }

    let profile = user.profile;
    if (!profile) {
      try {
        profile = await this.prisma.userProfile.upsert({
          where: { userId },
          update: {},
          create: { userId },
        });
      } catch (error) {
        throw this.mapMissingUserError(error);
      }
    }

    return toProfileView(user, profile);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileView> {
    const userData: UserUpdateData = {};
    if (dto.name !== undefined) {
      userData.name = this.cleanText(dto.name);
    }
    if (dto.avatarUrl !== undefined) {
      userData.avatarUrl = this.cleanUrl(dto.avatarUrl);
    }

    const profileData: ProfileUpdateData = {};
    if (dto.headline !== undefined) {
      profileData.headline = this.cleanText(dto.headline);
    }
    if (dto.occupation !== undefined) {
      profileData.occupation = this.cleanText(dto.occupation);
    }
    if (dto.city !== undefined) {
      profileData.city = this.cleanText(dto.city);
    }
    if (dto.bio !== undefined) {
      profileData.bio = this.cleanText(dto.bio);
    }
    if (dto.dateOfBirth !== undefined) {
      profileData.dateOfBirth = this.parseDateOfBirth(dto.dateOfBirth);
    }

    const hasUserChanges = Object.keys(userData).length > 0;
    const hasProfileChanges = Object.keys(profileData).length > 0;

    if (hasUserChanges || hasProfileChanges) {
      try {
        await this.prisma.$transaction(async (tx) => {
          if (hasUserChanges) {
            await tx.user.update({ where: { id: userId }, data: userData });
          }

          await tx.userProfile.upsert({
            where: { userId },
            update: profileData,
            create: { userId, ...profileData },
          });
        });
      } catch (error) {
        throw this.mapMissingUserError(error);
      }
    }

    return this.getProfile(userId);
  }

  private mapMissingUserError(error: unknown): unknown {
    if (isPrismaErrorWithCode(error, 'P2003') || isPrismaErrorWithCode(error, 'P2025')) {
      return userNotFound();
    }

    return error;
  }

  private parseDateOfBirth(value: string | null): Date | null {
    if (value === null) {
      return null;
    }

    const date = parseDateOnly(value);
    if (!date || date.getTime() > Date.now()) {
      throw validationError(
        'dateOfBirth',
        'dateOfBirth must be a valid date in YYYY-MM-DD format and cannot be in the future.',
      );
    }

    return date;
  }

  private cleanText(value: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private cleanUrl(value: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
