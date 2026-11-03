import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ApiException } from '../common/errors/api-error';
import {
  AccessTier,
  ContentBlockType,
  ContentLanguage,
  EntitlementSource,
  LessonProgressStatus,
  PublicationStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { ContentService } from './content.service';

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDatabase = DATABASE_URL ? describe : describe.skip;

const baseConfig = {
  DATABASE_URL: DATABASE_URL ?? '',
  DATABASE_POOL_MAX: 5,
};

describeIfDatabase('Content read and progress integration', () => {
  jest.setTimeout(30_000);

  let prisma: PrismaService;
  let content: ContentService;
  let userId: string;
  let path: { id: string };
  let draftPath: { id: string };
  let freeCourse: { id: string };
  let premiumCourse: { id: string };
  let draftCourse: { id: string };
  let archivedCourse: { id: string };
  let draftPathCourse: { id: string };
  let freeLessonFirst: { id: string };
  let freeLessonSecond: { id: string };
  let freeLessonThird: { id: string };
  let premiumLesson: { id: string };
  let draftLesson: { id: string };
  let draftOnlyLesson: { id: string };
  let draftPathLesson: { id: string };
  const pathIds: string[] = [];
  const emails: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService(new ConfigService(baseConfig));
    await prisma.$connect();
    content = new ContentService(prisma, new GamificationService(prisma));

    const suffix = randomUUID().slice(0, 8);
    const email = `content-test-${suffix}@example.com`;
    emails.push(email);
    const user = await prisma.user.create({
      data: { email, name: 'Content Test' },
    });
    userId = user.id;

    path = await prisma.learningPath.create({
      data: {
        slug: `content-test-${suffix}`,
        title: 'Content Test Path',
        description: 'A path used by content integration tests.',
        status: PublicationStatus.PUBLISHED,
        order: 9_000,
        availableLanguages: [ContentLanguage.ENGLISH, ContentLanguage.HINGLISH],
      },
    });
    pathIds.push(path.id);

    draftPath = await prisma.learningPath.create({
      data: {
        slug: `content-test-draft-${suffix}`,
        title: 'Draft Content Path',
        description: 'A draft path that learners must never see.',
        status: PublicationStatus.DRAFT,
        order: 9_001,
      },
    });
    pathIds.push(draftPath.id);

    freeCourse = await prisma.course.create({
      data: {
        learningPathId: path.id,
        slug: 'free-course',
        title: 'Free Course',
        shortDescription: 'A free course with ordered lessons.',
        status: PublicationStatus.PUBLISHED,
        accessTier: AccessTier.FREE,
        order: 0,
        availableLanguages: [ContentLanguage.ENGLISH],
      },
    });
    premiumCourse = await prisma.course.create({
      data: {
        learningPathId: path.id,
        slug: 'premium-course',
        title: 'Premium Course',
        shortDescription: 'A premium course used to test access gating.',
        status: PublicationStatus.PUBLISHED,
        accessTier: AccessTier.PREMIUM,
        order: 1,
      },
    });
    draftCourse = await prisma.course.create({
      data: {
        learningPathId: path.id,
        slug: 'draft-course',
        title: 'Draft Course',
        shortDescription: 'A draft course.',
        status: PublicationStatus.DRAFT,
        order: 2,
      },
    });
    archivedCourse = await prisma.course.create({
      data: {
        learningPathId: path.id,
        slug: 'archived-course',
        title: 'Archived Course',
        shortDescription: 'An archived course.',
        status: PublicationStatus.ARCHIVED,
        order: 3,
      },
    });

    const draftPathCourseRecord = await prisma.course.create({
      data: {
        learningPathId: draftPath.id,
        slug: 'published-course-under-draft-path',
        title: 'Published course under a draft path',
        shortDescription: 'Must remain hidden while the parent path is draft.',
        status: PublicationStatus.PUBLISHED,
        order: 0,
      },
    });
    draftPathCourse = { id: draftPathCourseRecord.id };
    const draftPathModule = await prisma.courseModule.create({
      data: {
        courseId: draftPathCourse.id,
        slug: 'draft-path-module',
        title: 'Draft Path Module',
        order: 0,
      },
    });
    draftPathLesson = await prisma.lesson.create({
      data: {
        moduleId: draftPathModule.id,
        slug: 'draft-path-lesson',
        title: 'Draft Path Lesson',
        summary: 'Hidden with its parent path.',
        objective: 'Remain invisible.',
        status: PublicationStatus.PUBLISHED,
        order: 0,
      },
    });

    const freeModuleFirst = await prisma.courseModule.create({
      data: {
        courseId: freeCourse.id,
        slug: 'first-module',
        title: 'First Module',
        description: 'Lessons in admin order.',
        order: 0,
        estimatedMinutes: 10,
      },
    });
    const freeModuleSecond = await prisma.courseModule.create({
      data: {
        courseId: freeCourse.id,
        slug: 'second-module',
        title: 'Second Module',
        description: 'A second ordered module.',
        order: 1,
        estimatedMinutes: 5,
      },
    });
    const draftOnlyModule = await prisma.courseModule.create({
      data: {
        courseId: freeCourse.id,
        slug: 'draft-only-module',
        title: 'Draft Only Module',
        order: 2,
      },
    });

    freeLessonFirst = await prisma.lesson.create({
      data: {
        moduleId: freeModuleFirst.id,
        slug: 'free-lesson-a',
        title: 'Free Lesson A',
        summary: 'The first lesson in admin order.',
        objective: 'Verify ordering and progress.',
        status: PublicationStatus.PUBLISHED,
        accessTier: AccessTier.FREE,
        order: 0,
        estimatedMinutes: 5,
        blocks: {
          create: [
            {
              type: ContentBlockType.HEADING,
              order: 0,
              payload: { text: 'Start here' },
            },
            {
              type: ContentBlockType.PARAGRAPH,
              order: 1,
              payload: { text: 'This is a test lesson.' },
            },
          ],
        },
      },
    });
    freeLessonSecond = await prisma.lesson.create({
      data: {
        moduleId: freeModuleFirst.id,
        slug: 'free-lesson-b',
        title: 'Free Lesson B',
        summary: 'The second lesson in admin order.',
        objective: 'Verify ordering.',
        status: PublicationStatus.PUBLISHED,
        accessTier: AccessTier.FREE,
        order: 1,
        estimatedMinutes: 5,
      },
    });
    freeLessonThird = await prisma.lesson.create({
      data: {
        moduleId: freeModuleSecond.id,
        slug: 'free-lesson-c',
        title: 'Free Lesson C',
        summary: 'The first lesson in the second module.',
        objective: 'Verify module ordering.',
        status: PublicationStatus.PUBLISHED,
        accessTier: AccessTier.FREE,
        order: 0,
        estimatedMinutes: 5,
      },
    });
    draftLesson = await prisma.lesson.create({
      data: {
        moduleId: freeModuleFirst.id,
        slug: 'draft-lesson',
        title: 'Draft Lesson',
        summary: 'A draft lesson that must not be listed.',
        objective: 'Remain hidden.',
        status: PublicationStatus.DRAFT,
        accessTier: AccessTier.FREE,
        order: 2,
      },
    });
    draftOnlyLesson = await prisma.lesson.create({
      data: {
        moduleId: draftOnlyModule.id,
        slug: 'draft-only-lesson',
        title: 'Draft Only Lesson',
        summary: 'A draft lesson that must not create an empty module.',
        objective: 'Remain hidden.',
        status: PublicationStatus.DRAFT,
        accessTier: AccessTier.FREE,
        order: 0,
      },
    });

    const premiumModule = await prisma.courseModule.create({
      data: {
        courseId: premiumCourse.id,
        slug: 'premium-module',
        title: 'Premium Module',
        order: 0,
      },
    });
    premiumLesson = await prisma.lesson.create({
      data: {
        moduleId: premiumModule.id,
        slug: 'premium-lesson',
        title: 'Premium Lesson',
        summary: 'Locked unless the learner has an active entitlement.',
        objective: 'Verify premium gating.',
        status: PublicationStatus.PUBLISHED,
        accessTier: AccessTier.PREMIUM,
        order: 0,
        estimatedMinutes: 5,
        blocks: {
          create: [
            {
              type: ContentBlockType.PARAGRAPH,
              order: 0,
              payload: { text: 'Premium content.' },
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    if (emails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
    }
    if (pathIds.length > 0) {
      await prisma.learningPath.deleteMany({ where: { id: { in: pathIds } } });
    }
    await prisma.$disconnect();
  });

  async function expectApiError(
    promise: Promise<unknown>,
    code: string,
    status = 400,
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

  it('serves only published content in admin order with pagination', async () => {
    const paths = await content.listLearningPaths(userId, { page: 1, pageSize: 100 });
    const pathCard = paths.items.find((item) => item.id === path.id);

    expect(pathCard).toMatchObject({
      courseCount: 2,
      lessonCount: 4,
      hasPremiumContent: true,
      progress: { totalLessons: 4, completedLessons: 0, percent: 0 },
    });
    expect(paths.items.some((item) => item.id === draftPath.id)).toBe(false);

    const detail = await content.getLearningPath(userId, path.id);
    expect(detail.courses.map((course) => course.slug)).toEqual(['free-course', 'premium-course']);
    expect(detail.courses[0]).toMatchObject({
      moduleCount: 2,
      lessonCount: 3,
      locked: false,
      hasPremiumLessons: false,
    });
    expect(detail.courses[1]).toMatchObject({
      moduleCount: 1,
      lessonCount: 1,
      locked: true,
      hasPremiumLessons: true,
    });

    const courseDetail = await content.getCourse(userId, freeCourse.id);
    expect(courseDetail.modules.map((module) => module.title)).toEqual([
      'First Module',
      'Second Module',
    ]);
    expect(courseDetail.modules[0].lessons.map((lesson) => lesson.id)).toEqual([
      freeLessonFirst.id,
      freeLessonSecond.id,
    ]);
    expect(courseDetail.modules[1].lessons.map((lesson) => lesson.id)).toEqual([
      freeLessonThird.id,
    ]);
    expect(courseDetail.prerequisites).toEqual([]);

    const courseLessons = await content.listCourseLessons(userId, freeCourse.id, {
      page: 1,
      pageSize: 100,
    });
    expect(courseLessons.total).toBe(3);
    expect(courseLessons.items.map((lesson) => lesson.slug)).toEqual([
      'free-lesson-a',
      'free-lesson-b',
      'free-lesson-c',
    ]);

    const firstLessonPage = await content.listCourseLessons(userId, freeCourse.id, {
      page: 1,
      pageSize: 2,
    });
    expect(firstLessonPage).toMatchObject({ page: 1, pageSize: 2, total: 3 });
    expect(firstLessonPage.items.map((lesson) => lesson.id)).toEqual([
      freeLessonFirst.id,
      freeLessonSecond.id,
    ]);
    const secondLessonPage = await content.listCourseLessons(userId, freeCourse.id, {
      page: 2,
      pageSize: 2,
    });
    expect(secondLessonPage.items.map((lesson) => lesson.id)).toEqual([freeLessonThird.id]);

    const filteredCourses = await content.listCourses(userId, {
      page: 1,
      pageSize: 100,
      learningPathId: path.id,
    });
    expect(filteredCourses.total).toBe(2);
    expect(filteredCourses.items.map((course) => course.slug)).toEqual([
      'free-course',
      'premium-course',
    ]);

    await expectApiError(content.getCourse(userId, draftCourse.id), 'COURSE_NOT_FOUND', 404);
    await expectApiError(content.getCourse(userId, archivedCourse.id), 'COURSE_NOT_FOUND', 404);
    await expectApiError(
      content.getLearningPath(userId, draftPath.id),
      'LEARNING_PATH_NOT_FOUND',
      404,
    );
    await expectApiError(content.getCourse(userId, draftPathCourse.id), 'COURSE_NOT_FOUND', 404);
    await expectApiError(content.getLesson(userId, draftPathLesson.id), 'LESSON_NOT_FOUND', 404);
    await expectApiError(content.getLesson(userId, draftLesson.id), 'LESSON_NOT_FOUND', 404);
    await expectApiError(content.getLesson(userId, draftOnlyLesson.id), 'LESSON_NOT_FOUND', 404);
    await expectApiError(content.startLesson(userId, draftLesson.id), 'LESSON_NOT_FOUND', 404);
  });

  it('gates premium lessons until an active entitlement exists', async () => {
    const pathDetail = await content.getLearningPath(userId, path.id);
    const premiumCourseCard = pathDetail.courses.find((course) => course.id === premiumCourse.id);
    expect(premiumCourseCard?.locked).toBe(true);

    await expectApiError(content.getLesson(userId, premiumLesson.id), 'PREMIUM_REQUIRED', 403);
    await expectApiError(content.startLesson(userId, premiumLesson.id), 'PREMIUM_REQUIRED', 403);
    await expectApiError(
      content.updateLessonProgress(userId, premiumLesson.id, { progressPercent: 10 }),
      'PREMIUM_REQUIRED',
      403,
    );
    await expectApiError(content.completeLesson(userId, premiumLesson.id), 'PREMIUM_REQUIRED', 403);

    const freeLesson = await content.getLesson(userId, freeLessonFirst.id);
    expect(freeLesson.blocks.map((block) => block.type)).toEqual([
      ContentBlockType.HEADING,
      ContentBlockType.PARAGRAPH,
    ]);
    expect(freeLesson.progress).toBeNull();
    expect(freeLesson.quiz).toBeNull();
    expect(freeLesson.nextLesson?.slug).toBe('free-lesson-b');
    expect(freeLesson.course.locked).toBe(false);

    await prisma.entitlement.create({
      data: {
        userId,
        tier: AccessTier.PREMIUM,
        isActive: true,
        source: EntitlementSource.MANUAL,
        validUntil: new Date(Date.now() + 86_400_000),
      },
    });

    const unlockedCourse = await content.getLearningPath(userId, path.id);
    expect(unlockedCourse.courses.find((course) => course.id === premiumCourse.id)?.locked).toBe(
      false,
    );
    const premiumLessonDetail = await content.getLesson(userId, premiumLesson.id);
    expect(premiumLessonDetail.blocks).toHaveLength(1);
    expect(premiumLessonDetail.effectiveAccessTier).toBe(AccessTier.PREMIUM);
    expect(premiumLessonDetail.course.locked).toBe(false);
    await expect(content.startLesson(userId, premiumLesson.id)).resolves.toMatchObject({
      status: LessonProgressStatus.IN_PROGRESS,
    });

    await prisma.entitlement.update({
      where: { userId },
      data: { validUntil: new Date(Date.now() - 1_000) },
    });
    await expectApiError(content.getLesson(userId, premiumLesson.id), 'PREMIUM_REQUIRED', 403);

    await prisma.entitlement.deleteMany({ where: { userId } });
  });

  it('starts, updates and completes progress idempotently', async () => {
    const started = await content.startLesson(userId, freeLessonFirst.id);
    expect(started).toMatchObject({
      lessonId: freeLessonFirst.id,
      status: LessonProgressStatus.IN_PROGRESS,
      progressPercent: 0,
      completedAt: null,
      timeSpentSeconds: 0,
    });

    const restarted = await content.startLesson(userId, freeLessonFirst.id);
    expect(restarted.status).toBe(LessonProgressStatus.IN_PROGRESS);
    expect(restarted.startedAt.toISOString()).toBe(started.startedAt.toISOString());

    const updated = await content.updateLessonProgress(userId, freeLessonFirst.id, {
      progressPercent: 40,
      lastBlockOrder: 2,
      timeSpentSeconds: 30,
    });
    expect(updated).toMatchObject({
      status: LessonProgressStatus.IN_PROGRESS,
      progressPercent: 40,
      lastBlockOrder: 2,
      timeSpentSeconds: 30,
    });

    const rewound = await content.updateLessonProgress(userId, freeLessonFirst.id, {
      progressPercent: 20,
      lastBlockOrder: 1,
      timeSpentSeconds: 10,
    });
    expect(rewound).toMatchObject({
      progressPercent: 40,
      lastBlockOrder: 1,
      timeSpentSeconds: 40,
      status: LessonProgressStatus.IN_PROGRESS,
    });

    const completed = await content.completeLesson(userId, freeLessonFirst.id);
    expect(completed.status).toBe(LessonProgressStatus.COMPLETED);
    expect(completed.progressPercent).toBe(100);
    expect(completed.completedAt).not.toBeNull();

    const completedAgain = await content.completeLesson(userId, freeLessonFirst.id);
    expect(completedAgain.completedAt?.toISOString()).toBe(completed.completedAt?.toISOString());
    expect(completedAgain.timeSpentSeconds).toBe(completed.timeSpentSeconds);

    const reopened = await content.startLesson(userId, freeLessonFirst.id);
    expect(reopened.status).toBe(LessonProgressStatus.COMPLETED);
    expect(reopened.completedAt?.toISOString()).toBe(completed.completedAt?.toISOString());
    expect(reopened.startedAt.toISOString()).toBe(started.startedAt.toISOString());

    const afterCompleteUpdate = await content.updateLessonProgress(userId, freeLessonFirst.id, {
      progressPercent: 50,
      timeSpentSeconds: 5,
    });
    expect(afterCompleteUpdate).toMatchObject({
      status: LessonProgressStatus.COMPLETED,
      progressPercent: 100,
      timeSpentSeconds: 45,
    });

    const lesson = await content.getLesson(userId, freeLessonFirst.id);
    expect(lesson.progress).toMatchObject({
      status: LessonProgressStatus.COMPLETED,
      progressPercent: 100,
    });
    expect(lesson.progress?.completedAt?.toISOString()).toBe(completed.completedAt?.toISOString());

    const course = await content.getCourse(userId, freeCourse.id);
    expect(course.progress).toMatchObject({
      totalLessons: 3,
      startedLessons: 1,
      completedLessons: 1,
      percent: 33,
    });

    const lessons = await content.listCourseLessons(userId, freeCourse.id, {
      page: 1,
      pageSize: 100,
    });
    expect(lessons.items[0].progress?.status).toBe(LessonProgressStatus.COMPLETED);
  });

  it('offers the most recent accessible unfinished lesson to continue', async () => {
    // The premium lesson started earlier is now locked and the first free
    // lesson is completed, so there is nothing resumable yet.
    await expect(content.getContinueLearning(userId)).resolves.toEqual({ item: null });

    await content.startLesson(userId, freeLessonSecond.id);
    const resume = await content.getContinueLearning(userId);
    expect(resume.item?.lesson.id).toBe(freeLessonSecond.id);
    expect(resume.item?.learningPath.id).toBe(path.id);
    expect(resume.item?.progress).toMatchObject({
      lessonId: freeLessonSecond.id,
      status: LessonProgressStatus.IN_PROGRESS,
    });
    expect(resume.item?.lesson.progress?.lessonId).toBe(freeLessonSecond.id);

    await content.completeLesson(userId, freeLessonSecond.id);
    await expect(content.getContinueLearning(userId)).resolves.toEqual({ item: null });
  });

  it('recommends the first accessible lesson matching stored preferences', async () => {
    await prisma.userPreference.upsert({
      where: { userId },
      create: { userId, interests: ['money-basics'] },
      update: { learningGoal: null, interests: ['money-basics'] },
    });

    const personalized = await content.getRecommendedLesson(userId);
    expect(personalized.reason).toBe('PREFERENCE_MATCH');
    expect(personalized.learningPath.slug).toBe('financial-literacy');
    expect(personalized.lesson.course.slug).toBe('money-basics');
    expect(personalized.lesson.locked).toBe(false);

    await prisma.userPreference.update({
      where: { userId },
      data: { learningGoal: null, interests: [] },
    });
    const fallback = await content.getRecommendedLesson(userId);
    expect(fallback.reason).toBe('FIRST_AVAILABLE');
    expect(fallback.learningPath.slug).toBe('english-communication');
    expect(fallback.lesson.slug).toBe('tell-me-about-yourself');
  });
});
