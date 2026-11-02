import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DevicePlatform } from '../generated/prisma/enums';

/** `snake_case`, 3–64 characters, starting with a letter. */
const EVENT_NAME = /^[a-z][a-z0-9_]{2,63}$/;

export class AnalyticsEventDto {
  @IsString()
  @Matches(EVENT_NAME, {
    message: 'name must be lowercase snake_case between 3 and 64 characters.',
  })
  name: string;

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(DevicePlatform)
  platform?: DevicePlatform;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;
}

export class IngestAnalyticsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AnalyticsEventDto)
  events: AnalyticsEventDto[];
}
