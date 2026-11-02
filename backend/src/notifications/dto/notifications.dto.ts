import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DevicePlatform } from '../../generated/prisma/enums';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  dailyReminder?: boolean;

  @IsOptional()
  @IsBoolean()
  incompleteLessonReminder?: boolean;

  @IsOptional()
  @IsBoolean()
  streakReminder?: boolean;

  @IsOptional()
  @IsBoolean()
  newLessonAnnouncements?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'reminderTimeLocal must use 24-hour HH:MM format.',
  })
  reminderTimeLocal?: string;
}

export class RegisterDeviceDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  @MaxLength(4096)
  @Matches(/^[A-Za-z0-9_:.-]+$/, {
    message: 'token must be a valid device registration token.',
  })
  token: string;

  @IsOptional()
  @IsEnum(DevicePlatform)
  platform: DevicePlatform = DevicePlatform.ANDROID;
}
