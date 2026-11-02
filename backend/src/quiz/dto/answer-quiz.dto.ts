import { IsNotEmpty, IsString } from 'class-validator';

export class AnswerQuizDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsString()
  @IsNotEmpty()
  selectedOptionId: string;
}
