import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../common/auth/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AnswerQuizDto } from './dto/answer-quiz.dto';
import { QuizService } from './quiz.service';
import {
  LessonQuizView,
  QuizAttemptStartView,
  QuizAttemptSummaryView,
  QuizResultView,
  QuizSubmissionView,
} from './quiz.types';

@Controller()
@UseGuards(JwtAuthGuard)
export class QuizController {
  constructor(private readonly quiz: QuizService) {}

  @Get('lessons/:id/quiz')
  getLessonQuiz(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<LessonQuizView> {
    return this.quiz.getLessonQuiz(user.id, id);
  }

  @Post('quizzes/:id/attempts')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  startAttempt(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<QuizAttemptStartView> {
    return this.quiz.startAttempt(user.id, id);
  }

  @Post('quiz-attempts/:id/answers')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  saveAnswer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AnswerQuizDto,
  ): Promise<QuizAttemptSummaryView> {
    return this.quiz.saveAnswer(user.id, id, dto);
  }

  @Post('quiz-attempts/:id/submit')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  submitAttempt(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<QuizSubmissionView> {
    return this.quiz.submitAttempt(user.id, id);
  }

  @Get('quiz-attempts/:id/results')
  getResults(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<QuizResultView> {
    return this.quiz.getResults(user.id, id);
  }
}
