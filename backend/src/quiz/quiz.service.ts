import { Injectable } from '@nestjs/common';
import type { Prisma, QuizAttempt } from '../generated/prisma/client';
import {
  PublicationStatus,
  QuestionType,
  QuizAttemptStatus,
  QuizKind,
} from '../generated/prisma/enums';
import { isPrismaErrorWithCode } from '../common/prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { effectiveAccessTier, isLocked } from '../content/content.types';
import { lessonNotFound, premiumRequired } from '../content/content.errors';
import { hasPremiumAccess } from '../content/premium-access';
import { GamificationService } from '../gamification/gamification.service';
import { AnswerQuizDto } from './dto/answer-quiz.dto';
import {
  quizAttemptClosed,
  quizAttemptNotFound,
  quizAttemptNotSubmitted,
  quizAttemptSubmitted,
  quizEmpty,
  quizNotFound,
  quizOptionNotFound,
  quizQuestionNotFound,
} from './quiz.errors';
import {
  LessonQuizView,
  QuizAttemptStartView,
  QuizAttemptSummaryView,
  QuizResultView,
  QuizSavedAnswerView,
  QuizSubmissionView,
  toQuizAttemptSummary,
} from './quiz.types';

interface QuizForAttempt {
  id: string;
  title: string;
  status: PublicationStatus;
  passingScore: number;
  xpReward: number;
  timeLimitSeconds: number | null;
  lessonId: string | null;
}

type AttemptWithQuiz = QuizAttempt & { quiz: QuizForAttempt };
type DbClient = Prisma.TransactionClient | PrismaService;

interface ResultOption {
  id: string;
  text: string;
  order: number;
  feedback: string | null;
  isCorrect: boolean;
}

interface ResultQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  scenario: string | null;
  explanation: string;
  order: number;
  points: number;
  options: ResultOption[];
}

@Injectable()
export class QuizService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  async getLessonQuiz(userId: string, lessonId: string): Promise<LessonQuizView> {
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
        accessTier: true,
        module: { select: { course: { select: { accessTier: true } } } },
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
            questions: {
              orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
              select: {
                id: true,
                type: true,
                prompt: true,
                scenario: true,
                order: true,
                points: true,
                options: {
                  orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
                  select: { id: true, text: true, order: true },
                },
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      throw lessonNotFound();
    }

    const premium = await hasPremiumAccess(this.prisma, userId);
    const tier = effectiveAccessTier(lesson.module.course.accessTier, lesson.accessTier);
    if (isLocked(tier, premium)) {
      throw premiumRequired();
    }

    const quiz = lesson.quizzes[0];
    if (!quiz) {
      throw quizNotFound();
    }

    const latest = await this.findLatestAttempt(this.prisma, userId, quiz.id);

    return {
      id: quiz.id,
      slug: quiz.slug,
      title: quiz.title,
      description: quiz.description,
      lessonId: lesson.id,
      passingScore: quiz.passingScore,
      xpReward: quiz.xpReward,
      timeLimitSeconds: quiz.timeLimitSeconds,
      questionCount: quiz.questions.length,
      totalPoints: quiz.questions.reduce((sum, question) => sum + Math.max(0, question.points), 0),
      questions: quiz.questions.map((question) => ({
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        scenario: question.scenario,
        order: question.order,
        points: question.points,
        options: question.options,
      })),
      latestAttempt: latest
        ? {
            ...toQuizAttemptSummary(latest, latest._count.answers, quiz.passingScore),
            quizTitle: quiz.title,
            answers: latest.answers,
          }
        : null,
    };
  }

  async startAttempt(userId: string, quizId: string): Promise<QuizAttemptStartView> {
    const quiz = await this.prisma.quiz.findFirst({
      where: {
        id: quizId,
        status: PublicationStatus.PUBLISHED,
        kind: QuizKind.LESSON,
        lesson: {
          is: {
            status: PublicationStatus.PUBLISHED,
            module: {
              course: {
                status: PublicationStatus.PUBLISHED,
                learningPath: { status: PublicationStatus.PUBLISHED },
              },
            },
          },
        },
      },
      select: {
        id: true,
        title: true,
        passingScore: true,
        xpReward: true,
        timeLimitSeconds: true,
        _count: { select: { questions: true } },
        lesson: {
          select: {
            accessTier: true,
            module: { select: { course: { select: { accessTier: true } } } },
          },
        },
      },
    });

    if (!quiz || !quiz.lesson) {
      throw quizNotFound();
    }
    if (quiz._count.questions === 0) {
      throw quizEmpty();
    }

    const premium = await hasPremiumAccess(this.prisma, userId);
    const tier = effectiveAccessTier(quiz.lesson.module.course.accessTier, quiz.lesson.accessTier);
    if (isLocked(tier, premium)) {
      throw premiumRequired();
    }

    const latest = await this.findLatestAttempt(this.prisma, userId, quiz.id);
    if (latest?.status === QuizAttemptStatus.IN_PROGRESS) {
      return {
        quizId: quiz.id,
        quizTitle: quiz.title,
        passingScore: quiz.passingScore,
        xpReward: quiz.xpReward,
        timeLimitSeconds: quiz.timeLimitSeconds,
        totalQuestions: quiz._count.questions,
        resumed: true,
        attempt: toQuizAttemptSummary(latest, latest._count.answers, quiz.passingScore),
        answers: latest.answers,
      };
    }

    const attemptNumber = (latest?.attemptNumber ?? 0) + 1;
    try {
      const attempt = await this.prisma.quizAttempt.create({
        data: {
          userId,
          quizId: quiz.id,
          attemptNumber,
          status: QuizAttemptStatus.IN_PROGRESS,
        },
      });

      return {
        quizId: quiz.id,
        quizTitle: quiz.title,
        passingScore: quiz.passingScore,
        xpReward: quiz.xpReward,
        timeLimitSeconds: quiz.timeLimitSeconds,
        totalQuestions: quiz._count.questions,
        resumed: false,
        attempt: toQuizAttemptSummary(attempt, 0, quiz.passingScore),
        answers: [],
      };
    } catch (error) {
      if (!isPrismaErrorWithCode(error, 'P2002')) {
        throw error;
      }

      // Another request created the next attempt first. Resume that attempt
      // instead of creating a duplicate.
      const concurrent = await this.findLatestAttempt(this.prisma, userId, quiz.id);
      if (concurrent?.status !== QuizAttemptStatus.IN_PROGRESS) {
        throw error;
      }

      return {
        quizId: quiz.id,
        quizTitle: quiz.title,
        passingScore: quiz.passingScore,
        xpReward: quiz.xpReward,
        timeLimitSeconds: quiz.timeLimitSeconds,
        totalQuestions: quiz._count.questions,
        resumed: true,
        attempt: toQuizAttemptSummary(concurrent, concurrent._count.answers, quiz.passingScore),
        answers: concurrent.answers,
      };
    }
  }

  async saveAnswer(
    userId: string,
    attemptId: string,
    dto: AnswerQuizDto,
  ): Promise<QuizAttemptSummaryView> {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Lock the attempt while checking its status. Submission claims the same
      // row, so an answer cannot be silently written after scoring.
      const locked = await tx.quizAttempt.updateMany({
        where: {
          id: attemptId,
          userId,
          status: QuizAttemptStatus.IN_PROGRESS,
        },
        data: { updatedAt: now },
      });
      if (locked.count === 0) {
        const existing = await tx.quizAttempt.findFirst({
          where: { id: attemptId, userId },
          select: { status: true },
        });
        if (!existing) {
          throw quizAttemptNotFound();
        }
        if (existing.status === QuizAttemptStatus.SUBMITTED) {
          throw quizAttemptSubmitted();
        }
        throw quizAttemptClosed();
      }

      const attempt = await this.loadAttempt(tx, userId, attemptId);
      if (attempt.quiz.status !== PublicationStatus.PUBLISHED) {
        throw quizAttemptClosed();
      }
      const question = await tx.question.findFirst({
        where: { id: dto.questionId, quizId: attempt.quizId },
        select: {
          id: true,
          options: {
            where: { id: dto.selectedOptionId },
            select: { id: true },
          },
        },
      });
      if (!question) {
        throw quizQuestionNotFound();
      }
      if (question.options.length === 0) {
        throw quizOptionNotFound();
      }

      await tx.quizAnswer.upsert({
        where: {
          attemptId_questionId: {
            attemptId,
            questionId: dto.questionId,
          },
        },
        create: {
          attemptId,
          questionId: dto.questionId,
          selectedOptionId: dto.selectedOptionId,
          isCorrect: false,
          answeredAt: now,
        },
        update: {
          selectedOptionId: dto.selectedOptionId,
          isCorrect: false,
          answeredAt: now,
        },
      });
      const answeredCount = await tx.quizAnswer.count({ where: { attemptId } });

      return toQuizAttemptSummary(attempt, answeredCount, attempt.quiz.passingScore);
    });
  }

  async submitAttempt(userId: string, attemptId: string): Promise<QuizSubmissionView> {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const attempt = await this.loadAttempt(tx, userId, attemptId);
      if (attempt.status === QuizAttemptStatus.SUBMITTED) {
        return {
          ...(await this.buildResult(tx, attempt)),
          firstAttempt: false,
          rewards: null,
        };
      }
      if (attempt.status !== QuizAttemptStatus.IN_PROGRESS) {
        throw quizAttemptClosed();
      }
      if (attempt.quiz.status !== PublicationStatus.PUBLISHED) {
        throw quizAttemptClosed();
      }

      // Claim the attempt before reading answers. The conditional update locks
      // the row, so a concurrent answer save either lands before this claim or
      // is rejected after submission; a concurrent submit loses the claim and
      // returns the stored result.
      const claimed = await tx.quizAttempt.updateMany({
        where: {
          id: attemptId,
          userId,
          status: QuizAttemptStatus.IN_PROGRESS,
        },
        data: {
          status: QuizAttemptStatus.SUBMITTED,
          submittedAt: now,
          submissionKey: `quiz-submit:${attemptId}`,
        },
      });

      if (claimed.count === 0) {
        const fresh = await this.loadAttempt(tx, userId, attemptId);
        if (fresh.status !== QuizAttemptStatus.SUBMITTED) {
          throw quizAttemptClosed();
        }
        return {
          ...(await this.buildResult(tx, fresh)),
          firstAttempt: false,
          rewards: null,
        };
      }

      const questions = await this.loadResultQuestions(tx, attempt.quizId);
      if (questions.length === 0) {
        throw quizEmpty();
      }

      const totalPoints = questions.reduce(
        (sum, question) => sum + Math.max(0, question.points),
        0,
      );
      if (totalPoints <= 0) {
        throw quizEmpty();
      }

      const answers = await tx.quizAnswer.findMany({ where: { attemptId } });
      const answerByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));
      let correctCount = 0;
      let correctPoints = 0;

      for (const question of questions) {
        const answer = answerByQuestion.get(question.id);
        const selectedOption = question.options.find(
          (option) => option.id === answer?.selectedOptionId,
        );
        const isCorrect = Boolean(selectedOption?.isCorrect);
        if (isCorrect) {
          correctCount += 1;
          correctPoints += Math.max(0, question.points);
        }
        if (answer) {
          answer.isCorrect = isCorrect;
        }
      }

      const score = Math.round((correctPoints / totalPoints) * 100);
      const firstAttempt =
        (await tx.quizAttempt.count({
          where: {
            userId,
            quizId: attempt.quizId,
            status: QuizAttemptStatus.SUBMITTED,
            id: { not: attemptId },
          },
        })) === 0;

      for (const answer of answers) {
        await tx.quizAnswer.update({
          where: { id: answer.id },
          data: { isCorrect: answer.isCorrect },
        });
      }

      await tx.quizAttempt.update({
        where: { id: attemptId },
        data: {
          score,
          correctCount,
          totalQuestions: questions.length,
        },
      });

      const rewards = await this.gamification.awardQuizCompletion(tx, {
        userId,
        attemptId,
        quizId: attempt.quizId,
        xpAmount: firstAttempt ? attempt.quiz.xpReward : 0,
        now,
      });
      // `xpAwarded` records the quiz's own reward, not achievement bonuses
      // included in the aggregate reward response.
      const xpAwarded = firstAttempt ? Math.max(0, Math.floor(attempt.quiz.xpReward)) : 0;
      const saved = await tx.quizAttempt.update({
        where: { id: attemptId },
        data: { xpAwarded },
      });

      return {
        ...(await this.buildResult(tx, { ...saved, quiz: attempt.quiz })),
        firstAttempt,
        rewards,
      };
    });
  }

  async getResults(userId: string, attemptId: string): Promise<QuizResultView> {
    const attempt = await this.loadAttempt(this.prisma, userId, attemptId);
    if (attempt.status === QuizAttemptStatus.IN_PROGRESS) {
      throw quizAttemptNotSubmitted();
    }
    if (attempt.status !== QuizAttemptStatus.SUBMITTED) {
      throw quizAttemptClosed();
    }

    return this.buildResult(this.prisma, attempt);
  }

  private async buildResult(client: DbClient, attempt: AttemptWithQuiz): Promise<QuizResultView> {
    const [questions, answers] = await Promise.all([
      this.loadResultQuestions(client, attempt.quizId),
      client.quizAnswer.findMany({ where: { attemptId: attempt.id } }),
    ]);
    const answerByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));

    return {
      quiz: {
        id: attempt.quiz.id,
        title: attempt.quiz.title,
        passingScore: attempt.quiz.passingScore,
        xpReward: attempt.quiz.xpReward,
      },
      attempt: toQuizAttemptSummary(attempt, answers.length, attempt.quiz.passingScore),
      questions: questions.map((question) => {
        const answer = answerByQuestion.get(question.id);
        const selectedOption = question.options.find(
          (option) => option.id === answer?.selectedOptionId,
        );
        const isCorrect = Boolean(selectedOption?.isCorrect);

        return {
          id: question.id,
          type: question.type,
          prompt: question.prompt,
          scenario: question.scenario,
          explanation: question.explanation,
          order: question.order,
          points: question.points,
          selectedOptionId: answer?.selectedOptionId ?? null,
          isCorrect,
          earnedPoints: isCorrect ? Math.max(0, question.points) : 0,
          options: question.options.map((option) => ({
            id: option.id,
            text: option.text,
            order: option.order,
            feedback: option.feedback,
            isCorrect: option.isCorrect,
            selected: option.id === answer?.selectedOptionId,
          })),
        };
      }),
    };
  }

  private async loadResultQuestions(client: DbClient, quizId: string): Promise<ResultQuestion[]> {
    return client.question.findMany({
      where: { quizId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        type: true,
        prompt: true,
        scenario: true,
        explanation: true,
        order: true,
        points: true,
        options: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            text: true,
            order: true,
            feedback: true,
            isCorrect: true,
          },
        },
      },
    });
  }

  private async loadAttempt(
    client: DbClient,
    userId: string,
    attemptId: string,
  ): Promise<AttemptWithQuiz> {
    const attempt = await client.quizAttempt.findFirst({
      where: { id: attemptId, userId },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            status: true,
            passingScore: true,
            xpReward: true,
            timeLimitSeconds: true,
            lessonId: true,
          },
        },
      },
    });
    if (!attempt) {
      throw quizAttemptNotFound();
    }
    return attempt;
  }

  private async findLatestAttempt(
    client: DbClient,
    userId: string,
    quizId: string,
  ): Promise<
    | (QuizAttempt & {
        _count: { answers: number };
        answers: QuizSavedAnswerView[];
      })
    | null
  > {
    return client.quizAttempt.findFirst({
      where: { userId, quizId },
      orderBy: [{ attemptNumber: 'desc' }],
      include: {
        _count: { select: { answers: true } },
        answers: {
          orderBy: [{ answeredAt: 'asc' }, { questionId: 'asc' }],
          select: {
            questionId: true,
            selectedOptionId: true,
            answeredAt: true,
          },
        },
      },
    });
  }
}
