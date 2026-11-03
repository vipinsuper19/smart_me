import { Injectable, Logger } from '@nestjs/common';
import type { LessonProgress, Prisma } from '../generated/prisma/client';
import {
  AccessTier,
  ContentBlockType,
  LearningGoal,
  LessonProgressStatus,
  PublicationStatus,
  QuizAttemptStatus,
  QuizKind,
} from '../generated/prisma/enums';
import type { ContentLanguage, ProficiencyLevel } from '../generated/prisma/enums';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { isPrismaErrorWithCode } from '../common/prisma/prisma-errors';
import { validationError } from '../common/errors/validation-error';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { hasPremiumAccess as hasActivePremium } from './premium-access';
import { ListCoursesQueryDto } from './dto/list-courses-query.dto';
import { UpdateLessonProgressDto } from './dto/update-lesson-progress.dto';
import {
  courseNotFound,
  learningPathNotFound,
  lessonNotFound,
  noContentAvailable,
  premiumRequired,
} from './content.errors';
import { quizRequired, quizUnavailable } from '../quiz/quiz.errors';
import {
  CourseCardView,
  CourseDetailView,
  CourseLessonsView,
  CourseRefView,
  ContinueLearningView,
  effectiveAccessTier,
  isLocked,
  LearningPathCardView,
  LearningPathDetailView,
  LessonBlockView,
  LessonCardView,
  LessonCompletionView,
  LessonDetailView,
  LessonProgressView,
  LessonTranslationView,
  MediaAssetView,
  ModuleRefView,
  ModuleView,
  NextLessonView,
  PaginatedView,
  PathRefView,
  QuizSummaryView,
  RecommendationReason,
  RecommendedLessonView,
  summarizeProgress,
  toLessonProgressView,
} from './content.types';

interface LessonTierInfo {
  id: string;
  accessTier: AccessTier;
}

interface ModuleProgressInfo {
  id: string;
  lessons: LessonTierInfo[];
}

interface CourseProgressInfo {
  accessTier: AccessTier;
  modules: ModuleProgressInfo[];
}

interface PathCardInfo {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  iconUrl: string | null;
  order: number;
  availableLanguages: ContentLanguage[];
  courses: CourseProgressInfo[];
}

interface CourseCardInfo extends CourseProgressInfo {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string | null;
  objectives: string[];
  coverImageUrl: string | null;
  difficulty: ProficiencyLevel;
  estimatedMinutes: number;
  order: number;
  availableLanguages: ContentLanguage[];
}

interface LessonCardInfo {
  id: string;
  slug: string;
  title: string;
  summary: string;
  objective: string;
  difficulty: ProficiencyLevel;
  estimatedMinutes: number;
  accessTier: AccessTier;
  order: number;
  requiresQuiz: boolean;
}

interface ModuleRefInfo {
  id: string;
  slug: string;
  title: string;
  order: number;
}

const KNOWN_BLOCK_TYPES = new Set<string>(Object.values(ContentBlockType));

const GOAL_PATH_SLUGS: Record<LearningGoal, string[]> = {
  [LearningGoal.IMPROVE_ENGLISH]: ['english-communication'],
  [LearningGoal.INTERVIEW_PREPARATION]: ['career-workplace-skills'],
  [LearningGoal.CAREER_SKILLS]: ['career-workplace-skills'],
  [LearningGoal.CONFIDENCE_COMMUNICATION]: ['english-communication'],
};

const GOAL_COURSE_SLUGS: Record<LearningGoal, string[]> = {
  [LearningGoal.IMPROVE_ENGLISH]: ['everyday-english-foundations'],
  [LearningGoal.INTERVIEW_PREPARATION]: ['interview-ready'],
  [LearningGoal.CAREER_SKILLS]: ['workplace-english'],
  [LearningGoal.CONFIDENCE_COMMUNICATION]: ['everyday-english-foundations'],
};

const INTEREST_PATH_SLUGS: Record<string, string[]> = {
  'english-speaking': ['english-communication'],
  confidence: ['english-communication'],
  interviews: ['career-workplace-skills'],
  'workplace-communication': ['career-workplace-skills'],
  'money-basics': ['financial-literacy'],
};

const INTEREST_COURSE_SLUGS: Record<string, string[]> = {
  'english-speaking': ['everyday-english-foundations'],
  confidence: ['everyday-english-foundations'],
  interviews: ['interview-ready'],
  'workplace-communication': ['workplace-english'],
  'money-basics': ['money-basics'],
};

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  async listLearningPaths(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedView<LearningPathCardView>> {
    const skip = (query.page - 1) * query.pageSize;
    const where = { status: PublicationStatus.PUBLISHED };

    const [paths, total] = await this.prisma.$transaction([
      this.prisma.learningPath.findMany({
        where,
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        skip,
        take: query.pageSize,
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          coverImageUrl: true,
          iconUrl: true,
          order: true,
          availableLanguages: true,
          courses: {
            where: { status: PublicationStatus.PUBLISHED },
            select: {
              accessTier: true,
              modules: {
                select: {
                  id: true,
                  lessons: {
                    where: { status: PublicationStatus.PUBLISHED },
                    select: { id: true, accessTier: true },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.learningPath.count({ where }),
    ]);

    const lessonIds = paths.flatMap((path) => this.lessonIdsForCourses(path.courses));
    const progress = await this.progressForLessons(userId, lessonIds);

    return {
      items: paths.map((path) => this.toPathCard(path, progress)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async getLearningPath(userId: string, id: string): Promise<LearningPathDetailView> {
    const path = await this.prisma.learningPath.findFirst({
      where: { id, status: PublicationStatus.PUBLISHED },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        coverImageUrl: true,
        iconUrl: true,
        order: true,
        availableLanguages: true,
        courses: {
          where: { status: PublicationStatus.PUBLISHED },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            slug: true,
            title: true,
            shortDescription: true,
            description: true,
            objectives: true,
            coverImageUrl: true,
            difficulty: true,
            estimatedMinutes: true,
            accessTier: true,
            order: true,
            availableLanguages: true,
            modules: {
              select: {
                id: true,
                lessons: {
                  where: { status: PublicationStatus.PUBLISHED },
                  select: { id: true, accessTier: true },
                },
              },
            },
          },
        },
      },
    });

    if (!path) {
      throw learningPathNotFound();
    }

    const lessonIds = this.lessonIdsForCourses(path.courses);
    const [progress, hasPremiumAccess] = await Promise.all([
      this.progressForLessons(userId, lessonIds),
      hasActivePremium(this.prisma, userId),
    ]);
    const pathRef: PathRefView = { id: path.id, slug: path.slug, title: path.title };

    return {
      ...this.toPathCard(path, progress),
      courses: path.courses.map((course) =>
        this.toCourseCard(course, pathRef, progress, hasPremiumAccess),
      ),
    };
  }

  async listCourses(
    userId: string,
    query: ListCoursesQueryDto,
  ): Promise<PaginatedView<CourseCardView>> {
    const skip = (query.page - 1) * query.pageSize;
    const where: Prisma.CourseWhereInput = {
      status: PublicationStatus.PUBLISHED,
      learningPath: { status: PublicationStatus.PUBLISHED },
      ...(query.learningPathId ? { learningPathId: query.learningPathId } : {}),
    };

    const [courses, total] = await this.prisma.$transaction([
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
        select: {
          id: true,
          slug: true,
          title: true,
          shortDescription: true,
          description: true,
          objectives: true,
          coverImageUrl: true,
          difficulty: true,
          estimatedMinutes: true,
          accessTier: true,
          order: true,
          availableLanguages: true,
          learningPath: { select: { id: true, slug: true, title: true } },
          modules: {
            select: {
              id: true,
              lessons: {
                where: { status: PublicationStatus.PUBLISHED },
                select: { id: true, accessTier: true },
              },
            },
          },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    const lessonIds = this.lessonIdsForCourses(courses);
    const [progress, hasPremiumAccess] = await Promise.all([
      this.progressForLessons(userId, lessonIds),
      hasActivePremium(this.prisma, userId),
    ]);

    return {
      items: courses.map((course) =>
        this.toCourseCard(course, course.learningPath, progress, hasPremiumAccess),
      ),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async getCourse(userId: string, id: string): Promise<CourseDetailView> {
    const course = await this.prisma.course.findFirst({
      where: {
        id,
        status: PublicationStatus.PUBLISHED,
        learningPath: { status: PublicationStatus.PUBLISHED },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        description: true,
        objectives: true,
        coverImageUrl: true,
        difficulty: true,
        estimatedMinutes: true,
        accessTier: true,
        order: true,
        availableLanguages: true,
        learningPath: { select: { id: true, slug: true, title: true } },
        modules: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            order: true,
            estimatedMinutes: true,
            lessons: {
              where: { status: PublicationStatus.PUBLISHED },
              orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
              select: {
                id: true,
                slug: true,
                title: true,
                summary: true,
                objective: true,
                difficulty: true,
                estimatedMinutes: true,
                accessTier: true,
                order: true,
                requiresQuiz: true,
              },
            },
          },
        },
        prerequisites: {
          select: {
            prerequisite: {
              select: {
                id: true,
                slug: true,
                title: true,
                status: true,
                accessTier: true,
                learningPath: { select: { status: true } },
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw courseNotFound();
    }

    const lessonIds = course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));
    const [progress, hasPremiumAccess] = await Promise.all([
      this.progressForLessons(userId, lessonIds),
      hasActivePremium(this.prisma, userId),
    ]);
    const courseCard = this.toCourseCard(course, course.learningPath, progress, hasPremiumAccess);
    const courseRef: CourseRefView = {
      id: course.id,
      slug: course.slug,
      title: course.title,
      accessTier: course.accessTier,
      locked: courseCard.locked,
    };

    const modules: ModuleView[] = course.modules
      .filter((module) => module.lessons.length > 0)
      .map((module) => ({
        id: module.id,
        slug: module.slug,
        title: module.title,
        description: module.description,
        order: module.order,
        estimatedMinutes: module.estimatedMinutes,
        lessons: module.lessons.map((lesson) =>
          this.toLessonCard(lesson, module, courseRef, progress, hasPremiumAccess),
        ),
      }));

    const prerequisites: CourseRefView[] = course.prerequisites
      .map(({ prerequisite }) => prerequisite)
      .filter(
        (prerequisite) =>
          prerequisite.status === PublicationStatus.PUBLISHED &&
          prerequisite.learningPath.status === PublicationStatus.PUBLISHED,
      )
      .map((prerequisite) => ({
        id: prerequisite.id,
        slug: prerequisite.slug,
        title: prerequisite.title,
        accessTier: prerequisite.accessTier,
        locked: isLocked(prerequisite.accessTier, hasPremiumAccess),
      }));

    return { ...courseCard, modules, prerequisites };
  }

  async listCourseLessons(
    userId: string,
    courseId: string,
    query: PaginationQueryDto,
  ): Promise<CourseLessonsView> {
    const course = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        status: PublicationStatus.PUBLISHED,
        learningPath: { status: PublicationStatus.PUBLISHED },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        description: true,
        objectives: true,
        coverImageUrl: true,
        difficulty: true,
        estimatedMinutes: true,
        accessTier: true,
        order: true,
        availableLanguages: true,
        learningPath: { select: { id: true, slug: true, title: true } },
        modules: {
          select: {
            id: true,
            lessons: {
              where: { status: PublicationStatus.PUBLISHED },
              select: { id: true, accessTier: true },
            },
          },
        },
      },
    });

    if (!course) {
      throw courseNotFound();
    }

    const allLessonIds = course.modules.flatMap((module) =>
      module.lessons.map((lesson) => lesson.id),
    );
    const [progress, hasPremiumAccess] = await Promise.all([
      this.progressForLessons(userId, allLessonIds),
      hasActivePremium(this.prisma, userId),
    ]);
    const courseCard = this.toCourseCard(course, course.learningPath, progress, hasPremiumAccess);
    const courseRef: CourseRefView = {
      id: course.id,
      slug: course.slug,
      title: course.title,
      accessTier: course.accessTier,
      locked: courseCard.locked,
    };
    const where: Prisma.LessonWhereInput = {
      status: PublicationStatus.PUBLISHED,
      module: { courseId: course.id },
    };
    const skip = (query.page - 1) * query.pageSize;

    const [lessons, total] = await this.prisma.$transaction([
      this.prisma.lesson.findMany({
        where,
        orderBy: [
          { module: { order: 'asc' } },
          { order: 'asc' },
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
        skip,
        take: query.pageSize,
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          objective: true,
          difficulty: true,
          estimatedMinutes: true,
          accessTier: true,
          order: true,
          requiresQuiz: true,
          module: { select: { id: true, slug: true, title: true, order: true } },
        },
      }),
      this.prisma.lesson.count({ where }),
    ]);

    return {
      course: courseCard,
      items: lessons.map((lesson) =>
        this.toLessonCard(lesson, lesson.module, courseRef, progress, hasPremiumAccess),
      ),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async getLesson(userId: string, id: string): Promise<LessonDetailView> {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id,
        status: PublicationStatus.PUBLISHED,
        module: {
          course: {
            status: PublicationStatus.PUBLISHED,
            learningPath: { status: PublicationStatus.PUBLISHED },
          },
        },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        objective: true,
        difficulty: true,
        estimatedMinutes: true,
        accessTier: true,
        order: true,
        version: true,
        primaryLanguage: true,
        requiresQuiz: true,
        completionCriteria: true,
        publishedAt: true,
        module: {
          select: {
            id: true,
            slug: true,
            title: true,
            order: true,
            course: {
              select: {
                id: true,
                slug: true,
                title: true,
                accessTier: true,
                learningPath: { select: { id: true, slug: true, title: true } },
              },
            },
          },
        },
        blocks: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            type: true,
            order: true,
            payload: true,
            caption: true,
            mediaAsset: {
              select: {
                id: true,
                url: true,
                type: true,
                mimeType: true,
                width: true,
                height: true,
                durationSeconds: true,
                altText: true,
              },
            },
          },
        },
        translations: {
          orderBy: { language: 'asc' },
          select: {
            language: true,
            title: true,
            summary: true,
            objective: true,
          },
        },
        quizzes: {
          where: { status: PublicationStatus.PUBLISHED, kind: QuizKind.LESSON },
          orderBy: [{ version: 'desc' }, { id: 'desc' }],
          take: 1,
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            passingScore: true,
            xpReward: true,
            timeLimitSeconds: true,
            _count: { select: { questions: true } },
            attempts: {
              where: { userId },
              orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
              select: {
                id: true,
                status: true,
                score: true,
              },
            },
          },
        },
        progress: { where: { userId }, take: 1 },
      },
    });

    if (!lesson) {
      throw lessonNotFound();
    }

    const hasPremiumAccess = await hasActivePremium(this.prisma, userId);
    const courseTier = lesson.module.course.accessTier;
    const lessonTier = effectiveAccessTier(courseTier, lesson.accessTier);
    if (isLocked(lessonTier, hasPremiumAccess)) {
      throw premiumRequired();
    }

    const nextLesson = await this.findNextLesson(
      lesson.module.course.id,
      lesson.id,
      courseTier,
      hasPremiumAccess,
    );
    const courseRef: CourseRefView = {
      id: lesson.module.course.id,
      slug: lesson.module.course.slug,
      title: lesson.module.course.title,
      accessTier: courseTier,
      locked: isLocked(courseTier, hasPremiumAccess),
    };
    const moduleRef = this.toModuleRef(lesson.module);
    const blocks: LessonBlockView[] = lesson.blocks
      .filter((block) => {
        if (!KNOWN_BLOCK_TYPES.has(block.type)) {
          this.logger.warn(`Skipping unsupported content block ${block.id} of type ${block.type}`);
          return false;
        }
        return true;
      })
      .map((block) => ({
        id: block.id,
        type: block.type,
        order: block.order,
        payload: block.payload,
        caption: block.caption,
        media: block.mediaAsset ? this.toMediaAsset(block.mediaAsset) : null,
      }));
    const translations: LessonTranslationView[] = lesson.translations.map((translation) => ({
      language: translation.language,
      title: translation.title,
      summary: translation.summary,
      objective: translation.objective,
    }));
    const quiz = lesson.quizzes[0];
    const submittedAttempts = quiz
      ? quiz.attempts.filter((attempt) => attempt.status === QuizAttemptStatus.SUBMITTED)
      : [];
    const bestScore =
      submittedAttempts.length === 0
        ? null
        : Math.max(...submittedAttempts.map((attempt) => attempt.score ?? 0));
    const quizView: QuizSummaryView | null = quiz
      ? {
          id: quiz.id,
          slug: quiz.slug,
          title: quiz.title,
          description: quiz.description,
          passingScore: quiz.passingScore,
          xpReward: quiz.xpReward,
          timeLimitSeconds: quiz.timeLimitSeconds,
          questionCount: quiz._count.questions,
          required: lesson.requiresQuiz,
          attemptCount: quiz.attempts.length,
          bestScore,
          passed: bestScore !== null && bestScore >= quiz.passingScore,
          activeAttemptId:
            quiz.attempts.find((attempt) => attempt.status === QuizAttemptStatus.IN_PROGRESS)?.id ??
            null,
        }
      : null;

    return {
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      summary: lesson.summary,
      objective: lesson.objective,
      difficulty: lesson.difficulty,
      estimatedMinutes: lesson.estimatedMinutes,
      accessTier: lesson.accessTier,
      effectiveAccessTier: lessonTier,
      order: lesson.order,
      version: lesson.version,
      primaryLanguage: lesson.primaryLanguage,
      requiresQuiz: lesson.requiresQuiz,
      completionCriteria: lesson.completionCriteria,
      publishedAt: lesson.publishedAt,
      availableLanguages: Array.from(
        new Set([
          lesson.primaryLanguage,
          ...lesson.translations.map((translation) => translation.language),
        ]),
      ),
      course: courseRef,
      module: moduleRef,
      blocks,
      translations,
      quiz: quizView,
      progress: lesson.progress[0] ? toLessonProgressView(lesson.progress[0]) : null,
      nextLesson,
    };
  }

  async getContinueLearning(userId: string): Promise<ContinueLearningView> {
    const rows = await this.prisma.lessonProgress.findMany({
      where: {
        userId,
        status: LessonProgressStatus.IN_PROGRESS,
        lesson: {
          status: PublicationStatus.PUBLISHED,
          module: {
            course: {
              status: PublicationStatus.PUBLISHED,
              learningPath: { status: PublicationStatus.PUBLISHED },
            },
          },
        },
      },
      orderBy: [{ lastAccessedAt: 'desc' }, { id: 'desc' }],
      take: 20,
      select: {
        id: true,
        userId: true,
        lessonId: true,
        status: true,
        progressPercent: true,
        lastBlockOrder: true,
        startedAt: true,
        lastAccessedAt: true,
        completedAt: true,
        timeSpentSeconds: true,
        createdAt: true,
        updatedAt: true,
        lesson: {
          select: {
            id: true,
            slug: true,
            title: true,
            summary: true,
            objective: true,
            difficulty: true,
            estimatedMinutes: true,
            accessTier: true,
            order: true,
            requiresQuiz: true,
            module: {
              select: {
                id: true,
                slug: true,
                title: true,
                order: true,
                course: {
                  select: {
                    id: true,
                    slug: true,
                    title: true,
                    accessTier: true,
                    learningPath: { select: { id: true, slug: true, title: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (rows.length === 0) {
      return { item: null };
    }

    // A learner whose entitlement lapsed cannot resume premium content until it
    // is renewed, so the card falls through to the next accessible lesson.
    const hasPremiumAccess = await hasActivePremium(this.prisma, userId);
    for (const row of rows) {
      const lesson = row.lesson;
      const courseTier = lesson.module.course.accessTier;
      const tier = effectiveAccessTier(courseTier, lesson.accessTier);
      if (isLocked(tier, hasPremiumAccess)) {
        continue;
      }

      const courseRef: CourseRefView = {
        id: lesson.module.course.id,
        slug: lesson.module.course.slug,
        title: lesson.module.course.title,
        accessTier: courseTier,
        locked: isLocked(courseTier, hasPremiumAccess),
      };
      const progress = new Map<string, LessonProgress>([[row.lessonId, row]]);

      return {
        item: {
          lesson: this.toLessonCard(
            lesson,
            lesson.module,
            courseRef,
            progress,
            hasPremiumAccess,
          ),
          learningPath: lesson.module.course.learningPath,
          progress: toLessonProgressView(row),
        },
      };
    }

    return { item: null };
  }

  async getRecommendedLesson(userId: string): Promise<RecommendedLessonView> {
    const [preferences, hasPremiumAccess] = await Promise.all([
      this.prisma.userPreference.findUnique({
        where: { userId },
        select: { learningGoal: true, interests: true },
      }),
      hasActivePremium(this.prisma, userId),
    ]);

    const lessons = await this.prisma.lesson.findMany({
      where: {
        status: PublicationStatus.PUBLISHED,
        module: {
          course: {
            status: PublicationStatus.PUBLISHED,
            learningPath: { status: PublicationStatus.PUBLISHED },
          },
        },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        objective: true,
        difficulty: true,
        estimatedMinutes: true,
        accessTier: true,
        order: true,
        requiresQuiz: true,
        createdAt: true,
        module: {
          select: {
            id: true,
            slug: true,
            title: true,
            order: true,
            course: {
              select: {
                id: true,
                slug: true,
                title: true,
                accessTier: true,
                order: true,
                learningPath: {
                  select: { id: true, slug: true, title: true, order: true },
                },
              },
            },
          },
        },
      },
    });

    if (lessons.length === 0) {
      throw noContentAvailable();
    }

    const preferredPathSlugs = new Set<string>();
    const preferredCourseSlugs = new Set<string>();
    if (preferences?.learningGoal) {
      for (const slug of GOAL_PATH_SLUGS[preferences.learningGoal]) {
        preferredPathSlugs.add(slug);
      }
      for (const slug of GOAL_COURSE_SLUGS[preferences.learningGoal]) {
        preferredCourseSlugs.add(slug);
      }
    }
    for (const interest of preferences?.interests ?? []) {
      for (const slug of INTEREST_PATH_SLUGS[interest] ?? []) {
        preferredPathSlugs.add(slug);
      }
      for (const slug of INTEREST_COURSE_SLUGS[interest] ?? []) {
        preferredCourseSlugs.add(slug);
      }
    }

    const orderedLessons = [...lessons].sort(
      (left, right) =>
        left.module.course.learningPath.order - right.module.course.learningPath.order ||
        left.module.course.order - right.module.course.order ||
        left.module.order - right.module.order ||
        left.order - right.order ||
        left.createdAt.getTime() - right.createdAt.getTime() ||
        left.id.localeCompare(right.id),
    );
    const accessibleLessons = orderedLessons.filter(
      (lesson) =>
        !isLocked(
          effectiveAccessTier(lesson.module.course.accessTier, lesson.accessTier),
          hasPremiumAccess,
        ),
    );
    const pool = accessibleLessons.length > 0 ? accessibleLessons : orderedLessons;
    const score = (lesson: (typeof pool)[number]): number => {
      let value = 0;
      if (preferredCourseSlugs.has(lesson.module.course.slug)) {
        value += 2;
      }
      if (preferredPathSlugs.has(lesson.module.course.learningPath.slug)) {
        value += 1;
      }
      return value;
    };
    const selected = pool.reduce(
      (best, current) => (score(current) > score(best) ? current : best),
      pool[0],
    );
    const selectedScore = score(selected);
    const reason: RecommendationReason =
      accessibleLessons.length === 0
        ? 'PREMIUM_CONTENT'
        : selectedScore > 0
          ? 'PREFERENCE_MATCH'
          : 'FIRST_AVAILABLE';
    const progress = await this.progressForLessons(userId, [selected.id]);
    const courseRef: CourseRefView = {
      id: selected.module.course.id,
      slug: selected.module.course.slug,
      title: selected.module.course.title,
      accessTier: selected.module.course.accessTier,
      locked: isLocked(selected.module.course.accessTier, hasPremiumAccess),
    };

    return {
      lesson: this.toLessonCard(selected, selected.module, courseRef, progress, hasPremiumAccess),
      learningPath: {
        id: selected.module.course.learningPath.id,
        slug: selected.module.course.learningPath.slug,
        title: selected.module.course.learningPath.title,
      },
      reason,
    };
  }

  async startLesson(userId: string, lessonId: string): Promise<LessonProgressView> {
    await this.requireAccessibleLesson(userId, lessonId);
    const now = new Date();

    const progress = await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        status: LessonProgressStatus.IN_PROGRESS,
        progressPercent: 0,
        startedAt: now,
        lastAccessedAt: now,
      },
      update: { lastAccessedAt: now },
    });

    return toLessonProgressView(progress);
  }

  async updateLessonProgress(
    userId: string,
    lessonId: string,
    dto: UpdateLessonProgressDto,
  ): Promise<LessonProgressView> {
    if (
      dto.progressPercent === undefined &&
      dto.lastBlockOrder === undefined &&
      dto.timeSpentSeconds === undefined
    ) {
      throw validationError('body', 'Provide progressPercent, lastBlockOrder or timeSpentSeconds.');
    }

    await this.requireAccessibleLesson(userId, lessonId);
    const now = new Date();
    const existing = await this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
    const updateData: Prisma.LessonProgressUpdateInput = {
      lastAccessedAt: now,
    };

    if (dto.lastBlockOrder !== undefined) {
      updateData.lastBlockOrder = dto.lastBlockOrder;
    }
    if (dto.timeSpentSeconds !== undefined && dto.timeSpentSeconds > 0) {
      updateData.timeSpentSeconds = { increment: dto.timeSpentSeconds };
    }

    if (existing) {
      if (dto.progressPercent !== undefined && existing.status !== LessonProgressStatus.COMPLETED) {
        // Advance only a still-in-progress row and only when the value is
        // higher. If a concurrent complete wins, its 100% is preserved.
        await this.prisma.lessonProgress.updateMany({
          where: {
            id: existing.id,
            status: LessonProgressStatus.IN_PROGRESS,
            progressPercent: { lt: dto.progressPercent },
          },
          data: { progressPercent: dto.progressPercent },
        });
      }
      const progress = await this.prisma.lessonProgress.update({
        where: { id: existing.id },
        data: updateData,
      });
      return toLessonProgressView(progress);
    }

    try {
      const progress = await this.prisma.lessonProgress.create({
        data: {
          userId,
          lessonId,
          status: LessonProgressStatus.IN_PROGRESS,
          progressPercent: dto.progressPercent ?? 0,
          lastBlockOrder: dto.lastBlockOrder ?? null,
          startedAt: now,
          lastAccessedAt: now,
          timeSpentSeconds: dto.timeSpentSeconds ?? 0,
        },
      });
      return toLessonProgressView(progress);
    } catch (error) {
      if (!isPrismaErrorWithCode(error, 'P2002')) {
        throw error;
      }

      // A concurrent start created the row first. Apply the update to that row.
      const concurrent = await this.prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId } },
      });
      if (dto.progressPercent !== undefined) {
        updateData.progressPercent =
          concurrent?.status === LessonProgressStatus.COMPLETED
            ? 100
            : Math.max(concurrent?.progressPercent ?? 0, dto.progressPercent);
      }
      const progress = await this.prisma.lessonProgress.update({
        where: { userId_lessonId: { userId, lessonId } },
        data: updateData,
      });
      return toLessonProgressView(progress);
    }
  }

  async completeLesson(userId: string, lessonId: string): Promise<LessonCompletionView> {
    const lesson = await this.requireAccessibleLesson(userId, lessonId);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId } },
      });

      if (existing?.status === LessonProgressStatus.COMPLETED) {
        const rewards = await this.gamification.awardLessonCompletion(tx, {
          userId,
          lessonId,
          estimatedMinutes: lesson.estimatedMinutes,
          timeSpentSeconds: existing.timeSpentSeconds,
          now,
        });

        return {
          ...toLessonProgressView(existing),
          alreadyCompleted: true,
          rewards,
        };
      }

      await this.assertQuizRequirement(tx, userId, lesson);

      // Race-safe completion: create a missing row, or advance an in-progress
      // row. Only one concurrent request observes a transition.
      const created = await tx.lessonProgress.createMany({
        data: [
          {
            userId,
            lessonId,
            status: LessonProgressStatus.COMPLETED,
            progressPercent: 100,
            startedAt: now,
            lastAccessedAt: now,
            completedAt: now,
          },
        ],
        skipDuplicates: true,
      });
      const updated = await tx.lessonProgress.updateMany({
        where: { userId, lessonId, status: LessonProgressStatus.IN_PROGRESS },
        data: {
          status: LessonProgressStatus.COMPLETED,
          progressPercent: 100,
          completedAt: now,
          lastAccessedAt: now,
        },
      });
      const progress = await tx.lessonProgress.findUniqueOrThrow({
        where: { userId_lessonId: { userId, lessonId } },
      });
      const alreadyCompleted = created.count === 0 && updated.count === 0;

      const rewards = await this.gamification.awardLessonCompletion(tx, {
        userId,
        lessonId,
        estimatedMinutes: lesson.estimatedMinutes,
        timeSpentSeconds: progress.timeSpentSeconds,
        now,
      });

      return {
        ...toLessonProgressView(progress),
        alreadyCompleted,
        rewards,
      };
    });
  }

  private async requireAccessibleLesson(
    userId: string,
    lessonId: string,
  ): Promise<{ id: string; estimatedMinutes: number; requiresQuiz: boolean }> {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        status: PublicationStatus.PUBLISHED,
        module: {
          course: {
            status: PublicationStatus.PUBLISHED,
            learningPath: { status: PublicationStatus.PUBLISHED },
          },
        },
      },
      select: {
        id: true,
        estimatedMinutes: true,
        requiresQuiz: true,
        accessTier: true,
        module: { select: { course: { select: { accessTier: true } } } },
      },
    });

    if (!lesson) {
      throw lessonNotFound();
    }

    const hasPremiumAccess = await hasActivePremium(this.prisma, userId);
    const tier = effectiveAccessTier(lesson.module.course.accessTier, lesson.accessTier);
    if (isLocked(tier, hasPremiumAccess)) {
      throw premiumRequired();
    }

    return {
      id: lesson.id,
      estimatedMinutes: lesson.estimatedMinutes,
      requiresQuiz: lesson.requiresQuiz,
    };
  }

  /**
   * A lesson that declares `requiresQuiz` can only be completed after the
   * learner has submitted an attempt that reaches the quiz's passing score.
   * Lessons without the flag keep their previous completion behaviour.
   */
  private async assertQuizRequirement(
    tx: Prisma.TransactionClient,
    userId: string,
    lesson: { id: string; requiresQuiz: boolean },
  ): Promise<void> {
    if (!lesson.requiresQuiz) {
      return;
    }

    const quiz = await tx.quiz.findFirst({
      where: {
        lessonId: lesson.id,
        kind: QuizKind.LESSON,
        status: PublicationStatus.PUBLISHED,
      },
      orderBy: [{ version: 'desc' }, { id: 'desc' }],
      select: { id: true, passingScore: true },
    });
    if (!quiz) {
      throw quizUnavailable();
    }

    const best = await tx.quizAttempt.aggregate({
      where: {
        userId,
        quizId: quiz.id,
        status: QuizAttemptStatus.SUBMITTED,
      },
      _max: { score: true },
    });
    if (best._max.score === null || best._max.score < quiz.passingScore) {
      throw quizRequired();
    }
  }

  private async progressForLessons(
    userId: string,
    lessonIds: string[],
  ): Promise<Map<string, LessonProgress>> {
    if (lessonIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.lessonProgress.findMany({
      where: { userId, lessonId: { in: [...new Set(lessonIds)] } },
    });

    return new Map(rows.map((row) => [row.lessonId, row]));
  }

  private lessonIdsForCourses(courses: CourseProgressInfo[]): string[] {
    return courses.flatMap((course) => this.lessonIdsForModules(course.modules));
  }

  private lessonIdsForModules(modules: ModuleProgressInfo[]): string[] {
    return modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));
  }

  private toPathCard(
    path: PathCardInfo,
    progress: Map<string, LessonProgress>,
  ): LearningPathCardView {
    const lessonIds = this.lessonIdsForCourses(path.courses);

    return {
      id: path.id,
      slug: path.slug,
      title: path.title,
      description: path.description,
      coverImageUrl: path.coverImageUrl,
      iconUrl: path.iconUrl,
      order: path.order,
      availableLanguages: path.availableLanguages,
      courseCount: path.courses.length,
      lessonCount: lessonIds.length,
      hasPremiumContent: path.courses.some(
        (course) =>
          course.accessTier === AccessTier.PREMIUM ||
          course.modules.some((module) =>
            module.lessons.some((lesson) => lesson.accessTier === AccessTier.PREMIUM),
          ),
      ),
      progress: summarizeProgress(lessonIds, progress),
    };
  }

  private toCourseCard(
    course: CourseCardInfo,
    learningPath: PathRefView,
    progress: Map<string, LessonProgress>,
    hasPremiumAccess: boolean,
  ): CourseCardView {
    const modules = course.modules.filter((module) => module.lessons.length > 0);
    const lessonIds = this.lessonIdsForModules(modules);

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      shortDescription: course.shortDescription,
      description: course.description,
      objectives: course.objectives,
      coverImageUrl: course.coverImageUrl,
      difficulty: course.difficulty,
      estimatedMinutes: course.estimatedMinutes,
      accessTier: course.accessTier,
      locked: isLocked(course.accessTier, hasPremiumAccess),
      order: course.order,
      availableLanguages: course.availableLanguages,
      moduleCount: modules.length,
      lessonCount: lessonIds.length,
      hasPremiumLessons: modules.some((module) =>
        module.lessons.some((lesson) => lesson.accessTier === AccessTier.PREMIUM),
      ),
      progress: summarizeProgress(lessonIds, progress),
      learningPath,
    };
  }

  private toLessonCard(
    lesson: LessonCardInfo,
    module: ModuleRefInfo,
    course: CourseRefView,
    progress: Map<string, LessonProgress>,
    hasPremiumAccess: boolean,
  ): LessonCardView {
    const tier = effectiveAccessTier(course.accessTier, lesson.accessTier);
    const progressRow = progress.get(lesson.id);

    return {
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      summary: lesson.summary,
      objective: lesson.objective,
      difficulty: lesson.difficulty,
      estimatedMinutes: lesson.estimatedMinutes,
      accessTier: lesson.accessTier,
      effectiveAccessTier: tier,
      locked: isLocked(tier, hasPremiumAccess),
      order: lesson.order,
      requiresQuiz: lesson.requiresQuiz,
      module: this.toModuleRef(module),
      course,
      progress: progressRow ? toLessonProgressView(progressRow) : null,
    };
  }

  private toModuleRef(module: ModuleRefInfo): ModuleRefView {
    return {
      id: module.id,
      slug: module.slug,
      title: module.title,
      order: module.order,
    };
  }

  private toMediaAsset(asset: {
    id: string;
    url: string;
    type: string;
    mimeType: string;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    altText: string | null;
  }): MediaAssetView {
    return {
      id: asset.id,
      url: asset.url,
      type: asset.type,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      durationSeconds: asset.durationSeconds,
      altText: asset.altText,
    };
  }

  private async findNextLesson(
    courseId: string,
    currentLessonId: string,
    courseTier: AccessTier,
    hasPremiumAccess: boolean,
  ): Promise<NextLessonView | null> {
    const lessons = await this.prisma.lesson.findMany({
      where: { status: PublicationStatus.PUBLISHED, module: { courseId } },
      orderBy: [
        { module: { order: 'asc' } },
        { order: 'asc' },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        estimatedMinutes: true,
        accessTier: true,
        module: { select: { id: true, slug: true, title: true, order: true } },
      },
    });

    const currentIndex = lessons.findIndex((lesson) => lesson.id === currentLessonId);
    const next = currentIndex >= 0 ? lessons[currentIndex + 1] : undefined;
    if (!next) {
      return null;
    }

    const effectiveTier = effectiveAccessTier(courseTier, next.accessTier);
    return {
      id: next.id,
      slug: next.slug,
      title: next.title,
      summary: next.summary,
      estimatedMinutes: next.estimatedMinutes,
      accessTier: next.accessTier,
      effectiveAccessTier: effectiveTier,
      locked: isLocked(effectiveTier, hasPremiumAccess),
      module: this.toModuleRef(next.module),
    };
  }
}
