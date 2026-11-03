import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../common/auth/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ContentService } from './content.service';
import {
  CourseCardView,
  CourseDetailView,
  CourseLessonsView,
  ContinueLearningView,
  LearningPathCardView,
  LearningPathDetailView,
  LessonCompletionView,
  LessonDetailView,
  LessonProgressView,
  PaginatedView,
  RecommendedLessonView,
} from './content.types';
import { ListCoursesQueryDto } from './dto/list-courses-query.dto';
import { UpdateLessonProgressDto } from './dto/update-lesson-progress.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('learning-paths')
  listLearningPaths(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedView<LearningPathCardView>> {
    return this.content.listLearningPaths(user.id, query);
  }

  @Get('learning-paths/:id')
  getLearningPath(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<LearningPathDetailView> {
    return this.content.getLearningPath(user.id, id);
  }

  @Get('courses')
  listCourses(
    @CurrentUser() user: AuthUser,
    @Query() query: ListCoursesQueryDto,
  ): Promise<PaginatedView<CourseCardView>> {
    return this.content.listCourses(user.id, query);
  }

  @Get('courses/:id/lessons')
  listCourseLessons(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<CourseLessonsView> {
    return this.content.listCourseLessons(user.id, id, query);
  }

  @Get('courses/:id')
  getCourse(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<CourseDetailView> {
    return this.content.getCourse(user.id, id);
  }

  @Get('lessons/continue')
  getContinueLearning(@CurrentUser() user: AuthUser): Promise<ContinueLearningView> {
    return this.content.getContinueLearning(user.id);
  }

  @Get('lessons/recommended')
  getRecommendedLesson(@CurrentUser() user: AuthUser): Promise<RecommendedLessonView> {
    return this.content.getRecommendedLesson(user.id);
  }

  @Get('lessons/:id')
  getLesson(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<LessonDetailView> {
    return this.content.getLesson(user.id, id);
  }

  @Post('lessons/:id/start')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  startLesson(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<LessonProgressView> {
    return this.content.startLesson(user.id, id);
  }

  @Post('lessons/:id/progress')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  updateLessonProgress(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateLessonProgressDto,
  ): Promise<LessonProgressView> {
    return this.content.updateLessonProgress(user.id, id, dto);
  }

  @Post('lessons/:id/complete')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  completeLesson(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<LessonCompletionView> {
    return this.content.completeLesson(user.id, id);
  }
}
