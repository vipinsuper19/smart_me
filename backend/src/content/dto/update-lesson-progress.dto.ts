import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Progress updates are partial. At least one field must be supplied; the
 * service rejects an empty update with the standard validation envelope.
 */
export class UpdateLessonProgressDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  lastBlockOrder?: number;

  /**
   * Elapsed seconds since the previous update, not an absolute total. The cap
   * keeps a single request from inflating learning time.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3_600)
  timeSpentSeconds?: number;
}
