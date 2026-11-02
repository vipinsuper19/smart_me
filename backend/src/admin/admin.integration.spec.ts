import 'dotenv/config';
import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { Request } from 'express';
import { AdminRole, PublicationStatus, QuestionType, UserStatus } from '../generated/prisma/enums';
import { ApiException } from '../common/errors/api-error';
import { PasswordService } from '../auth/services/password.service';
import { TokenService } from '../auth/services/token.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthService } from './auth/admin-auth.service';
import { AdminAuditService } from './audit/admin-audit.service';
import { AdminContentService } from './content/admin-content.service';
import { AdminMediaService } from './media/admin-media.service';
import { AdminOverviewService } from './overview/admin-overview.service';
import { AdminQuizService } from './quiz/admin-quiz.service';
import { ADMIN_ROLES_KEY } from './admin-roles.decorator';
import { AdminActionContext, AdminPrincipal } from './admin.types';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AdminRolesGuard } from './guards/admin-roles.guard';
import { AdminLoginDto } from './auth/dto/admin-login.dto';
import { ListAuditLogsQueryDto } from './audit/dto/list-audit-logs-query.dto';
import {
  CreateBlockDto,
  CreateCourseDto,
  CreateLearningPathDto,
  CreateLessonDto,
  CreateModuleDto,
  CreateQuestionDto,
  CreateQuizDto,
} from './dto/content.dto';
import { CreateMediaAssetDto } from './dto/media.dto';
import {
  AnalyticsQueryDto,
  ListSubscriptionsQueryDto,
  ListUsersQueryDto,
} from './dto/overview.dto';

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDatabase = DATABASE_URL ? describe : describe.skip;

const baseConfig = {
  DATABASE_URL: DATABASE_URL ?? '',
  DATABASE_POOL_MAX: 5,
  JWT_ACCESS_SECRET: 'test-access-secret-0000000000000000000000',
  JWT_REFRESH_SECRET: 'test-refresh-secret-000000000000000000000',
  JWT_ACCESS_TTL: 900,
  JWT_REFRESH_TTL: 2_592_000,
  JWT_ISSUER: 'smartme-api',
  JWT_AUDIENCE: 'smartme-api',
  AUTH_GOOGLE_ENABLED: false,
  TERMS_VERSION: 'test-terms',
  ACCOUNT_DELETION_GRACE_DAYS: 30,
};

function requestFor(token?: string): Request {
  return {
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    headers: token ? { authorization: `Bearer ${token}` } : {},
  } as unknown as Request;
}

function contextFor(admin: AdminPrincipal): AdminActionContext {
  return {
    admin,
    ipAddress: '127.0.0.1',
    userAgent: 'jest-admin',
  };
}

function executionContext(request: Request, handler: () => void): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
    getHandler: () => handler,
    getClass: () => class TestController {},
  } as unknown as ExecutionContext;
}

describeIfDatabase('Admin backend integration', () => {
  jest.setTimeout(60_000);

  const config = new ConfigService(baseConfig);
  const jwt = new JwtService({
    secret: baseConfig.JWT_ACCESS_SECRET,
    signOptions: { issuer: baseConfig.JWT_ISSUER, audience: baseConfig.JWT_AUDIENCE },
    verifyOptions: { issuer: baseConfig.JWT_ISSUER, audience: baseConfig.JWT_AUDIENCE },
  });
  const passwords = new PasswordService();
  const tokens = new TokenService(jwt, config);

  let prisma: PrismaService;
  let audit: AdminAuditService;
  let auth: AdminAuthService;
  let content: AdminContentService;
  let quizzes: AdminQuizService;
  let media: AdminMediaService;
  let overview: AdminOverviewService;

  const adminIds: string[] = [];
  const learnerEmails: string[] = [];

  let superAdmin: AdminPrincipal;
  let editorAdmin: AdminPrincipal;
  let analystAdmin: AdminPrincipal;
  let learnerId: string;
  let subscriptionId: string | null = null;

  beforeAll(async () => {
    prisma = new PrismaService(new ConfigService(baseConfig));
    await prisma.$connect();
    audit = new AdminAuditService(prisma);
    auth = new AdminAuthService(prisma, passwords, tokens, audit);
    content = new AdminContentService(prisma, audit);
    quizzes = new AdminQuizService(prisma, audit);
    media = new AdminMediaService(prisma, audit);
    overview = new AdminOverviewService(prisma);

    superAdmin = await createAdmin(AdminRole.SUPER_ADMIN, 'super');
    editorAdmin = await createAdmin(AdminRole.CONTENT_EDITOR, 'editor');
    analystAdmin = await createAdmin(AdminRole.ANALYST, 'analyst');
  });

  afterAll(async () => {
    if (learnerId) {
      await prisma.user.deleteMany({ where: { id: learnerId } });
    }
    if (adminIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { adminUserId: { in: adminIds } } });
    }
    await prisma.learningPath.deleteMany({
      where: { slug: { startsWith: 'admin-test-' } },
    });
    await prisma.mediaAsset.deleteMany({
      where: { key: { startsWith: 'admin-test-' } },
    });
    if (adminIds.length > 0) {
      await prisma.adminUser.deleteMany({ where: { id: { in: adminIds } } });
    }
    if (learnerEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: learnerEmails } } });
    }
    await prisma.$disconnect();
  });

  async function createAdmin(role: AdminRole, label: string): Promise<AdminPrincipal> {
    const email = `admin-test-${label}-${randomUUID()}@example.com`;
    const passwordHash = await passwords.hash('AdminPassword123');
    const admin = await prisma.adminUser.create({
      data: { email, passwordHash, name: `Test ${label}`, role },
    });
    adminIds.push(admin.id);
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      sessionId: 'test',
    };
  }

  async function expectApiError(
    promise: Promise<unknown>,
    code: string,
    status: number,
  ): Promise<void> {
    let caught: unknown;
    try {
      await promise;
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiException);
    const exception = caught as ApiException;
    expect(exception.getStatus()).toBe(status);
    expect((exception.getResponse() as { code: string }).code).toBe(code);
  }

  function loginDto(admin: AdminPrincipal): AdminLoginDto {
    return { email: admin.email, password: 'AdminPassword123' };
  }

  it('authenticates admins with a separate session realm and rotating refresh tokens', async () => {
    const login = await auth.login(loginDto(superAdmin), {
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(login.admin.id).toBe(superAdmin.id);
    expect(login.admin.role).toBe(AdminRole.SUPER_ADMIN);
    expect(login.tokens.tokenType).toBe('Bearer');
    expect(login.tokens.refreshToken).toMatch(/^rt_/);

    const me = await auth.me(superAdmin.id);
    expect(me.email).toBe(superAdmin.email);

    const rotated = await auth.refresh(login.tokens.refreshToken, {});
    expect(rotated.tokens.refreshToken).not.toBe(login.tokens.refreshToken);

    const oldSession = await prisma.adminSession.findUnique({
      where: { refreshTokenHash: tokens.hashRefreshToken(login.tokens.refreshToken) },
    });
    expect(oldSession?.revokedReason).toBe('ROTATED');

    await prisma.adminSession.update({
      where: { id: oldSession!.id },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });
    await expectApiError(auth.refresh(login.tokens.refreshToken, {}), 'INVALID_REFRESH_TOKEN', 401);

    await auth.logout(rotated.tokens.refreshToken);
    await expectApiError(
      auth.refresh(rotated.tokens.refreshToken, {}),
      'INVALID_REFRESH_TOKEN',
      401,
    );

    await expectApiError(
      auth.login({ email: superAdmin.email, password: 'wrong-password' }, {}),
      'INVALID_CREDENTIALS',
      401,
    );
  });

  it('rejects learner tokens on admin routes and enforces role metadata', async () => {
    const login = await auth.login(loginDto(superAdmin), {});
    const guard = new AdminAuthGuard(tokens, prisma);
    const authenticatedRequest = requestFor(login.tokens.accessToken);

    await expect(
      guard.canActivate(executionContext(authenticatedRequest, () => undefined)),
    ).resolves.toBe(true);
    expect((authenticatedRequest as Request & { admin: AdminPrincipal }).admin.id).toBe(
      superAdmin.id,
    );

    const learnerToken = await tokens.issueAccessToken(randomUUID(), randomUUID());
    await expectApiError(
      guard.canActivate(executionContext(requestFor(learnerToken.token), () => undefined)),
      'INVALID_ACCESS_TOKEN',
      401,
    );

    const roles = new AdminRolesGuard(new Reflector());
    const analystHandler = () => undefined;
    Reflect.defineMetadata(ADMIN_ROLES_KEY, [AdminRole.ANALYST], analystHandler);

    await expect(
      roles.canActivate(
        executionContext({ admin: { ...analystAdmin } } as unknown as Request, analystHandler),
      ),
    ).resolves.toBe(true);

    await expect(
      roles.canActivate(
        executionContext({ admin: { ...editorAdmin } } as unknown as Request, analystHandler),
      ),
    ).rejects.toMatchObject({ status: 403 });

    const superHandler = () => undefined;
    Reflect.defineMetadata(ADMIN_ROLES_KEY, [AdminRole.ANALYST], superHandler);
    await expect(
      roles.canActivate(
        executionContext({ admin: { ...superAdmin } } as unknown as Request, superHandler),
      ),
    ).resolves.toBe(true);
  });

  it('manages the content hierarchy, media, publishing and audit history', async () => {
    const ctx = contextFor(superAdmin);
    const suffix = randomUUID().slice(0, 8);
    const pathSlug = `admin-test-path-${suffix}`;

    const pathDto: CreateLearningPathDto = {
      slug: pathSlug,
      title: 'Admin test path',
      description: 'Created by the admin integration test.',
    };
    const path = await content.createLearningPath(pathDto, ctx);
    expect(path.status).toBe(PublicationStatus.DRAFT);

    const courseDto: CreateCourseDto = {
      learningPathId: path.id,
      slug: 'course',
      title: 'Admin test course',
      shortDescription: 'A test course.',
    };
    const course = await content.createCourse(courseDto, ctx);

    const moduleDto: CreateModuleDto = {
      courseId: course.id,
      slug: 'module',
      title: 'Admin test module',
    };
    const courseModule = await content.createModule(moduleDto, ctx);

    const lessonDto: CreateLessonDto = {
      moduleId: courseModule.id,
      slug: 'lesson',
      title: 'Admin test lesson',
      summary: 'A test lesson.',
      objective: 'Verify the admin API.',
      requiresQuiz: true,
    };
    const lesson = await content.createLesson(lessonDto, ctx);

    await content.publishLearningPath(path.id, ctx);
    await content.publishCourse(course.id, ctx);
    await expectApiError(content.publishLesson(lesson.id, ctx), 'PUBLICATION_BLOCKED', 422);

    const mediaDto: CreateMediaAssetDto = {
      key: `admin-test-image-${suffix}`,
      url: `https://cdn.example.com/${suffix}.png`,
      type: 'IMAGE',
      mimeType: 'image/png',
      sizeBytes: 1024,
      width: 640,
      height: 360,
      altText: 'Test image',
    };
    const asset = await media.create(mediaDto, ctx);

    const headingDto: CreateBlockDto = {
      type: 'HEADING',
      payload: { text: 'Welcome' },
    };
    const paragraphDto: CreateBlockDto = {
      type: 'PARAGRAPH',
      payload: { text: 'Read this before the quiz.' },
    };
    const imageDto: CreateBlockDto = {
      type: 'IMAGE',
      payload: {},
      mediaAssetId: asset.id,
    };
    const heading = await content.createBlock(lesson.id, headingDto, ctx);
    const paragraph = await content.createBlock(lesson.id, paragraphDto, ctx);
    const image = await content.createBlock(lesson.id, imageDto, ctx);

    const blockOrder = await content.listBlocks(lesson.id);
    expect(blockOrder.map((block) => block.id)).toEqual([heading.id, paragraph.id, image.id]);

    await expectApiError(
      content.reorderBlocks(lesson.id, { ids: [image.id] }, ctx),
      'REORDER_SET_MISMATCH',
      422,
    );

    await content.reorderBlocks(lesson.id, { ids: [image.id, heading.id, paragraph.id] }, ctx);
    const reorderedBlocks = await content.listBlocks(lesson.id);
    expect(reorderedBlocks.map((block) => block.id)).toEqual([image.id, heading.id, paragraph.id]);

    await expectApiError(media.delete(asset.id, ctx), 'MEDIA_IN_USE', 409);

    const quizDto: CreateQuizDto = {
      lessonId: lesson.id,
      title: 'Admin test quiz',
    };
    const quiz = await quizzes.createQuiz(quizDto, ctx);
    expect(quiz.version).toBe(1);

    const questionDto: CreateQuestionDto = {
      type: QuestionType.SINGLE_CHOICE,
      prompt: 'Which option is correct?',
      explanation: 'Option two is correct.',
      options: [{ text: 'One' }, { text: 'Two', isCorrect: true }, { text: 'Three' }],
    };
    const question = await quizzes.createQuestion(quiz.id, questionDto, ctx);
    expect(question.options).toHaveLength(3);

    const secondQuestionDto: CreateQuestionDto = {
      type: QuestionType.TRUE_FALSE,
      prompt: 'Admin APIs are server-authorised.',
      explanation: 'RBAC is enforced by the API guards.',
      options: [{ text: 'True', isCorrect: true }, { text: 'False' }],
    };
    const secondQuestion = await quizzes.createQuestion(quiz.id, secondQuestionDto, ctx);

    const questionOrder = await quizzes.getQuiz(quiz.id);
    expect(questionOrder.questions.map((item) => item.id)).toEqual([
      question.id,
      secondQuestion.id,
    ]);
    await quizzes.reorderQuestions(quiz.id, { ids: [secondQuestion.id, question.id] }, ctx);
    const reorderedQuestions = await quizzes.getQuiz(quiz.id);
    expect(reorderedQuestions.questions.map((item) => item.id)).toEqual([
      secondQuestion.id,
      question.id,
    ]);

    const options = question.options;
    const reversedOptionIds = options.map((option) => option.id).reverse();
    await quizzes.reorderOptions(question.id, { ids: reversedOptionIds }, ctx);
    const reorderedOptions = await quizzes.getQuiz(quiz.id);
    expect(reorderedOptions.questions[1].options.map((option) => option.id)).toEqual(
      reversedOptionIds,
    );

    await quizzes.publishQuiz(quiz.id, ctx);
    await content.publishLesson(lesson.id, ctx);

    const preview = await content.previewLesson(lesson.id);
    expect(preview.status).toBe(PublicationStatus.PUBLISHED);
    expect(preview.blocks).toHaveLength(3);
    expect(preview.quizzes[0].questions).toHaveLength(2);
    const previewQuestion = preview.quizzes[0].questions.find((item) => item.id === question.id);
    expect(previewQuestion?.options.some((option) => option.isCorrect)).toBe(true);

    const secondLessonDto: CreateLessonDto = {
      moduleId: courseModule.id,
      slug: 'second-lesson',
      title: 'Second admin test lesson',
      summary: 'Another test lesson.',
      objective: 'Verify reordering.',
    };
    const secondLesson = await content.createLesson(secondLessonDto, ctx);
    await content.reorderLessons(
      { moduleId: courseModule.id, ids: [secondLesson.id, lesson.id] },
      ctx,
    );
    const lessons = await content.listLessons({
      page: 1,
      pageSize: 20,
      moduleId: courseModule.id,
    });
    expect(lessons.items.map((item) => item.id)).toEqual([secondLesson.id, lesson.id]);

    const quizV2 = await quizzes.createVersion(quiz.id, ctx);
    expect(quizV2.version).toBe(2);
    expect(quizV2.questions).toHaveLength(2);
    await expectApiError(quizzes.publishQuiz(quizV2.id, ctx), 'QUIZ_ALREADY_PUBLISHED', 409);
    await quizzes.archiveQuiz(quiz.id, ctx);
    await quizzes.publishQuiz(quizV2.id, ctx);

    const quizV3 = await quizzes.createVersion(quizV2.id, ctx);
    expect(quizV3.version).toBe(3);
    expect(quizV3.questions).toHaveLength(2);

    const learnerEmail = `admin-test-learner-${suffix}@example.com`;
    learnerEmails.push(learnerEmail);
    const learner = await prisma.user.create({
      data: { email: learnerEmail, name: 'Admin test learner', status: UserStatus.ACTIVE },
    });
    learnerId = learner.id;

    await prisma.lessonProgress.create({
      data: {
        userId: learner.id,
        lessonId: lesson.id,
        status: 'COMPLETED',
        progressPercent: 100,
        completedAt: new Date(),
      },
    });

    await quizzes.unpublishQuiz(quizV2.id, ctx);
    await prisma.quizAttempt.create({
      data: {
        userId: learner.id,
        quizId: quizV2.id,
        attemptNumber: 1,
        status: 'SUBMITTED',
        score: 100,
        totalQuestions: 2,
        correctCount: 2,
        submittedAt: new Date(),
      },
    });
    await expectApiError(
      quizzes.createQuestion(
        quizV2.id,
        {
          type: QuestionType.SINGLE_CHOICE,
          prompt: 'Should this fail?',
          explanation: 'A new version should be created instead.',
          options: [{ text: 'Yes', isCorrect: true }, { text: 'No' }],
        },
        ctx,
      ),
      'QUIZ_HAS_ATTEMPTS',
      409,
    );
    await expectApiError(quizzes.deleteQuiz(quizV2.id, ctx), 'QUIZ_HAS_ATTEMPTS', 409);

    await content.archiveLesson(lesson.id, ctx);
    await expectApiError(content.deleteLesson(lesson.id, ctx), 'CONTENT_IN_USE', 409);

    const logs = await audit.list(
      Object.assign(new ListAuditLogsQueryDto(), { page: 1, pageSize: 100 }),
    );
    const actions = logs.items.map((item) => item.action);
    expect(logs.total).toBeGreaterThan(0);
    expect(actions).toEqual(
      expect.arrayContaining([
        'LEARNING_PATH_CREATED',
        'COURSE_CREATED',
        'MODULE_CREATED',
        'LESSON_CREATED',
        'MEDIA_ASSET_CREATED',
        'CONTENT_BLOCK_CREATED',
        'QUIZ_CREATED',
        'QUIZ_PUBLISHED',
        'QUESTION_REORDERED',
      ]),
    );
  });

  it('serves dashboard, user, subscription and analytics overviews', async () => {
    expect(learnerId).toBeTruthy();
    const plan = await prisma.subscriptionPlan.findFirst({ orderBy: { order: 'asc' } });
    expect(plan).not.toBeNull();

    const subscription = await prisma.subscription.create({
      data: {
        userId: learnerId,
        planId: plan!.id,
        status: 'ACTIVE',
        startedAt: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    subscriptionId = subscription.id;

    const dashboard = await overview.dashboard();
    expect(dashboard.users.total).toBeGreaterThan(0);
    expect(dashboard.content.lessons).toBeDefined();
    expect(dashboard.learning.submittedQuizAttempts).toBeGreaterThan(0);
    expect(Array.isArray(dashboard.recentAudit)).toBe(true);

    const users = await overview.listUsers(
      Object.assign(new ListUsersQueryDto(), {
        page: 1,
        pageSize: 20,
        search: 'admin-test-learner',
      }),
    );
    expect(users.items).toHaveLength(1);
    expect(users.items[0].id).toBe(learnerId);
    expect((users.items[0] as { passwordHash?: string }).passwordHash).toBeUndefined();

    const user = await overview.getUser(learnerId);
    expect(user.id).toBe(learnerId);
    expect((user as { passwordHash?: string }).passwordHash).toBeUndefined();
    expect(user.preferences).toBeDefined();

    const plans = await overview.listPlans();
    expect(plans.items.length).toBeGreaterThanOrEqual(2);

    const subscriptions = await overview.listSubscriptions(
      Object.assign(new ListSubscriptionsQueryDto(), {
        page: 1,
        pageSize: 20,
        search: 'admin-test-learner',
      }),
    );
    expect(subscriptions.items.map((item) => item.id)).toContain(subscriptionId);

    const subscriptionDetail = await overview.getSubscription(subscriptionId!);
    expect(subscriptionDetail.plan.id).toBe(plan!.id);

    const analytics = await overview.analytics(Object.assign(new AnalyticsQueryDto(), { days: 7 }));
    expect(analytics.range.days).toBe(7);
    expect(analytics.daily).toHaveLength(7);
    expect(analytics.totals.newUsers).toBeGreaterThan(0);
    expect(analytics.productEvents.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(analytics.productEvents.top)).toBe(true);
  });
});
