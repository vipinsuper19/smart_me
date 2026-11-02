import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto {
  @Transform(trimString)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password must contain at least one letter and one number.',
  })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsBoolean()
  @Equals(true, { message: 'You must accept the Terms of Service.' })
  acceptTerms!: boolean;

  @IsBoolean()
  @Equals(true, { message: 'You must accept the Privacy Policy.' })
  acceptPrivacy!: boolean;
}
