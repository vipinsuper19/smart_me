import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminRole } from '../../generated/prisma/enums';
import { adminActionContext } from '../admin-context';
import { AdminRoles } from '../admin-roles.decorator';
import { AdminPrincipal } from '../admin.types';
import { CurrentAdmin } from '../current-admin.decorator';
import {
  CreateQuestionDto,
  CreateQuestionOptionDto,
  CreateQuizDto,
  ReorderDto,
  UpdateQuestionDto,
  UpdateQuestionOptionDto,
  UpdateQuizDto,
} from '../dto/content.dto';
import { QuizListQueryDto } from '../dto/quiz.dto';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { AdminQuizService } from './admin-quiz.service';

const CONTENT_WRITE = [AdminRole.CONTENT_EDITOR, AdminRole.SUPER_ADMIN] as const;

@Controller('admin')
@UseGuards(AdminAuthGuard, AdminRolesGuard)
export class AdminQuizController {
  constructor(private readonly quizzes: AdminQuizService) {}

  @Get('quizzes')
  listQuizzes(@Query() query: QuizListQueryDto) {
    return this.quizzes.listQuizzes(query);
  }

  @Post('quizzes')
  @AdminRoles(...CONTENT_WRITE)
  createQuiz(
    @Body() dto: CreateQuizDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.quizzes.createQuiz(dto, adminActionContext(request, admin));
  }

  @Get('quizzes/:id')
  getQuiz(@Param('id') id: string) {
    return this.quizzes.getQuiz(id);
  }

  @Patch('quizzes/:id')
  @AdminRoles(...CONTENT_WRITE)
  updateQuiz(
    @Param('id') id: string,
    @Body() dto: UpdateQuizDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.quizzes.updateQuiz(id, dto, adminActionContext(request, admin));
  }

  @Delete('quizzes/:id')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteQuiz(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ): Promise<void> {
    return this.quizzes.deleteQuiz(id, adminActionContext(request, admin));
  }

  @Post('quizzes/:id/versions')
  @AdminRoles(...CONTENT_WRITE)
  createVersion(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.quizzes.createVersion(id, adminActionContext(request, admin));
  }

  @Post('quizzes/:id/submit-review')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.OK)
  submitReview(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.quizzes.submitQuizReview(id, adminActionContext(request, admin));
  }

  @Post('quizzes/:id/publish')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.OK)
  publish(@Param('id') id: string, @CurrentAdmin() admin: AdminPrincipal, @Req() request: Request) {
    return this.quizzes.publishQuiz(id, adminActionContext(request, admin));
  }

  @Post('quizzes/:id/unpublish')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  unpublish(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.quizzes.unpublishQuiz(id, adminActionContext(request, admin));
  }

  @Post('quizzes/:id/archive')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  archive(@Param('id') id: string, @CurrentAdmin() admin: AdminPrincipal, @Req() request: Request) {
    return this.quizzes.archiveQuiz(id, adminActionContext(request, admin));
  }

  @Post('quizzes/:id/questions')
  @AdminRoles(...CONTENT_WRITE)
  createQuestion(
    @Param('id') quizId: string,
    @Body() dto: CreateQuestionDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.quizzes.createQuestion(quizId, dto, adminActionContext(request, admin));
  }

  @Post('quizzes/:id/questions/reorder')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.OK)
  reorderQuestions(
    @Param('id') quizId: string,
    @Body() dto: ReorderDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.quizzes.reorderQuestions(quizId, dto, adminActionContext(request, admin));
  }

  @Patch('questions/:id')
  @AdminRoles(...CONTENT_WRITE)
  updateQuestion(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.quizzes.updateQuestion(id, dto, adminActionContext(request, admin));
  }

  @Delete('questions/:id')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteQuestion(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ): Promise<void> {
    return this.quizzes.deleteQuestion(id, adminActionContext(request, admin));
  }

  @Post('questions/:id/options')
  @AdminRoles(...CONTENT_WRITE)
  createOption(
    @Param('id') questionId: string,
    @Body() dto: CreateQuestionOptionDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.quizzes.createOption(questionId, dto, adminActionContext(request, admin));
  }

  @Post('questions/:id/options/reorder')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.OK)
  reorderOptions(
    @Param('id') questionId: string,
    @Body() dto: ReorderDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.quizzes.reorderOptions(questionId, dto, adminActionContext(request, admin));
  }

  @Patch('options/:id')
  @AdminRoles(...CONTENT_WRITE)
  updateOption(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionOptionDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.quizzes.updateOption(id, dto, adminActionContext(request, admin));
  }

  @Delete('options/:id')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteOption(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ): Promise<void> {
    return this.quizzes.deleteOption(id, adminActionContext(request, admin));
  }
}
