import { Transform } from 'class-transformer';
import { IsDateOnly } from '../../common/validation/is-date-only.validator';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Editable profile fields. Email is intentionally read-only because changing it
 * requires identity verification. Null clears a nullable field.
 */
export class UpdateProfileDto {
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string | null;

  @Transform(trimString)
  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'avatarUrl must be a valid http or https URL.' },
  )
  @MaxLength(500)
  avatarUrl?: string | null;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  headline?: string | null;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  occupation?: string | null;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string | null;

  @IsOptional()
  @IsDateOnly()
  dateOfBirth?: string | null;
}
