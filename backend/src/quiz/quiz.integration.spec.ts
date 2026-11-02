import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ApiException } from '../common/errors/api-error';
import {
  AccessTier,
  ContentBlockType,
  LessonProgressStatus,
  PublicationStatus,
  QuestionType,
  QuizAttemptStatus,
  QuizKind,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { ContentService } from '../content/content.service';
import { QuizService } from './quiz.service';

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDatabase = DATABASE_URL ? describe : describe.skip;

const baseConfig = {
  DATABASE_URL: DATABASE_URL ?? '',
  DATABASE_POOL_MAX: 5,
};

describeIfDatabase('Quiz engine integration', () => {
  jest.setTimeout(30_000);

  let prisma: PrismaService;
  let gamification: GamificationService;
  let content: ContentService;
  let quiz: QuizService;
  let userOneId: string;
  let userTwoId: string;
  let pathId: string;
  let requiredLessonId: string;
  let optionalLessonId: string;
  let missingQuizLessonId: string;
  let emptyLessonId: string;
  let draftQuizLessonId: string;
  let premiumLessonId: string;
  let requiredQuizId: string;
  let emptyQuizId: string;
  let draftQuizId: string;
  let premiumQuizId: string;
  let dailyQuizId: string;
  let questionOneId: string;
  let questionTwoId: string;
  let questionOneCorrectOptionId: string;
  let questionOneWrongOptionId: string;
  let questionTwoCorrectOptionId: string;
  let questionTwoWrongOptionId: string;
  let premiumQuestionId: string;
  let premiumOptionId: string;
  let firstAttemptId: string;

  beforeAll(async () => {
    prisma = new PrismaService(new ConfigService(baseConfig));
    await prisma.$connect();
    gamification = new GamificationService(prisma);
    content = new ContentService(prisma, gamification);
    quiz = new QuizService(prisma, gamification);

    const suffix = randomUUID().slice(0, 8);
    const userOne = await prisma.user.create({
      data: { email: `quiz-test-one-${suffix}@example.com`, name: 'Quiz Test One' },
    });
    const userTwo = await prisma.user.create({
      data: { email: `quiz-test-two-${suffix}@example.com`, name: 'Quiz Test Two' },
    });
    userOneId = userOne.id;
    userTwoId = userTwo.id;

    const path = await prisma.learningPath.create({
      data: {
        slug: `quiz-test-path-${suffix}`,
        title: 'Quiz Test Path',
        description: 'Path used by quiz engine tests.',
        status: PublicationStatus.PUBLISHED,
        order: 9_100,
      },
    });
    pathId = path.id;

    const freeCourse = await prisma.course.create({
      data: {
        learningPathId: pathId,
        slug: 'quiz-free-course',
        title: 'Quiz Free Course',
        shortDescription: 'Course used by quiz engine tests.',
        status: PublicationStatus.PUBLISHED,
        accessTier: AccessTier.FREE,
        order: 0,
      },
    });
    const freeModule = await prisma.courseModule.create({
      data: {
        courseId: freeCourse.id,
        slug: 'quiz-free-module',
        title: 'Quiz Free Module',
        order: 0,
      },
    });

    const requiredLesson = await prisma.lesson.create({
      data: {
        moduleId: freeModule.id,
        slug: 'quiz-required-lesson',
        title: 'Quiz Required Lesson',
        summary: 'Completion requires passing the lesson quiz.',
        objective: 'Verify quiz-gated completion.',
        status: PublicationStatus.PUBLISHED,
        accessTier: AccessTier.FREE,
        requiresQuiz: true,
        order: 0,
        estimatedMinutes: 5,
        blocks: {
          create: [
            {
              type: ContentBlockType.PARAGRAPH,
              order: 0,
              payload: { text: 'Finish this lesson and pass the quiz.' },
            },
          ],
        },
      },
    });
    requiredLessonId = requiredLesson.id;

    const optionalLesson = await prisma.lesson.create({
      data: {
        moduleId: freeModule.id,
        slug: 'quiz-optional-lesson',
        title: 'Quiz Optional Lesson',
        summary: 'A lesson that does not require a quiz.',
        objective: 'Verify optional quiz completion.',
        status: PublicationStatus.PUBLISHED,
        accessTier: AccessTier.FREE,
        requiresQuiz: false,
        order: 1,
        estimatedMinutes: 5,
      },
    });
    optionalLessonId = optionalLesson.id;

    const missingQuizLesson = await prisma.lesson.create({
      data: {
        moduleId: freeModule.id,
        slug: 'quiz-missing-lesson',
        title: 'Quiz Missing Lesson',
        summary: 'A lesson flagged for a quiz that does not exist.',
        objective: 'Fail closed.',
        status: PublicationStatus.PUBLISHED,
        accessTier: AccessTier.FREE,
        requiresQuiz: true,
        order: 2,
        estimatedMinutes: 5,
      },
    });
    missingQuizLessonId = missingQuizLesson.id;

    const emptyLesson = await prisma.lesson.create({
      data: {
        moduleId: freeModule.id,
        slug: 'quiz-empty-lesson',
        title: 'Quiz Empty Lesson',
        summary: 'A lesson with an empty quiz.',
        objective: 'Verify safe empty-quiz handling.',
        status: PublicationStatus.PUBLISHED,
        accessTier: AccessTier.FREE,
        order: 3,
        estimatedMinutes: 5,
      },
    });
    emptyLessonId = emptyLesson.id;

    const draftQuizLesson = await prisma.lesson.create({
      data: {
        moduleId: freeModule.id,
        slug: 'quiz-draft-lesson',
        title: 'Quiz Draft Lesson',
        summary: 'A lesson whose quiz is not published.',
        objective: 'Keep draft quizzes hidden.',
        status: PublicationStatus.PUBLISHED,
        accessTier: AccessTier.FREE,
        order: 4,
        estimatedMinutes: 5,
      },
    });
    draftQuizLessonId = draftQuizLesson.id;

    const premiumCourse = await prisma.course.create({
      data: {
        learningPathId: pathId,
        slug: 'quiz-premium-course',
        title: 'Quiz Premium Course',
        shortDescription: 'Premium course used by quiz access tests.',
        status: PublicationStatus.PUBLISHED,
        accessTier: AccessTier.PREMIUM,
        order: 1,
      },
    });
    const premiumModule = await prisma.courseModule.create({
      data: {
        courseId: premiumCourse.id,
        slug: 'quiz-premium-module',
        title: 'Quiz Premium Module',
        order: 0,
      },
    });
    const premiumLesson = await prisma.lesson.create({
      data: {
        moduleId: premiumModule.id,
        slug: 'quiz-premium-lesson',
        title: 'Quiz Premium Lesson',
        summary: 'Premium lesson with a quiz.',
        objective: 'Verify premium quiz gating.',
        status: PublicationStatus.PUBLISHED,
        accessTier: AccessTier.PREMIUM,
        order: 0,
        estimatedMinutes: 5,
      },
    });
    premiumLessonId = premiumLesson.id;

    const requiredQuiz = await prisma.quiz.create({
      data: {
        slug: `quiz-required-${suffix}`,
        lessonId: requiredLessonId,
        kind: QuizKind.LESSON,
        title: 'Required Quiz',
        description: 'Two questions with weighted points.',
        passingScore: 60,
        xpReward: 5,
        status: PublicationStatus.PUBLISHED,
        questions: {
          create: [
            {
              type: QuestionType.SCENARIO,
              prompt: 'Pick the first correct answer.',
              scenario: 'A learner is checking their understanding.',
              explanation: 'Option A is correct for question one.',
              order: 0,
              points: 1,
              options: {
                create: [
                  {
                    text: 'Correct one',
                    order: 0,
                    isCorrect: true,
                    feedback: 'Well done on question one.',
                  },
                  { text: 'Wrong one', order: 1, isCorrect: false, feedback: 'Try again.' },
                ],
              },
            },
            {
              type: QuestionType.SINGLE_CHOICE,
              prompt: 'Pick the second correct answer.',
              explanation: 'Option A is also correct for question two.',
              order: 1,
              points: 2,
              options: {
                create: [
                  {
                    text: 'Correct two',
                    order: 0,
                    isCorrect: true,
                    feedback: 'Well done on question two.',
                  },
                  { text: 'Wrong two', order: 1, isCorrect: false },
                ],
              },
            },
          ],
        },
      },
      include: { questions: { include: { options: true } } },
    });
    requiredQuizId = requiredQuiz.id;
    const questionOne = requiredQuiz.questions.find((question) => question.order === 0);
    const questionTwo = requiredQuiz.questions.find((question) => question.order === 1);
    if (!questionOne || !questionTwo) throw new Error('Required quiz questions were not created.');
    questionOneId = questionOne.id;
    questionTwoId = questionTwo.id;
    questionOneCorrectOptionId = questionOne.options.find((option) => option.isCorrect)!.id;
    questionOneWrongOptionId = questionOne.options.find((option) => !option.isCorrect)!.id;
    questionTwoCorrectOptionId = questionTwo.options.find((option) => option.isCorrect)!.id;
    questionTwoWrongOptionId = questionTwo.options.find((option) => !option.isCorrect)!.id;

    const emptyQuiz = await prisma.quiz.create({
      data: {
        slug: `quiz-empty-${suffix}`,
        lessonId: emptyLessonId,
        kind: QuizKind.LESSON,
        title: 'Empty Quiz',
        status: PublicationStatus.PUBLISHED,
        xpReward: 5,
      },
    });
    emptyQuizId = emptyQuiz.id;

    const draftQuiz = await prisma.quiz.create({
      data: {
        slug: `quiz-draft-${suffix}`,
        lessonId: draftQuizLessonId,
        kind: QuizKind.LESSON,
        title: 'Draft Quiz',
        status: PublicationStatus.DRAFT,
        questions: {
          create: [
            {
              type: QuestionType.TRUE_FALSE,
              prompt: 'Draft question.',
              explanation: 'This question is not live.',
              order: 0,
              points: 1,
              options: {
                create: [
                  { text: 'True', order: 0, isCorrect: true },
                  { text: 'False', order: 1, isCorrect: false },
                ],
              },
            },
          ],
        },
      },
    });
    draftQuizId = draftQuiz.id;

    const premiumQuiz = await prisma.quiz.create({
      data: {
        slug: `quiz-premium-${suffix}`,
        lessonId: premiumLessonId,
        kind: QuizKind.LESSON,
        title: 'Premium Quiz',
        status: PublicationStatus.PUBLISHED,
        questions: {
          create: [
            {
              type: QuestionType.TRUE_FALSE,
              prompt: 'Premium question.',
              explanation: 'Premium content explanation.',
              order: 0,
              points: 1,
              options: {
                create: [
                  { text: 'True', order: 0, isCorrect: true },
                  { text: 'False', order: 1, isCorrect: false },
                ],
              },
            },
          ],
        },
      },
      include: { questions: { include: { options: true } } },
    });
    premiumQuizId = premiumQuiz.id;
    premiumQuestionId = premiumQuiz.questions[0].id;
    premiumOptionId = premiumQuiz.questions[0].options[0].id;

    const dailyQuiz = await prisma.quiz.create({
      data: {
        slug: `quiz-daily-${suffix}`,
        kind: QuizKind.DAILY_CHALLENGE,
        title: 'Daily Quiz',
        status: PublicationStatus.PUBLISHED,
        questions: {
          create: [
            {
              type: QuestionType.TRUE_FALSE,
              prompt: 'Daily question.',
              explanation: 'Daily explanation.',
              order: 0,
              points: 1,
              options: {
                create: [
                  { text: 'True', order: 0, isCorrect: true },
                  { text: 'False', order: 1, isCorrect: false },
                ],
              },
            },
          ],
        },
      },
    });
    dailyQuizId = dailyQuiz.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userOneId, userTwoId] } } });
    await prisma.learningPath.deleteMany({ where: { id: pathId } });
    await prisma.$disconnect();
  });

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

  it('returns quiz questions without revealing correctness', async () => {
    const lessonQuiz = await quiz.getLessonQuiz(userOneId, requiredLessonId);

    expect(lessonQuiz).toMatchObject({
      id: requiredQuizId,
      lessonId: requiredLessonId,
      title: 'Required Quiz',
      passingScore: 60,
      xpReward: 5,
      questionCount: 2,
      totalPoints: 3,
      latestAttempt: null,
    });
    expect(lessonQuiz.questions.map((question) => question.order)).toEqual([0, 1]);
    expect(lessonQuiz.questions[0]).toMatchObject({
      type: QuestionType.SCENARIO,
      points: 1,
      scenario: 'A learner is checking their understanding.',
    });
    for (const question of lessonQuiz.questions) {
      for (const option of question.options) {
        expect(option).toEqual({
          id: expect.any(String),
          text: expect.any(String),
          order: expect.any(Number),
        });
      }
    }

    const lesson = await content.getLesson(userOneId, requiredLessonId);
    expect(lesson.quiz).toMatchObject({
      required: true,
      attemptCount: 0,
      bestScore: null,
      passed: false,
      activeAttemptId: null,
    });

    const empty = await quiz.getLessonQuiz(userOneId, emptyLessonId);
    expect(empty).toMatchObject({ questionCount: 0, totalPoints: 0, questions: [] });
  });

  it('blocks quiz-gated lesson completion until a passing attempt exists', async () => {
    await expectApiError(content.completeLesson(userOneId, requiredLessonId), 'QUIZ_REQUIRED', 422);
    await expectApiError(
      content.completeLesson(userOneId, missingQuizLessonId),
      'QUIZ_UNAVAILABLE',
      422,
    );

    const optional = await content.completeLesson(userOneId, optionalLessonId);
    expect(optional).toMatchObject({
      status: LessonProgressStatus.COMPLETED,
      alreadyCompleted: false,
    });
    expect(optional.rewards.xpBreakdown.lessonXp).toBe(10);

    const optionalAgain = await content.completeLesson(userOneId, optionalLessonId);
    expect(optionalAgain.alreadyCompleted).toBe(true);
  });

  it('starts, resumes, answers and scores an attempt exactly once', async () => {
    const started = await quiz.startAttempt(userOneId, requiredQuizId);
    expect(started).toMatchObject({
      quizId: requiredQuizId,
      totalQuestions: 2,
      resumed: false,
      attempt: {
        attemptNumber: 1,
        status: QuizAttemptStatus.IN_PROGRESS,
        score: null,
        answeredCount: 0,
        totalQuestions: 0,
        xpAwarded: 0,
      },
    });
    firstAttemptId = started.attempt.id;

    const resumed = await quiz.startAttempt(userOneId, requiredQuizId);
    expect(resumed.resumed).toBe(true);
    expect(resumed.attempt.id).toBe(firstAttemptId);

    const withActiveAttempt = await content.getLesson(userOneId, requiredLessonId);
    expect(withActiveAttempt.quiz).toMatchObject({
      attemptCount: 1,
      activeAttemptId: firstAttemptId,
      passed: false,
      bestScore: null,
    });

    const firstAnswer = await quiz.saveAnswer(userOneId, firstAttemptId, {
      questionId: questionOneId,
      selectedOptionId: questionOneCorrectOptionId,
    });
    expect(firstAnswer).toMatchObject({
      status: QuizAttemptStatus.IN_PROGRESS,
      answeredCount: 1,
      score: null,
    });

    const partial = await quiz.saveAnswer(userOneId, firstAttemptId, {
      questionId: questionTwoId,
      selectedOptionId: questionTwoWrongOptionId,
    });
    expect(partial.answeredCount).toBe(2);
    expect(partial.score).toBeNull();

    // Answers can change before submission, and correctness is still hidden.
    const changed = await quiz.saveAnswer(userOneId, firstAttemptId, {
      questionId: questionTwoId,
      selectedOptionId: questionTwoCorrectOptionId,
    });
    expect(changed.answeredCount).toBe(2);
    expect(changed.score).toBeNull();

    const recovered = await quiz.startAttempt(userOneId, requiredQuizId);
    expect(recovered.resumed).toBe(true);
    expect(recovered.attempt.id).toBe(firstAttemptId);
    expect(recovered.answers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          questionId: questionOneId,
          selectedOptionId: questionOneCorrectOptionId,
        }),
        expect.objectContaining({
          questionId: questionTwoId,
          selectedOptionId: questionTwoCorrectOptionId,
        }),
      ]),
    );

    const submitted = await quiz.submitAttempt(userOneId, firstAttemptId);
    expect(submitted.firstAttempt).toBe(true);
    expect(submitted.attempt).toMatchObject({
      id: firstAttemptId,
      status: QuizAttemptStatus.SUBMITTED,
      score: 100,
      passingScore: 60,
      passed: true,
      correctCount: 2,
      totalQuestions: 2,
      answeredCount: 2,
      xpAwarded: 5,
    });
    expect(submitted.rewards).not.toBeNull();
    expect(submitted.rewards?.xpBreakdown.quizXp).toBe(5);
    expect(submitted.rewards?.xpEarned).toBeGreaterThanOrEqual(5);
    expect(submitted.questions).toHaveLength(2);
    expect(submitted.questions[1]).toMatchObject({
      id: questionTwoId,
      explanation: 'Option A is also correct for question two.',
      selectedOptionId: questionTwoCorrectOptionId,
      isCorrect: true,
      earnedPoints: 2,
    });
    const correctOption = submitted.questions[1].options.find(
      (option) => option.id === questionTwoCorrectOptionId,
    );
    const wrongOption = submitted.questions[1].options.find(
      (option) => option.id === questionTwoWrongOptionId,
    );
    expect(correctOption).toMatchObject({
      isCorrect: true,
      selected: true,
      feedback: 'Well done on question two.',
    });
    expect(wrongOption).toMatchObject({ isCorrect: false, selected: false });

    const results = await quiz.getResults(userOneId, firstAttemptId);
    expect(results.attempt.score).toBe(100);
    expect(results.questions[0].options.filter((option) => option.isCorrect)).toHaveLength(1);

    const xpBeforeDuplicate = await prisma.userStats.findUniqueOrThrow({
      where: { userId: userOneId },
      select: { totalXp: true },
    });
    const duplicate = await quiz.submitAttempt(userOneId, firstAttemptId);
    expect(duplicate).toMatchObject({
      firstAttempt: false,
      rewards: null,
      attempt: { id: firstAttemptId, score: 100, xpAwarded: 5 },
    });
    const xpAfterDuplicate = await prisma.userStats.findUniqueOrThrow({
      where: { userId: userOneId },
      select: { totalXp: true },
    });
    expect(xpAfterDuplicate.totalXp).toBe(xpBeforeDuplicate.totalXp);

    const ledger = await prisma.xPTransaction.findMany({
      where: {
        userId: userOneId,
        sourceType: 'QUIZ_ATTEMPT',
        sourceId: firstAttemptId,
      },
      select: { amount: true },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amount).toBe(5);

    await expectApiError(
      quiz.saveAnswer(userOneId, firstAttemptId, {
        questionId: questionOneId,
        selectedOptionId: questionOneWrongOptionId,
      }),
      'QUIZ_ATTEMPT_SUBMITTED',
      409,
    );

    const summary = await content.getLesson(userOneId, requiredLessonId);
    expect(summary.quiz).toMatchObject({
      attemptCount: 1,
      bestScore: 100,
      passed: true,
      activeAttemptId: null,
    });
  });

  it('scores retakes without awarding quiz XP twice', async () => {
    const retake = await quiz.startAttempt(userOneId, requiredQuizId);
    expect(retake).toMatchObject({ resumed: false, attempt: { attemptNumber: 2 } });

    await quiz.saveAnswer(userOneId, retake.attempt.id, {
      questionId: questionOneId,
      selectedOptionId: questionOneCorrectOptionId,
    });
    const concurrent = await Promise.all([
      quiz.submitAttempt(userOneId, retake.attempt.id),
      quiz.submitAttempt(userOneId, retake.attempt.id),
    ]);
    expect(concurrent.filter((result) => result.rewards !== null)).toHaveLength(1);
    const submitted = concurrent.find((result) => result.rewards !== null) ?? concurrent[0];

    expect(submitted).toMatchObject({
      firstAttempt: false,
      attempt: {
        attemptNumber: 2,
        status: QuizAttemptStatus.SUBMITTED,
        score: 33,
        passed: false,
        correctCount: 1,
        totalQuestions: 2,
        answeredCount: 1,
        xpAwarded: 0,
      },
    });
    expect(submitted.rewards?.xpBreakdown.quizXp).toBe(0);
    expect(submitted.questions[1]).toMatchObject({
      selectedOptionId: null,
      isCorrect: false,
      earnedPoints: 0,
    });

    const positiveQuizXp = await prisma.xPTransaction.aggregate({
      where: {
        userId: userOneId,
        sourceType: 'QUIZ_ATTEMPT',
        amount: { gt: 0 },
      },
      _sum: { amount: true },
      _count: true,
    });
    expect(positiveQuizXp._count).toBe(1);
    expect(positiveQuizXp._sum.amount).toBe(5);

    const lesson = await content.getLesson(userOneId, requiredLessonId);
    expect(lesson.quiz).toMatchObject({
      attemptCount: 2,
      bestScore: 100,
      passed: true,
    });
    expect(lesson.quiz?.activeAttemptId).toBeNull();
  });

  it('completes a quiz-gated lesson after a passing attempt and stays idempotent', async () => {
    const completed = await content.completeLesson(userOneId, requiredLessonId);
    expect(completed).toMatchObject({
      status: LessonProgressStatus.COMPLETED,
      alreadyCompleted: false,
    });
    expect(completed.rewards.xpBreakdown.lessonXp).toBe(10);

    const again = await content.completeLesson(userOneId, requiredLessonId);
    expect(again.alreadyCompleted).toBe(true);
    expect(again.completedAt?.toISOString()).toBe(completed.completedAt?.toISOString());

    const lessonXp = await prisma.xPTransaction.findMany({
      where: { userId: userOneId, sourceType: 'LESSON', sourceId: requiredLessonId },
      select: { amount: true },
    });
    expect(lessonXp).toHaveLength(1);
    expect(lessonXp[0].amount).toBe(10);

    const detail = await content.getLesson(userOneId, requiredLessonId);
    expect(detail.progress).toMatchObject({
      status: LessonProgressStatus.COMPLETED,
      progressPercent: 100,
    });
    expect(detail.quiz).toMatchObject({ passed: true, bestScore: 100 });
  });

  it('enforces attempt ownership and validates question and option ids', async () => {
    const otherAttempt = await quiz.startAttempt(userTwoId, requiredQuizId);

    await expectApiError(
      quiz.getResults(userTwoId, otherAttempt.attempt.id),
      'QUIZ_ATTEMPT_NOT_SUBMITTED',
      409,
    );
    await expectApiError(
      quiz.saveAnswer(userOneId, otherAttempt.attempt.id, {
        questionId: questionOneId,
        selectedOptionId: questionOneCorrectOptionId,
      }),
      'QUIZ_ATTEMPT_NOT_FOUND',
      404,
    );
    await expectApiError(
      quiz.submitAttempt(userOneId, otherAttempt.attempt.id),
      'QUIZ_ATTEMPT_NOT_FOUND',
      404,
    );
    await expectApiError(
      quiz.getResults(userOneId, otherAttempt.attempt.id),
      'QUIZ_ATTEMPT_NOT_FOUND',
      404,
    );
    await expectApiError(
      quiz.saveAnswer(userOneId, 'missing-attempt', {
        questionId: questionOneId,
        selectedOptionId: questionOneCorrectOptionId,
      }),
      'QUIZ_ATTEMPT_NOT_FOUND',
      404,
    );
    await expectApiError(
      quiz.saveAnswer(userTwoId, otherAttempt.attempt.id, {
        questionId: premiumQuestionId,
        selectedOptionId: premiumOptionId,
      }),
      'QUIZ_QUESTION_NOT_FOUND',
      404,
    );
    await expectApiError(
      quiz.saveAnswer(userTwoId, otherAttempt.attempt.id, {
        questionId: questionOneId,
        selectedOptionId: premiumOptionId,
      }),
      'QUIZ_OPTION_NOT_FOUND',
      404,
    );
  });

  it('handles empty, draft, premium and non-lesson quizzes safely', async () => {
    await expectApiError(quiz.startAttempt(userOneId, emptyQuizId), 'QUIZ_EMPTY', 422);
    await expectApiError(quiz.startAttempt(userOneId, draftQuizId), 'QUIZ_NOT_FOUND', 404);
    await expectApiError(quiz.getLessonQuiz(userOneId, draftQuizLessonId), 'QUIZ_NOT_FOUND', 404);
    await expectApiError(quiz.getLessonQuiz(userOneId, premiumLessonId), 'PREMIUM_REQUIRED', 403);
    await expectApiError(quiz.startAttempt(userOneId, premiumQuizId), 'PREMIUM_REQUIRED', 403);
    await expectApiError(quiz.startAttempt(userOneId, dailyQuizId), 'QUIZ_NOT_FOUND', 404);
    await expectApiError(quiz.getLessonQuiz(userOneId, 'missing-lesson'), 'LESSON_NOT_FOUND', 404);
  });
});
