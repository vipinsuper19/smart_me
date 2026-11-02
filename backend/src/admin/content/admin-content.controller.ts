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
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import {
  ContentListQueryDto,
  CourseListQueryDto,
  CreateCourseDto,
  CreateLearningPathDto,
  CreateLessonDto,
  CreateModuleDto,
  LessonListQueryDto,
  ModuleListQueryDto,
  ReorderCoursesDto,
  ReorderDto,
  ReorderLessonsDto,
  ReorderModulesDto,
  UpdateCourseDto,
  UpdateLearningPathDto,
  UpdateLessonDto,
  UpdateModuleDto,
  UpsertTranslationDto,
} from '../dto/content.dto';
import { AdminContentService } from './admin-content.service';

const CONTENT_WRITE = [AdminRole.CONTENT_EDITOR, AdminRole.SUPER_ADMIN] as const;

@Controller('admin')
@UseGuards(AdminAuthGuard, AdminRolesGuard)
export class AdminContentController {
  constructor(private readonly content: AdminContentService) {}

  // Learning paths ----------------------------------------------------------

  @Get('learning-paths')
  listLearningPaths(@Query() query: ContentListQueryDto) {
    return this.content.listLearningPaths(query);
  }

  @Post('learning-paths')
  @AdminRoles(...CONTENT_WRITE)
  createLearningPath(
    @Body() dto: CreateLearningPathDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.createLearningPath(dto, adminActionContext(request, admin));
  }

  @Post('learning-paths/reorder')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.OK)
  reorderLearningPaths(
    @Body() dto: ReorderDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.reorderLearningPaths(dto, adminActionContext(request, admin));
  }

  @Get('learning-paths/:id')
  getLearningPath(@Param('id') id: string) {
    return this.content.getLearningPath(id);
  }

  @Patch('learning-paths/:id')
  @AdminRoles(...CONTENT_WRITE)
  updateLearningPath(
    @Param('id') id: string,
    @Body() dto: UpdateLearningPathDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.updateLearningPath(id, dto, adminActionContext(request, admin));
  }

  @Delete('learning-paths/:id')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteLearningPath(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ): Promise<void> {
    return this.content.deleteLearningPath(id, adminActionContext(request, admin));
  }

  @Post('learning-paths/:id/submit-review')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.OK)
  submitLearningPathReview(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.submitLearningPathReview(id, adminActionContext(request, admin));
  }

  @Post('learning-paths/:id/publish')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.OK)
  publishLearningPath(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.publishLearningPath(id, adminActionContext(request, admin));
  }

  @Post('learning-paths/:id/unpublish')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  unpublishLearningPath(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.unpublishLearningPath(id, adminActionContext(request, admin));
  }

  @Post('learning-paths/:id/archive')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  archiveLearningPath(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.archiveLearningPath(id, adminActionContext(request, admin));
  }

  // Courses -----------------------------------------------------------------

  @Get('courses')
  listCourses(@Query() query: CourseListQueryDto) {
    return this.content.listCourses(query);
  }

  @Post('courses')
  @AdminRoles(...CONTENT_WRITE)
  createCourse(
    @Body() dto: CreateCourseDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.createCourse(dto, adminActionContext(request, admin));
  }

  @Post('courses/reorder')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.OK)
  reorderCourses(
    @Body() dto: ReorderCoursesDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.reorderCourses(dto, adminActionContext(request, admin));
  }

  @Get('courses/:id')
  getCourse(@Param('id') id: string) {
    return this.content.getCourse(id);
  }

  @Patch('courses/:id')
  @AdminRoles(...CONTENT_WRITE)
  updateCourse(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.updateCourse(id, dto, adminActionContext(request, admin));
  }

  @Delete('courses/:id')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCourse(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ): Promise<void> {
    return this.content.deleteCourse(id, adminActionContext(request, admin));
  }

  @Post('courses/:id/submit-review')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.OK)
  submitCourseReview(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.submitCourseReview(id, adminActionContext(request, admin));
  }

  @Post('courses/:id/publish')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.OK)
  publishCourse(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.publishCourse(id, adminActionContext(request, admin));
  }

  @Post('courses/:id/unpublish')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  unpublishCourse(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.unpublishCourse(id, adminActionContext(request, admin));
  }

  @Post('courses/:id/archive')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  archiveCourse(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.archiveCourse(id, adminActionContext(request, admin));
  }

  // Modules -----------------------------------------------------------------

  @Get('modules')
  listModules(@Query() query: ModuleListQueryDto) {
    return this.content.listModules(query);
  }

  @Post('modules')
  @AdminRoles(...CONTENT_WRITE)
  createModule(
    @Body() dto: CreateModuleDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.createModule(dto, adminActionContext(request, admin));
  }

  @Post('modules/reorder')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.OK)
  reorderModules(
    @Body() dto: ReorderModulesDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.reorderModules(dto, adminActionContext(request, admin));
  }

  @Get('modules/:id')
  getModule(@Param('id') id: string) {
    return this.content.getModule(id);
  }

  @Patch('modules/:id')
  @AdminRoles(...CONTENT_WRITE)
  updateModule(
    @Param('id') id: string,
    @Body() dto: UpdateModuleDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.updateModule(id, dto, adminActionContext(request, admin));
  }

  @Delete('modules/:id')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteModule(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ): Promise<void> {
    return this.content.deleteModule(id, adminActionContext(request, admin));
  }

  // Lessons -----------------------------------------------------------------

  @Get('lessons')
  listLessons(@Query() query: LessonListQueryDto) {
    return this.content.listLessons(query);
  }

  @Post('lessons')
  @AdminRoles(...CONTENT_WRITE)
  createLesson(
    @Body() dto: CreateLessonDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.createLesson(dto, adminActionContext(request, admin));
  }

  @Post('lessons/reorder')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.OK)
  reorderLessons(
    @Body() dto: ReorderLessonsDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.reorderLessons(dto, adminActionContext(request, admin));
  }

  @Get('lessons/:id/preview')
  previewLesson(@Param('id') id: string) {
    return this.content.previewLesson(id);
  }

  @Get('lessons/:id')
  getLesson(@Param('id') id: string) {
    return this.content.getLesson(id);
  }

  @Patch('lessons/:id')
  @AdminRoles(...CONTENT_WRITE)
  updateLesson(
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.updateLesson(id, dto, adminActionContext(request, admin));
  }

  @Delete('lessons/:id')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteLesson(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ): Promise<void> {
    return this.content.deleteLesson(id, adminActionContext(request, admin));
  }

  @Post('lessons/:id/submit-review')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.OK)
  submitLessonReview(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.submitLessonReview(id, adminActionContext(request, admin));
  }

  @Post('lessons/:id/publish')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.OK)
  publishLesson(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.publishLesson(id, adminActionContext(request, admin));
  }

  @Post('lessons/:id/unpublish')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  unpublishLesson(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.unpublishLesson(id, adminActionContext(request, admin));
  }

  @Post('lessons/:id/archive')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  archiveLesson(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.archiveLesson(id, adminActionContext(request, admin));
  }

  // Lesson translations -----------------------------------------------------

  @Post('lessons/:id/translations/:language')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.OK)
  upsertTranslation(
    @Param('id') id: string,
    @Param('language') language: string,
    @Body() dto: UpsertTranslationDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.upsertTranslation(id, language, dto, adminActionContext(request, admin));
  }

  @Delete('lessons/:id/translations/:language')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTranslation(
    @Param('id') id: string,
    @Param('language') language: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ): Promise<void> {
    return this.content.deleteTranslation(id, language, adminActionContext(request, admin));
  }
}
