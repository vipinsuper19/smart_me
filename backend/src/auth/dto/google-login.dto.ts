import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @MinLength(20)
  @MaxLength(10_000)
  idToken!: string;

  /** Required only when this Google sign-in creates a new SmartMe account. */
  @IsOptional()
  @IsBoolean()
  acceptTerms?: boolean;

  @IsOptional()
  @IsBoolean()
  acceptPrivacy?: boolean;
}
