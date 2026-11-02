import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { ContentLanguage, LearningGoal, ProficiencyLevel } from '../../generated/prisma/enums';
import { DAILY_GOAL_VALUES, INTEREST_VALUES } from '../profile.constants';

const normalizeInterests = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? value.map((interest) =>
        typeof interest === 'string' ? interest.trim().toLowerCase() : interest,
      )
    : value;

export class UpdatePreferencesDto {
  /** Null clears the previously selected goal. */
  @IsOptional()
  @IsEnum(LearningGoal)
  learningGoal?: LearningGoal | null;

  /** Null clears the previously selected proficiency. */
  @IsOptional()
  @IsEnum(ProficiencyLevel)
  proficiency?: ProficiencyLevel | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(ContentLanguage)
  explanationLanguage?: ContentLanguage;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @IsIn(DAILY_GOAL_VALUES, { message: 'dailyGoalMinutes must be 5, 10 or 15.' })
  dailyGoalMinutes?: number;

  @Transform(normalizeInterests)
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(INTEREST_VALUES.length, {
    message: `Select at most ${INTEREST_VALUES.length} interests.`,
  })
  @ArrayUnique({ message: 'interests must not contain duplicates.' })
  @IsString({ each: true })
  @IsIn(INTEREST_VALUES, { each: true, message: 'One or more interests are not supported.' })
  interests?: string[];
}
