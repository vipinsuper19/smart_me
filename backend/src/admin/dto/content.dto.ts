import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  AccessTier,
  ContentBlockType,
  ContentLanguage,
  ProficiencyLevel,
  PublicationStatus,
  QuestionType,
} from '../../generated/prisma/enums';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MESSAGE = 'Use lowercase letters, numbers and single hyphens.';

export class ContentListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PublicationStatus)
  status?: PublicationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CourseListQueryDto extends ContentListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  learningPathId?: string;
}

export class ModuleListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  courseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class LessonListQueryDto extends ContentListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  moduleId?: string;
}

export class CreateLearningPathDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  coverImageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  iconUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  order?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(ContentLanguage, { each: true })
  availableLanguages?: ContentLanguage[];
}

export class UpdateLearningPathDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  coverImageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  iconUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  order?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(ContentLanguage, { each: true })
  availableLanguages?: ContentLanguage[];
}

export class CreateCourseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  learningPathId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  shortDescription!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  coverImageUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  objectives?: string[];

  @IsOptional()
  @IsEnum(ProficiencyLevel)
  difficulty?: ProficiencyLevel;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  estimatedMinutes?: number;

  @IsOptional()
  @IsEnum(AccessTier)
  accessTier?: AccessTier;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  order?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(ContentLanguage, { each: true })
  availableLanguages?: ContentLanguage[];
}

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  coverImageUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  objectives?: string[];

  @IsOptional()
  @IsEnum(ProficiencyLevel)
  difficulty?: ProficiencyLevel;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  estimatedMinutes?: number;

  @IsOptional()
  @IsEnum(AccessTier)
  accessTier?: AccessTier;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  order?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(ContentLanguage, { each: true })
  availableLanguages?: ContentLanguage[];
}

export class CreateModuleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  courseId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  estimatedMinutes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  order?: number;
}

export class UpdateModuleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  estimatedMinutes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  order?: number;
}

export class CreateLessonDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  moduleId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  summary!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  objective!: string;

  @IsOptional()
  @IsEnum(ProficiencyLevel)
  difficulty?: ProficiencyLevel;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  estimatedMinutes?: number;

  @IsOptional()
  @IsEnum(AccessTier)
  accessTier?: AccessTier;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  order?: number;

  @IsOptional()
  @IsEnum(ContentLanguage)
  primaryLanguage?: ContentLanguage;

  @IsOptional()
  @IsBoolean()
  requiresQuiz?: boolean;

  @IsOptional()
  @IsObject()
  completionCriteria?: Record<string, unknown> | null;
}

export class UpdateLessonDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  objective?: string;

  @IsOptional()
  @IsEnum(ProficiencyLevel)
  difficulty?: ProficiencyLevel;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  estimatedMinutes?: number;

  @IsOptional()
  @IsEnum(AccessTier)
  accessTier?: AccessTier;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  order?: number;

  @IsOptional()
  @IsEnum(ContentLanguage)
  primaryLanguage?: ContentLanguage;

  @IsOptional()
  @IsBoolean()
  requiresQuiz?: boolean;

  @IsOptional()
  @IsObject()
  completionCriteria?: Record<string, unknown> | null;
}

export class UpsertTranslationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  summary!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  objective!: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown> | null;
}

export class CreateBlockDto {
  @IsEnum(ContentBlockType)
  type!: ContentBlockType;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  mediaAssetId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  order?: number;
}

export class UpdateBlockDto {
  @IsOptional()
  @IsEnum(ContentBlockType)
  type?: ContentBlockType;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  mediaAssetId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  order?: number;
}

export class ReorderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  ids!: string[];
}

export class ReorderCoursesDto extends ReorderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  learningPathId!: string;
}

export class ReorderModulesDto extends ReorderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  courseId!: string;
}

export class ReorderLessonsDto extends ReorderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  moduleId!: string;
}

export class CreateQuizDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  lessonId!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  passingScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  xpReward?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(86_400)
  timeLimitSeconds?: number | null;
}

export class UpdateQuizDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  passingScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  xpReward?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(86_400)
  timeLimitSeconds?: number | null;
}

export class CreateQuestionOptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  feedback?: string | null;

  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  order?: number;
}

export class UpdateQuestionOptionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  feedback?: string | null;

  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  order?: number;
}

export class CreateQuestionDto {
  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  scenario?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  explanation!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  points?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  order?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionOptionDto)
  options?: CreateQuestionOptionDto[];
}

export class UpdateQuestionDto {
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  prompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  scenario?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  explanation?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  points?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  order?: number;
}
