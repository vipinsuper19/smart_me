import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { MediaType } from '../../generated/prisma/enums';

export class MediaListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(MediaType)
  type?: MediaType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CreateMediaAssetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @Matches(/^[A-Za-z0-9/_\-.]+$/, {
    message: 'Use letters, numbers, slashes, underscores, dots or hyphens.',
  })
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  url!: string;

  @IsEnum(MediaType)
  type!: MediaType;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5_000_000_000)
  sizeBytes!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  width?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  height?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(86_400)
  durationSeconds?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  altText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  checksum?: string | null;
}

export class UpdateMediaAssetDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @Matches(/^[A-Za-z0-9/_\-.]+$/, {
    message: 'Use letters, numbers, slashes, underscores, dots or hyphens.',
  })
  key?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  @IsEnum(MediaType)
  type?: MediaType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  mimeType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5_000_000_000)
  sizeBytes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  width?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  height?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(86_400)
  durationSeconds?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  altText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  checksum?: string | null;
}
