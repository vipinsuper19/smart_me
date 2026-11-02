import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  ContentBlockType,
  MediaType,
  PublicationStatus,
  QuizAttemptStatus,
} from '../../generated/prisma/enums';
import { ApiException } from '../../common/errors/api-error';
import { validationError } from '../../common/errors/validation-error';
import { isPrismaErrorWithCode } from '../../common/prisma/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminActionContext } from '../admin.types';
import { AdminAuditService } from '../audit/admin-audit.service';
import {
  contentBlockNotFound,
  courseNotFound,
  contentInUse,
  invalidBlockPayload,
  invalidStatusTransition,
  learningPathNotFound,
  lessonNotFound,
  mediaNotFound,
  moduleNotFound,
  publicationBlocked,
} from '../admin.errors';
import {
  ContentListQueryDto,
  CourseListQueryDto,
  CreateBlockDto,
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
  UpdateBlockDto,
  UpdateCourseDto,
  UpdateLearningPathDto,
  UpdateLessonDto,
  UpdateModuleDto,
  UpsertTranslationDto,
} from '../dto/content.dto';

const MEDIA_BLOCK_TYPES: Partial<Record<ContentBlockType, MediaType>> = {
  [ContentBlockType.IMAGE]: MediaType.IMAGE,
  [ContentBlockType.AUDIO]: MediaType.AUDIO,
  [ContentBlockType.VIDEO]: MediaType.VIDEO,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => nonEmptyString(item));
}

function assertUpdateHasFields(dto: object): void {
  if (Object.keys(dto).length === 0) {
    throw validationError('body', 'Provide at least one field to update.');
  }
}

function asJsonObject(
  value: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Learning paths
  // -------------------------------------------------------------------------

  async listLearningPaths(query: ContentListQueryDto) {
    const where: Prisma.LearningPathWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.learningPath.findMany({
        where,
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        skip,
        take: query.pageSize,
        include: { _count: { select: { courses: true } } },
      }),
      this.prisma.learningPath.count({ where }),
    ]);

    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getLearningPath(id: string) {
    const path = await this.prisma.learningPath.findUnique({
      where: { id },
      include: {
        courses: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          include: {
            _count: { select: { modules: true } },
            modules: { select: { id: true, lessons: { select: { id: true } } } },
          },
        },
      },
    });

    if (!path) {
      throw learningPathNotFound();
    }

    return {
      ...path,
      courses: path.courses.map(({ modules, ...course }) => ({
        ...course,
        moduleCount: modules.length,
        lessonCount: modules.reduce((sum, module) => sum + module.lessons.length, 0),
      })),
    };
  }

  async createLearningPath(dto: CreateLearningPathDto, context: AdminActionContext) {
    const order = dto.order ?? (await this.nextOrder('learningPath', {}));

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.learningPath.create({
          data: {
            slug: dto.slug,
            title: dto.title.trim(),
            description: dto.description.trim(),
            coverImageUrl: dto.coverImageUrl ?? null,
            iconUrl: dto.iconUrl ?? null,
            order,
            availableLanguages: dto.availableLanguages ?? undefined,
            createdById: context.admin.id,
          },
        });

        await this.audit.record(tx, {
          adminUserId: context.admin.id,
          action: 'LEARNING_PATH_CREATED',
          entityType: 'LEARNING_PATH',
          entityId: created.id,
          after: created,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        return created;
      });
    } catch (error) {
      this.throwConflictOnUnique(error);
    }
  }

  async updateLearningPath(id: string, dto: UpdateLearningPathDto, context: AdminActionContext) {
    assertUpdateHasFields(dto);
    const existing = await this.prisma.learningPath.findUnique({ where: { id } });
    if (!existing) {
      throw learningPathNotFound();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.learningPath.update({
          where: { id },
          data: {
            ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
            ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
            ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
            ...(dto.coverImageUrl !== undefined ? { coverImageUrl: dto.coverImageUrl } : {}),
            ...(dto.iconUrl !== undefined ? { iconUrl: dto.iconUrl } : {}),
            ...(dto.order !== undefined ? { order: dto.order } : {}),
            ...(dto.availableLanguages !== undefined
              ? { availableLanguages: dto.availableLanguages }
              : {}),
          },
        });

        await this.audit.record(tx, {
          adminUserId: context.admin.id,
          action: 'LEARNING_PATH_UPDATED',
          entityType: 'LEARNING_PATH',
          entityId: id,
          before: existing,
          after: updated,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        return updated;
      });
    } catch (error) {
      this.throwConflictOnUnique(error);
    }
  }

  async deleteLearningPath(id: string, context: AdminActionContext): Promise<void> {
    const existing = await this.prisma.learningPath.findUnique({
      where: { id },
      include: {
        courses: {
          select: { id: true, modules: { select: { lessons: { select: { id: true } } } } },
        },
      },
    });
    if (!existing) {
      throw learningPathNotFound();
    }
    this.assertDeletableStatus(existing.status);

    const lessonIds = this.lessonIdsFromPath(existing);
    if (await this.hasLessonHistory(lessonIds)) {
      throw contentInUse();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.learningPath.delete({ where: { id } });
      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'LEARNING_PATH_DELETED',
        entityType: 'LEARNING_PATH',
        entityId: id,
        before: existing,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    });
  }

  async reorderLearningPaths(dto: ReorderDto, context: AdminActionContext) {
    return this.reorderWithoutHistory({
      entityIds: dto.ids,
      allItems: () =>
        this.prisma.learningPath.findMany({
          select: { id: true, order: true },
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
        }),
      updateOrder: async (tx, id, order) => {
        await tx.learningPath.update({ where: { id }, data: { order } });
      },
      audit: {
        action: 'LEARNING_PATH_REORDERED',
        entityType: 'LEARNING_PATH',
        entityId: null,
      },
      after: dto.ids.map((id, index) => ({ id, order: index })),
      context,
    });
  }

  async submitLearningPathReview(id: string, context: AdminActionContext) {
    return this.transitionWithStatusAction(id, context, 'LEARNING_PATH', 'review', (path) => {
      if (path.status === PublicationStatus.PUBLISHED) {
        throw invalidStatusTransition('Published content cannot be submitted for review.');
      }
      if (path.status === PublicationStatus.ARCHIVED) {
        throw invalidStatusTransition('Archived content cannot be submitted for review.');
      }
      return path.status === PublicationStatus.IN_REVIEW
        ? null
        : { status: PublicationStatus.IN_REVIEW };
    });
  }

  async publishLearningPath(id: string, context: AdminActionContext) {
    return this.transitionWithStatusAction(id, context, 'LEARNING_PATH', 'publish', (path) => {
      if (path.status === PublicationStatus.PUBLISHED) {
        return null;
      }
      return {
        status: PublicationStatus.PUBLISHED,
        publishedAt: path.publishedAt ?? new Date(),
        archivedAt: null,
      };
    });
  }

  async unpublishLearningPath(id: string, context: AdminActionContext) {
    return this.transitionWithStatusAction(id, context, 'LEARNING_PATH', 'unpublish', (path) => {
      if (path.status !== PublicationStatus.PUBLISHED) {
        throw invalidStatusTransition('Only published content can be unpublished.');
      }
      return { status: PublicationStatus.DRAFT, archivedAt: null };
    });
  }

  async archiveLearningPath(id: string, context: AdminActionContext) {
    return this.transitionWithStatusAction(id, context, 'LEARNING_PATH', 'archive', (path) => {
      if (path.status === PublicationStatus.ARCHIVED) {
        return null;
      }
      return { status: PublicationStatus.ARCHIVED, archivedAt: new Date() };
    });
  }

  // -------------------------------------------------------------------------
  // Courses
  // -------------------------------------------------------------------------

  async listCourses(query: CourseListQueryDto) {
    const where: Prisma.CourseWhereInput = {
      ...(query.learningPathId ? { learningPathId: query.learningPathId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        orderBy: [
          { learningPath: { order: 'asc' } },
          { order: 'asc' },
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
        skip,
        take: query.pageSize,
        include: {
          learningPath: { select: { id: true, slug: true, title: true, status: true } },
          _count: { select: { modules: true } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getCourse(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        learningPath: { select: { id: true, slug: true, title: true, status: true } },
        prerequisites: {
          include: {
            prerequisite: { select: { id: true, slug: true, title: true, status: true } },
          },
        },
        modules: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          include: { _count: { select: { lessons: true } } },
        },
      },
    });

    if (!course) {
      throw courseNotFound();
    }

    return course;
  }

  async createCourse(dto: CreateCourseDto, context: AdminActionContext) {
    await this.requireLearningPath(dto.learningPathId);
    const order =
      dto.order ?? (await this.nextOrder('course', { learningPathId: dto.learningPathId }));

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.course.create({
          data: {
            learningPathId: dto.learningPathId,
            slug: dto.slug,
            title: dto.title.trim(),
            shortDescription: dto.shortDescription.trim(),
            description: dto.description ?? null,
            coverImageUrl: dto.coverImageUrl ?? null,
            objectives: dto.objectives ?? undefined,
            difficulty: dto.difficulty ?? undefined,
            estimatedMinutes: dto.estimatedMinutes ?? undefined,
            accessTier: dto.accessTier ?? undefined,
            order,
            availableLanguages: dto.availableLanguages ?? undefined,
            createdById: context.admin.id,
          },
        });

        await this.audit.record(tx, {
          adminUserId: context.admin.id,
          action: 'COURSE_CREATED',
          entityType: 'COURSE',
          entityId: created.id,
          after: created,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        return created;
      });
    } catch (error) {
      this.throwConflictOnUnique(error);
    }
  }

  async updateCourse(id: string, dto: UpdateCourseDto, context: AdminActionContext) {
    assertUpdateHasFields(dto);
    const existing = await this.prisma.course.findUnique({ where: { id } });
    if (!existing) {
      throw courseNotFound();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.course.update({
          where: { id },
          data: {
            ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
            ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
            ...(dto.shortDescription !== undefined
              ? { shortDescription: dto.shortDescription.trim() }
              : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
            ...(dto.coverImageUrl !== undefined ? { coverImageUrl: dto.coverImageUrl } : {}),
            ...(dto.objectives !== undefined ? { objectives: dto.objectives } : {}),
            ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty } : {}),
            ...(dto.estimatedMinutes !== undefined
              ? { estimatedMinutes: dto.estimatedMinutes }
              : {}),
            ...(dto.accessTier !== undefined ? { accessTier: dto.accessTier } : {}),
            ...(dto.order !== undefined ? { order: dto.order } : {}),
            ...(dto.availableLanguages !== undefined
              ? { availableLanguages: dto.availableLanguages }
              : {}),
          },
        });

        await this.audit.record(tx, {
          adminUserId: context.admin.id,
          action: 'COURSE_UPDATED',
          entityType: 'COURSE',
          entityId: id,
          before: existing,
          after: updated,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        return updated;
      });
    } catch (error) {
      this.throwConflictOnUnique(error);
    }
  }

  async deleteCourse(id: string, context: AdminActionContext): Promise<void> {
    const existing = await this.prisma.course.findUnique({
      where: { id },
      include: { modules: { select: { lessons: { select: { id: true } } } } },
    });
    if (!existing) {
      throw courseNotFound();
    }
    this.assertDeletableStatus(existing.status);

    const lessonIds = existing.modules.flatMap((module) =>
      module.lessons.map((lesson) => lesson.id),
    );
    if (await this.hasLessonHistory(lessonIds)) {
      throw contentInUse();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.course.delete({ where: { id } });
      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'COURSE_DELETED',
        entityType: 'COURSE',
        entityId: id,
        before: existing,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    });
  }

  async reorderCourses(dto: ReorderCoursesDto, context: AdminActionContext) {
    await this.requireLearningPath(dto.learningPathId);
    return this.reorderWithoutHistory({
      entityIds: dto.ids,
      allItems: () =>
        this.prisma.course.findMany({
          where: { learningPathId: dto.learningPathId },
          select: { id: true, order: true },
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
        }),
      updateOrder: async (tx, id, order) => {
        await tx.course.update({ where: { id }, data: { order } });
      },
      audit: {
        action: 'COURSE_REORDERED',
        entityType: 'LEARNING_PATH',
        entityId: dto.learningPathId,
      },
      after: dto.ids.map((id, index) => ({ id, order: index })),
      context,
    });
  }

  async submitCourseReview(id: string, context: AdminActionContext) {
    return this.transitionWithStatusAction(id, context, 'COURSE', 'review', (course) => {
      if (course.status === PublicationStatus.PUBLISHED) {
        throw invalidStatusTransition('Published content cannot be submitted for review.');
      }
      if (course.status === PublicationStatus.ARCHIVED) {
        throw invalidStatusTransition('Archived content cannot be submitted for review.');
      }
      return course.status === PublicationStatus.IN_REVIEW
        ? null
        : { status: PublicationStatus.IN_REVIEW };
    });
  }

  async publishCourse(id: string, context: AdminActionContext) {
    return this.transitionWithStatusAction(id, context, 'COURSE', 'publish', (course) => {
      if (course.status === PublicationStatus.PUBLISHED) {
        return null;
      }
      return {
        status: PublicationStatus.PUBLISHED,
        publishedAt: course.publishedAt ?? new Date(),
        archivedAt: null,
      };
    });
  }

  async unpublishCourse(id: string, context: AdminActionContext) {
    return this.transitionWithStatusAction(id, context, 'COURSE', 'unpublish', (course) => {
      if (course.status !== PublicationStatus.PUBLISHED) {
        throw invalidStatusTransition('Only published content can be unpublished.');
      }
      return { status: PublicationStatus.DRAFT, archivedAt: null };
    });
  }

  async archiveCourse(id: string, context: AdminActionContext) {
    return this.transitionWithStatusAction(id, context, 'COURSE', 'archive', (course) => {
      if (course.status === PublicationStatus.ARCHIVED) {
        return null;
      }
      return { status: PublicationStatus.ARCHIVED, archivedAt: new Date() };
    });
  }

  // -------------------------------------------------------------------------
  // Course modules
  // -------------------------------------------------------------------------

  async listModules(query: ModuleListQueryDto) {
    const where: Prisma.CourseModuleWhereInput = {
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.courseModule.findMany({
        where,
        orderBy: [
          { course: { learningPath: { order: 'asc' } } },
          { course: { order: 'asc' } },
          { order: 'asc' },
          { id: 'asc' },
        ],
        skip,
        take: query.pageSize,
        include: {
          course: {
            select: {
              id: true,
              slug: true,
              title: true,
              status: true,
              learningPath: { select: { id: true, slug: true, title: true } },
            },
          },
          _count: { select: { lessons: true } },
        },
      }),
      this.prisma.courseModule.count({ where }),
    ]);

    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getModule(id: string) {
    const module = await this.prisma.courseModule.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, slug: true, title: true, status: true } },
        lessons: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          include: { _count: { select: { blocks: true, quizzes: true } } },
        },
      },
    });

    if (!module) {
      throw moduleNotFound();
    }

    return module;
  }

  async createModule(dto: CreateModuleDto, context: AdminActionContext) {
    await this.requireCourse(dto.courseId);
    const order = dto.order ?? (await this.nextOrder('courseModule', { courseId: dto.courseId }));

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.courseModule.create({
          data: {
            courseId: dto.courseId,
            slug: dto.slug,
            title: dto.title.trim(),
            description: dto.description ?? null,
            estimatedMinutes: dto.estimatedMinutes ?? null,
            order,
          },
        });

        await this.audit.record(tx, {
          adminUserId: context.admin.id,
          action: 'MODULE_CREATED',
          entityType: 'COURSE_MODULE',
          entityId: created.id,
          after: created,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        return created;
      });
    } catch (error) {
      this.throwConflictOnUnique(error);
    }
  }

  async updateModule(id: string, dto: UpdateModuleDto, context: AdminActionContext) {
    assertUpdateHasFields(dto);
    const existing = await this.prisma.courseModule.findUnique({ where: { id } });
    if (!existing) {
      throw moduleNotFound();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.courseModule.update({
          where: { id },
          data: {
            ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
            ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
            ...(dto.estimatedMinutes !== undefined
              ? { estimatedMinutes: dto.estimatedMinutes }
              : {}),
            ...(dto.order !== undefined ? { order: dto.order } : {}),
          },
        });

        await this.audit.record(tx, {
          adminUserId: context.admin.id,
          action: 'MODULE_UPDATED',
          entityType: 'COURSE_MODULE',
          entityId: id,
          before: existing,
          after: updated,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        return updated;
      });
    } catch (error) {
      this.throwConflictOnUnique(error);
    }
  }

  async deleteModule(id: string, context: AdminActionContext): Promise<void> {
    const existing = await this.prisma.courseModule.findUnique({
      where: { id },
      include: { lessons: { select: { id: true } } },
    });
    if (!existing) {
      throw moduleNotFound();
    }
    if (await this.hasLessonHistory(existing.lessons.map((lesson) => lesson.id))) {
      throw contentInUse();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.courseModule.delete({ where: { id } });
      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'MODULE_DELETED',
        entityType: 'COURSE_MODULE',
        entityId: id,
        before: existing,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    });
  }

  async reorderModules(dto: ReorderModulesDto, context: AdminActionContext) {
    await this.requireCourse(dto.courseId);
    return this.reorderWithoutHistory({
      entityIds: dto.ids,
      allItems: () =>
        this.prisma.courseModule.findMany({
          where: { courseId: dto.courseId },
          select: { id: true, order: true },
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
        }),
      updateOrder: async (tx, id, order) => {
        await tx.courseModule.update({ where: { id }, data: { order } });
      },
      audit: {
        action: 'MODULE_REORDERED',
        entityType: 'COURSE',
        entityId: dto.courseId,
      },
      after: dto.ids.map((id, index) => ({ id, order: index })),
      context,
    });
  }

  // -------------------------------------------------------------------------
  // Lessons
  // -------------------------------------------------------------------------

  async listLessons(query: LessonListQueryDto) {
    const where: Prisma.LessonWhereInput = {
      ...(query.moduleId ? { moduleId: query.moduleId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.lesson.findMany({
        where,
        orderBy: [
          { module: { course: { learningPath: { order: 'asc' } } } },
          { module: { course: { order: 'asc' } } },
          { module: { order: 'asc' } },
          { order: 'asc' },
          { id: 'asc' },
        ],
        skip,
        take: query.pageSize,
        include: {
          module: {
            select: {
              id: true,
              slug: true,
              title: true,
              course: {
                select: {
                  id: true,
                  slug: true,
                  title: true,
                  status: true,
                  learningPath: { select: { id: true, slug: true, title: true } },
                },
              },
            },
          },
          _count: { select: { blocks: true, translations: true, quizzes: true } },
        },
      }),
      this.prisma.lesson.count({ where }),
    ]);

    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getLesson(id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        module: {
          include: {
            course: {
              include: {
                learningPath: { select: { id: true, slug: true, title: true, status: true } },
              },
            },
          },
        },
        blocks: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          include: { mediaAsset: true },
        },
        translations: { orderBy: { language: 'asc' } },
        quizzes: {
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
          include: { _count: { select: { questions: true, attempts: true } } },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!lesson) {
      throw lessonNotFound();
    }

    return lesson;
  }

  async previewLesson(id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        module: {
          include: {
            course: {
              include: {
                learningPath: { select: { id: true, slug: true, title: true, status: true } },
              },
            },
          },
        },
        blocks: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          include: { mediaAsset: true },
        },
        translations: { orderBy: { language: 'asc' } },
        quizzes: {
          orderBy: [{ version: 'desc' }],
          include: {
            questions: {
              orderBy: [{ order: 'asc' }],
              include: {
                options: { orderBy: [{ order: 'asc' }] },
                _count: { select: { answers: true } },
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      throw lessonNotFound();
    }

    return lesson;
  }

  async createLesson(dto: CreateLessonDto, context: AdminActionContext) {
    await this.requireModule(dto.moduleId);
    const order = dto.order ?? (await this.nextOrder('lesson', { moduleId: dto.moduleId }));

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.lesson.create({
          data: {
            moduleId: dto.moduleId,
            slug: dto.slug,
            title: dto.title.trim(),
            summary: dto.summary.trim(),
            objective: dto.objective.trim(),
            difficulty: dto.difficulty ?? undefined,
            estimatedMinutes: dto.estimatedMinutes ?? undefined,
            accessTier: dto.accessTier ?? undefined,
            order,
            primaryLanguage: dto.primaryLanguage ?? undefined,
            requiresQuiz: dto.requiresQuiz ?? undefined,
            completionCriteria: asJsonObject(dto.completionCriteria),
            createdById: context.admin.id,
          },
        });

        await this.audit.record(tx, {
          adminUserId: context.admin.id,
          action: 'LESSON_CREATED',
          entityType: 'LESSON',
          entityId: created.id,
          after: created,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        return created;
      });
    } catch (error) {
      this.throwConflictOnUnique(error);
    }
  }

  async updateLesson(id: string, dto: UpdateLessonDto, context: AdminActionContext) {
    assertUpdateHasFields(dto);
    const existing = await this.prisma.lesson.findUnique({ where: { id } });
    if (!existing) {
      throw lessonNotFound();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.lesson.update({
          where: { id },
          data: {
            ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
            ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
            ...(dto.summary !== undefined ? { summary: dto.summary.trim() } : {}),
            ...(dto.objective !== undefined ? { objective: dto.objective.trim() } : {}),
            ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty } : {}),
            ...(dto.estimatedMinutes !== undefined
              ? { estimatedMinutes: dto.estimatedMinutes }
              : {}),
            ...(dto.accessTier !== undefined ? { accessTier: dto.accessTier } : {}),
            ...(dto.order !== undefined ? { order: dto.order } : {}),
            ...(dto.primaryLanguage !== undefined ? { primaryLanguage: dto.primaryLanguage } : {}),
            ...(dto.requiresQuiz !== undefined ? { requiresQuiz: dto.requiresQuiz } : {}),
            ...(dto.completionCriteria !== undefined
              ? { completionCriteria: asJsonObject(dto.completionCriteria) }
              : {}),
          },
        });

        await this.audit.record(tx, {
          adminUserId: context.admin.id,
          action: 'LESSON_UPDATED',
          entityType: 'LESSON',
          entityId: id,
          before: existing,
          after: updated,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        return updated;
      });
    } catch (error) {
      this.throwConflictOnUnique(error);
    }
  }

  async deleteLesson(id: string, context: AdminActionContext): Promise<void> {
    const existing = await this.prisma.lesson.findUnique({ where: { id } });
    if (!existing) {
      throw lessonNotFound();
    }
    this.assertDeletableStatus(existing.status);
    if (await this.hasLessonHistory([id])) {
      throw contentInUse();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.lesson.delete({ where: { id } });
      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'LESSON_DELETED',
        entityType: 'LESSON',
        entityId: id,
        before: existing,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    });
  }

  async reorderLessons(dto: ReorderLessonsDto, context: AdminActionContext) {
    await this.requireModule(dto.moduleId);
    return this.reorderWithoutHistory({
      entityIds: dto.ids,
      allItems: () =>
        this.prisma.lesson.findMany({
          where: { moduleId: dto.moduleId },
          select: { id: true, order: true },
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
        }),
      updateOrder: async (tx, id, order) => {
        await tx.lesson.update({ where: { id }, data: { order } });
      },
      audit: {
        action: 'LESSON_REORDERED',
        entityType: 'COURSE_MODULE',
        entityId: dto.moduleId,
      },
      after: dto.ids.map((id, index) => ({ id, order: index })),
      context,
    });
  }

  async submitLessonReview(id: string, context: AdminActionContext) {
    return this.transitionWithStatusAction(id, context, 'LESSON', 'review', (lesson) => {
      if (lesson.status === PublicationStatus.PUBLISHED) {
        throw invalidStatusTransition('Published content cannot be submitted for review.');
      }
      if (lesson.status === PublicationStatus.ARCHIVED) {
        throw invalidStatusTransition('Archived content cannot be submitted for review.');
      }
      return lesson.status === PublicationStatus.IN_REVIEW
        ? null
        : { status: PublicationStatus.IN_REVIEW };
    });
  }

  async publishLesson(id: string, context: AdminActionContext) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        _count: { select: { blocks: true } },
        quizzes: {
          where: { status: PublicationStatus.PUBLISHED },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!lesson) {
      throw lessonNotFound();
    }
    if (lesson.status === PublicationStatus.PUBLISHED) {
      return this.getLesson(id);
    }
    if (lesson._count.blocks === 0) {
      throw publicationBlocked('Add at least one content block before publishing the lesson.');
    }
    if (lesson.requiresQuiz && lesson.quizzes.length === 0) {
      throw publicationBlocked(
        'Publish a quiz for this lesson before publishing it, or turn off requiresQuiz.',
      );
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lesson.update({
        where: { id },
        data: {
          status: PublicationStatus.PUBLISHED,
          publishedAt: lesson.publishedAt ?? now,
          archivedAt: null,
          ...(lesson.publishedAt ? { version: { increment: 1 } } : {}),
        },
        include: {
          _count: { select: { blocks: true, quizzes: true } },
        },
      });

      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'LESSON_PUBLISHED',
        entityType: 'LESSON',
        entityId: id,
        before: {
          status: lesson.status,
          publishedAt: lesson.publishedAt,
          version: lesson.version,
        },
        after: {
          status: updated.status,
          publishedAt: updated.publishedAt,
          version: updated.version,
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return updated;
    });
  }

  async unpublishLesson(id: string, context: AdminActionContext) {
    return this.transitionWithStatusAction(id, context, 'LESSON', 'unpublish', (lesson) => {
      if (lesson.status !== PublicationStatus.PUBLISHED) {
        throw invalidStatusTransition('Only published content can be unpublished.');
      }
      return { status: PublicationStatus.DRAFT, archivedAt: null };
    });
  }

  async archiveLesson(id: string, context: AdminActionContext) {
    return this.transitionWithStatusAction(id, context, 'LESSON', 'archive', (lesson) => {
      if (lesson.status === PublicationStatus.ARCHIVED) {
        return null;
      }
      return { status: PublicationStatus.ARCHIVED, archivedAt: new Date() };
    });
  }

  // -------------------------------------------------------------------------
  // Translations
  // -------------------------------------------------------------------------

  async upsertTranslation(
    lessonId: string,
    language: string,
    dto: UpsertTranslationDto,
    context: AdminActionContext,
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true },
    });
    if (!lesson) {
      throw lessonNotFound();
    }
    const normalized = this.parseLanguage(language);
    const existing = await this.prisma.lessonTranslation.findUnique({
      where: { lessonId_language: { lessonId, language: normalized } },
    });

    return this.prisma.$transaction(async (tx) => {
      const translation = await tx.lessonTranslation.upsert({
        where: { lessonId_language: { lessonId, language: normalized } },
        create: {
          lessonId,
          language: normalized,
          title: dto.title.trim(),
          summary: dto.summary.trim(),
          objective: dto.objective.trim(),
          content: asJsonObject(dto.content),
        },
        update: {
          title: dto.title.trim(),
          summary: dto.summary.trim(),
          objective: dto.objective.trim(),
          ...(dto.content !== undefined ? { content: asJsonObject(dto.content) } : {}),
        },
      });

      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: existing ? 'LESSON_TRANSLATION_UPDATED' : 'LESSON_TRANSLATION_CREATED',
        entityType: 'LESSON_TRANSLATION',
        entityId: translation.id,
        before: existing,
        after: translation,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return translation;
    });
  }

  async deleteTranslation(
    lessonId: string,
    language: string,
    context: AdminActionContext,
  ): Promise<void> {
    const normalized = this.parseLanguage(language);
    const existing = await this.prisma.lessonTranslation.findUnique({
      where: { lessonId_language: { lessonId, language: normalized } },
    });
    if (!existing) {
      throw new ApiException('LESSON_TRANSLATION_NOT_FOUND', 'Translation was not found.', 404);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.lessonTranslation.delete({ where: { id: existing.id } });
      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'LESSON_TRANSLATION_DELETED',
        entityType: 'LESSON_TRANSLATION',
        entityId: existing.id,
        before: existing,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    });
  }

  // -------------------------------------------------------------------------
  // Content blocks
  // -------------------------------------------------------------------------

  async listBlocks(lessonId: string) {
    await this.requireLesson(lessonId);
    return this.prisma.lessonContentBlock.findMany({
      where: { lessonId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: { mediaAsset: true },
    });
  }

  async createBlock(lessonId: string, dto: CreateBlockDto, context: AdminActionContext) {
    await this.requireLesson(lessonId);
    await this.validateBlock(lessonId, dto.type, dto.payload, dto.mediaAssetId);
    const order = dto.order ?? (await this.nextOrder('lessonContentBlock', { lessonId }));

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.lessonContentBlock.create({
        data: {
          lessonId,
          type: dto.type,
          payload: dto.payload as Prisma.InputJsonValue,
          mediaAssetId: dto.mediaAssetId ?? null,
          caption: dto.caption ?? null,
          order,
        },
      });

      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'CONTENT_BLOCK_CREATED',
        entityType: 'LESSON_CONTENT_BLOCK',
        entityId: created.id,
        after: created,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return created;
    });
  }

  async updateBlock(id: string, dto: UpdateBlockDto, context: AdminActionContext) {
    assertUpdateHasFields(dto);
    const existing = await this.prisma.lessonContentBlock.findUnique({ where: { id } });
    if (!existing) {
      throw contentBlockNotFound();
    }

    const type = dto.type ?? existing.type;
    const payload = dto.payload ?? (isRecord(existing.payload) ? existing.payload : {});
    const mediaAssetId = dto.mediaAssetId !== undefined ? dto.mediaAssetId : existing.mediaAssetId;
    await this.validateBlock(existing.lessonId, type, payload, mediaAssetId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lessonContentBlock.update({
        where: { id },
        data: {
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.payload !== undefined ? { payload: dto.payload as Prisma.InputJsonValue } : {}),
          ...(dto.mediaAssetId !== undefined ? { mediaAssetId: dto.mediaAssetId } : {}),
          ...(dto.caption !== undefined ? { caption: dto.caption } : {}),
          ...(dto.order !== undefined ? { order: dto.order } : {}),
        },
      });

      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'CONTENT_BLOCK_UPDATED',
        entityType: 'LESSON_CONTENT_BLOCK',
        entityId: id,
        before: existing,
        after: updated,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return updated;
    });
  }

  async deleteBlock(id: string, context: AdminActionContext): Promise<void> {
    const existing = await this.prisma.lessonContentBlock.findUnique({ where: { id } });
    if (!existing) {
      throw contentBlockNotFound();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.lessonContentBlock.delete({ where: { id } });
      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'CONTENT_BLOCK_DELETED',
        entityType: 'LESSON_CONTENT_BLOCK',
        entityId: id,
        before: existing,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    });
  }

  async reorderBlocks(lessonId: string, dto: ReorderDto, context: AdminActionContext) {
    await this.requireLesson(lessonId);
    return this.reorderWithoutHistory({
      entityIds: dto.ids,
      allItems: () =>
        this.prisma.lessonContentBlock.findMany({
          where: { lessonId },
          select: { id: true, order: true },
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
        }),
      updateOrder: async (tx, id, order) => {
        await tx.lessonContentBlock.update({ where: { id }, data: { order } });
      },
      audit: {
        action: 'CONTENT_BLOCK_REORDERED',
        entityType: 'LESSON',
        entityId: lessonId,
      },
      after: dto.ids.map((id, index) => ({ id, order: index })),
      context,
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async requireLearningPath(id: string): Promise<void> {
    const exists = await this.prisma.learningPath.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw learningPathNotFound();
    }
  }

  private async requireCourse(id: string): Promise<void> {
    const exists = await this.prisma.course.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw courseNotFound();
    }
  }

  private async requireModule(id: string): Promise<void> {
    const exists = await this.prisma.courseModule.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw moduleNotFound();
    }
  }

  private async requireLesson(id: string): Promise<void> {
    const exists = await this.prisma.lesson.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw lessonNotFound();
    }
  }

  private async nextOrder(
    model: 'learningPath' | 'course' | 'courseModule' | 'lesson' | 'lessonContentBlock',
    where: Record<string, string>,
  ): Promise<number> {
    const delegate = this.prisma[model] as unknown as {
      aggregate: (args: {
        where: Record<string, string>;
        _max: { order: true };
      }) => Promise<{ _max: { order: number | null } }>;
    };
    const aggregate = await delegate.aggregate({ where, _max: { order: true } });

    return (aggregate._max.order ?? -1) + 1;
  }

  private async hasLessonHistory(lessonIds: string[]): Promise<boolean> {
    if (lessonIds.length === 0) {
      return false;
    }

    const [progress, attempts] = await Promise.all([
      this.prisma.lessonProgress.count({ where: { lessonId: { in: lessonIds } } }),
      this.prisma.quizAttempt.count({
        where: {
          quiz: { lessonId: { in: lessonIds } },
          status: { in: [QuizAttemptStatus.IN_PROGRESS, QuizAttemptStatus.SUBMITTED] },
        },
      }),
    ]);

    return progress > 0 || attempts > 0;
  }

  private lessonIdsFromPath(path: {
    courses: { modules: { lessons: { id: string }[] }[] }[];
  }): string[] {
    return path.courses.flatMap((course) =>
      course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)),
    );
  }

  private assertDeletableStatus(status: PublicationStatus): void {
    if (status === PublicationStatus.PUBLISHED) {
      throw invalidStatusTransition('Archive published content before deleting it.');
    }
  }

  private throwConflictOnUnique(error: unknown): never {
    if (isPrismaErrorWithCode(error, 'P2002')) {
      throw new ApiException(
        'SLUG_ALREADY_EXISTS',
        'A record with this slug already exists in the selected parent.',
        409,
      );
    }
    throw error;
  }

  private parseLanguage(value: string) {
    const language = value.toUpperCase();
    if (!['ENGLISH', 'HINDI', 'HINGLISH'].includes(language)) {
      throw validationError('language', 'Language must be ENGLISH, HINDI or HINGLISH.');
    }
    return language as 'ENGLISH' | 'HINDI' | 'HINGLISH';
  }

  private async validateBlock(
    lessonId: string,
    type: ContentBlockType,
    payload: Record<string, unknown>,
    mediaAssetId: string | null | undefined,
  ): Promise<void> {
    const mediaType = MEDIA_BLOCK_TYPES[type];

    if (mediaAssetId) {
      if (!mediaType) {
        throw invalidBlockPayload('This block type cannot reference a media asset.');
      }
      const media = await this.prisma.mediaAsset.findUnique({
        where: { id: mediaAssetId },
        select: { id: true, type: true },
      });
      if (!media) {
        throw mediaNotFound();
      }
      if (media.type !== mediaType) {
        throw invalidBlockPayload(`Select a ${mediaType.toLowerCase()} asset for this block.`);
      }
    }

    switch (type) {
      case ContentBlockType.HEADING:
      case ContentBlockType.PARAGRAPH:
        if (!nonEmptyString(payload.text)) {
          throw invalidBlockPayload('Text is required for this block type.');
        }
        break;
      case ContentBlockType.BULLET_LIST:
      case ContentBlockType.RECAP:
        if (!stringArray(payload.items) || payload.items.length === 0) {
          throw invalidBlockPayload('Provide a non-empty list of text items.');
        }
        break;
      case ContentBlockType.CALLOUT:
        if (!nonEmptyString(payload.title) || !nonEmptyString(payload.text)) {
          throw invalidBlockPayload('Callouts require a title and text.');
        }
        if (
          payload.language !== undefined &&
          !['ENGLISH', 'HINDI', 'HINGLISH'].includes(String(payload.language))
        ) {
          throw invalidBlockPayload('Callout language must be ENGLISH, HINDI or HINGLISH.');
        }
        break;
      case ContentBlockType.IMAGE:
      case ContentBlockType.AUDIO:
      case ContentBlockType.VIDEO:
        if (!mediaAssetId && !nonEmptyString(payload.url)) {
          throw invalidBlockPayload('Provide a media asset or an external URL.');
        }
        break;
      case ContentBlockType.EXAMPLE_CONVERSATION:
        if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
          throw invalidBlockPayload('Provide at least one conversation line.');
        }
        for (const line of payload.lines) {
          if (!isRecord(line) || !nonEmptyString(line.speaker) || !nonEmptyString(line.text)) {
            throw invalidBlockPayload('Each conversation line needs a speaker and text.');
          }
        }
        break;
      case ContentBlockType.MULTIPLE_CHOICE:
      case ContentBlockType.TRUE_FALSE:
        if (!isRecord(payload)) {
          throw invalidBlockPayload('Provide an inline knowledge-check payload.');
        }
        break;
      case ContentBlockType.COMPLETION:
        if (payload.message !== undefined && typeof payload.message !== 'string') {
          throw invalidBlockPayload('Completion message must be text.');
        }
        break;
      default:
        break;
    }

    // Referenced by the lesson so a missing parent returns a precise error.
    await this.requireLesson(lessonId);
  }

  private async reorderWithoutHistory(args: {
    entityIds: string[];
    allItems: () => Promise<{ id: string; order: number }[]>;
    updateOrder: (tx: Prisma.TransactionClient, id: string, order: number) => Promise<void>;
    audit: { action: string; entityType: string; entityId: string | null };
    after: unknown;
    context: AdminActionContext;
  }) {
    const existing = await args.allItems();
    const existingIds = new Set(existing.map((item) => item.id));
    if (
      existing.length !== args.entityIds.length ||
      args.entityIds.some((id) => !existingIds.has(id))
    ) {
      throw new ApiException(
        'REORDER_SET_MISMATCH',
        'Send every item in the parent exactly once when reordering.',
        422,
      );
    }

    const before = existing;

    return this.prisma.$transaction(async (tx) => {
      for (const [index, id] of args.entityIds.entries()) {
        await args.updateOrder(tx, id, index);
      }

      await this.audit.record(tx, {
        adminUserId: args.context.admin.id,
        action: args.audit.action,
        entityType: args.audit.entityType,
        entityId: args.audit.entityId,
        before,
        after: args.after,
        ipAddress: args.context.ipAddress,
        userAgent: args.context.userAgent,
      });

      return { reordered: args.entityIds.length };
    });
  }

  private async transitionWithStatusAction<T extends 'LEARNING_PATH' | 'COURSE' | 'LESSON'>(
    id: string,
    context: AdminActionContext,
    entityType: T,
    action: 'review' | 'publish' | 'unpublish' | 'archive',
    decide: (entity: {
      id: string;
      status: PublicationStatus;
      publishedAt: Date | null;
    }) => Record<string, unknown> | null,
  ) {
    let existing: {
      id: string;
      status: PublicationStatus;
      publishedAt: Date | null;
    } | null = null;

    if (entityType === 'LEARNING_PATH') {
      existing = await this.prisma.learningPath.findUnique({
        where: { id },
        select: { id: true, status: true, publishedAt: true },
      });
      if (!existing) throw learningPathNotFound();
    } else if (entityType === 'COURSE') {
      existing = await this.prisma.course.findUnique({
        where: { id },
        select: { id: true, status: true, publishedAt: true },
      });
      if (!existing) throw courseNotFound();
    } else {
      existing = await this.prisma.lesson.findUnique({
        where: { id },
        select: { id: true, status: true, publishedAt: true },
      });
      if (!existing) throw lessonNotFound();
    }

    const data = decide(existing);
    if (data === null) {
      return this.getStatusEntity(entityType, id);
    }

    const actionName =
      action === 'review'
        ? 'SUBMITTED_REVIEW'
        : action === 'publish'
          ? 'PUBLISHED'
          : action === 'unpublish'
            ? 'UNPUBLISHED'
            : 'ARCHIVED';

    return this.prisma.$transaction(async (tx) => {
      let updated: unknown;
      if (entityType === 'LEARNING_PATH') {
        updated = await tx.learningPath.update({
          where: { id },
          data: data as Prisma.LearningPathUpdateInput,
        });
      } else if (entityType === 'COURSE') {
        updated = await tx.course.update({
          where: { id },
          data: data as Prisma.CourseUpdateInput,
        });
      } else {
        updated = await tx.lesson.update({
          where: { id },
          data: data as Prisma.LessonUpdateInput,
        });
      }

      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: `${entityType}_${actionName}`,
        entityType,
        entityId: id,
        before: existing,
        after: updated,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return updated;
    });
  }

  private getStatusEntity(entityType: 'LEARNING_PATH' | 'COURSE' | 'LESSON', id: string) {
    if (entityType === 'LEARNING_PATH') {
      return this.prisma.learningPath.findUniqueOrThrow({ where: { id } });
    }
    if (entityType === 'COURSE') {
      return this.prisma.course.findUniqueOrThrow({ where: { id } });
    }
    return this.prisma.lesson.findUniqueOrThrow({ where: { id } });
  }
}
