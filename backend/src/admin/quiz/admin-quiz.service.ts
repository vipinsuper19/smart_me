import { Injectable } from '@nestjs/common';
import type { Prisma, Question, Quiz } from '../../generated/prisma/client';
import { PublicationStatus, QuestionType, QuizKind } from '../../generated/prisma/enums';
import { ApiException } from '../../common/errors/api-error';
import { validationError } from '../../common/errors/validation-error';
import { isPrismaErrorWithCode } from '../../common/prisma/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminActionContext } from '../admin.types';
import {
  invalidStatusTransition,
  lessonNotFound,
  optionNotFound,
  publicationBlocked,
  questionNotFound,
  quizAlreadyPublished,
  quizHasAttempts,
  quizNotFound,
} from '../admin.errors';
import { AdminAuditService } from '../audit/admin-audit.service';
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

function assertUpdateHasFields(dto: object): void {
  if (Object.keys(dto).length === 0) {
    throw validationError('body', 'Provide at least one field to update.');
  }
}

@Injectable()
export class AdminQuizService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async listQuizzes(query: QuizListQueryDto) {
    const where: Prisma.QuizWhereInput = {
      ...(query.lessonId ? { lessonId: query.lessonId } : {}),
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
      this.prisma.quiz.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize,
        include: {
          lesson: { select: { id: true, slug: true, title: true, status: true } },
          _count: { select: { questions: true, attempts: true } },
        },
      }),
      this.prisma.quiz.count({ where }),
    ]);

    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getQuiz(id: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        lesson: { select: { id: true, slug: true, title: true, status: true } },
        questions: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          include: {
            options: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] },
            _count: { select: { answers: true } },
          },
        },
        _count: { select: { attempts: true } },
      },
    });

    if (!quiz) {
      throw quizNotFound();
    }

    return quiz;
  }

  async createQuiz(dto: CreateQuizDto, context: AdminActionContext) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: dto.lessonId },
      select: { id: true, slug: true },
    });
    if (!lesson) {
      throw lessonNotFound();
    }

    const latest = await this.prisma.quiz.findFirst({
      where: { lessonId: dto.lessonId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;
    const slug = dto.slug ?? (await this.uniqueSlug(`${lesson.slug}-quiz`, version));

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.quiz.create({
          data: {
            lessonId: dto.lessonId,
            slug,
            version,
            kind: QuizKind.LESSON,
            title: dto.title.trim(),
            description: dto.description ?? null,
            passingScore: dto.passingScore ?? undefined,
            xpReward: dto.xpReward ?? undefined,
            timeLimitSeconds: dto.timeLimitSeconds ?? null,
          },
        });

        await this.audit.record(tx, {
          adminUserId: context.admin.id,
          action: 'QUIZ_CREATED',
          entityType: 'QUIZ',
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

  async updateQuiz(id: string, dto: UpdateQuizDto, context: AdminActionContext) {
    assertUpdateHasFields(dto);
    const existing = await this.prisma.quiz.findUnique({ where: { id } });
    if (!existing) {
      throw quizNotFound();
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.quiz.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.passingScore !== undefined ? { passingScore: dto.passingScore } : {}),
          ...(dto.xpReward !== undefined ? { xpReward: dto.xpReward } : {}),
          ...(dto.timeLimitSeconds !== undefined ? { timeLimitSeconds: dto.timeLimitSeconds } : {}),
        },
      });

      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'QUIZ_UPDATED',
        entityType: 'QUIZ',
        entityId: id,
        before: existing,
        after: updated,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return updated;
    });
  }

  async deleteQuiz(id: string, context: AdminActionContext): Promise<void> {
    const existing = await this.prisma.quiz.findUnique({
      where: { id },
      include: { _count: { select: { attempts: true } } },
    });
    if (!existing) {
      throw quizNotFound();
    }
    if (existing._count.attempts > 0) {
      throw quizHasAttempts();
    }
    if (existing.status === PublicationStatus.PUBLISHED) {
      throw invalidStatusTransition('Unpublish or archive the quiz before deleting it.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.quiz.delete({ where: { id } });
      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'QUIZ_DELETED',
        entityType: 'QUIZ',
        entityId: id,
        before: existing,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    });
  }

  async createVersion(id: string, context: AdminActionContext) {
    const source = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
          include: { options: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } },
        },
      },
    });
    if (!source) {
      throw quizNotFound();
    }
    if (!source.lessonId) {
      throw invalidStatusTransition('Only lesson quizzes can be versioned.');
    }

    const latest = await this.prisma.quiz.findFirst({
      where: { lessonId: source.lessonId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (latest?.version ?? source.version) + 1;
    const slug = await this.uniqueSlug(source.slug.replace(/-quiz-v\d+$/, '-quiz'), version);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.quiz.create({
        data: {
          lessonId: source.lessonId,
          slug,
          version,
          kind: source.kind,
          title: source.title,
          description: source.description,
          passingScore: source.passingScore,
          xpReward: source.xpReward,
          timeLimitSeconds: source.timeLimitSeconds,
          questions: {
            create: source.questions.map((question) => ({
              type: question.type,
              prompt: question.prompt,
              scenario: question.scenario,
              explanation: question.explanation,
              order: question.order,
              points: question.points,
              options: {
                create: question.options.map((option) => ({
                  text: option.text,
                  feedback: option.feedback,
                  isCorrect: option.isCorrect,
                  order: option.order,
                })),
              },
            })),
          },
        },
        include: {
          questions: {
            orderBy: [{ order: 'asc' }],
            include: { options: { orderBy: [{ order: 'asc' }] } },
          },
        },
      });

      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'QUIZ_VERSION_CREATED',
        entityType: 'QUIZ',
        entityId: created.id,
        after: { sourceQuizId: source.id, version: created.version, slug: created.slug },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return created;
    });
  }

  async submitQuizReview(id: string, context: AdminActionContext) {
    return this.transitionQuiz(id, context, 'review', (quiz) => {
      if (quiz.status === PublicationStatus.PUBLISHED) {
        throw invalidStatusTransition('Published quizzes cannot be submitted for review.');
      }
      if (quiz.status === PublicationStatus.ARCHIVED) {
        throw invalidStatusTransition('Archived quizzes cannot be submitted for review.');
      }
      return quiz.status === PublicationStatus.IN_REVIEW
        ? null
        : { status: PublicationStatus.IN_REVIEW };
    });
  }

  async publishQuiz(id: string, context: AdminActionContext) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: { include: { options: true } },
      },
    });
    if (!quiz) {
      throw quizNotFound();
    }
    if (quiz.status === PublicationStatus.PUBLISHED) {
      return this.getQuiz(id);
    }

    this.assertQuizCanPublish(quiz);

    if (quiz.lessonId) {
      const other = await this.prisma.quiz.findFirst({
        where: {
          lessonId: quiz.lessonId,
          status: PublicationStatus.PUBLISHED,
          id: { not: quiz.id },
        },
        select: { id: true, version: true },
      });
      if (other) {
        throw quizAlreadyPublished();
      }
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.quiz.update({
        where: { id },
        data: {
          status: PublicationStatus.PUBLISHED,
          publishedAt: quiz.publishedAt ?? now,
          archivedAt: null,
        },
      });

      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'QUIZ_PUBLISHED',
        entityType: 'QUIZ',
        entityId: id,
        before: { status: quiz.status, publishedAt: quiz.publishedAt, version: quiz.version },
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

  async unpublishQuiz(id: string, context: AdminActionContext) {
    return this.transitionQuiz(id, context, 'unpublish', (quiz) => {
      if (quiz.status !== PublicationStatus.PUBLISHED) {
        throw invalidStatusTransition('Only published quizzes can be unpublished.');
      }
      return { status: PublicationStatus.DRAFT, archivedAt: null };
    });
  }

  async archiveQuiz(id: string, context: AdminActionContext) {
    return this.transitionQuiz(id, context, 'archive', (quiz) => {
      if (quiz.status === PublicationStatus.ARCHIVED) {
        return null;
      }
      return { status: PublicationStatus.ARCHIVED, archivedAt: new Date() };
    });
  }

  // -------------------------------------------------------------------------
  // Questions
  // -------------------------------------------------------------------------

  async createQuestion(quizId: string, dto: CreateQuestionDto, context: AdminActionContext) {
    await this.requireEditableQuiz(quizId);
    this.assertOptionCorrectness(dto.options ?? []);
    const order = dto.order ?? (await this.nextQuestionOrder(quizId));

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.question.create({
        data: {
          quizId,
          type: dto.type,
          prompt: dto.prompt.trim(),
          scenario: dto.scenario ?? null,
          explanation: dto.explanation.trim(),
          points: dto.points ?? undefined,
          order,
          options: {
            create: (dto.options ?? []).map((option, index) =>
              this.optionCreateData(option, index),
            ),
          },
        },
        include: {
          options: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
        },
      });

      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'QUESTION_CREATED',
        entityType: 'QUESTION',
        entityId: created.id,
        after: created,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return created;
    });
  }

  async updateQuestion(id: string, dto: UpdateQuestionDto, context: AdminActionContext) {
    assertUpdateHasFields(dto);
    const existing = await this.requireEditableQuestion(id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.question.update({
        where: { id },
        data: {
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.prompt !== undefined ? { prompt: dto.prompt.trim() } : {}),
          ...(dto.scenario !== undefined ? { scenario: dto.scenario } : {}),
          ...(dto.explanation !== undefined ? { explanation: dto.explanation.trim() } : {}),
          ...(dto.points !== undefined ? { points: dto.points } : {}),
          ...(dto.order !== undefined ? { order: dto.order } : {}),
        },
      });

      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'QUESTION_UPDATED',
        entityType: 'QUESTION',
        entityId: id,
        before: existing,
        after: updated,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return updated;
    });
  }

  async deleteQuestion(id: string, context: AdminActionContext): Promise<void> {
    const existing = await this.requireEditableQuestion(id);
    if (existing._count.answers > 0) {
      throw quizHasAttempts();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.question.delete({ where: { id } });
      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'QUESTION_DELETED',
        entityType: 'QUESTION',
        entityId: id,
        before: existing,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    });
  }

  async reorderQuestions(quizId: string, dto: ReorderDto, context: AdminActionContext) {
    await this.requireEditableQuiz(quizId);
    const existing = await this.prisma.question.findMany({
      where: { quizId },
      select: { id: true, order: true },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
    const existingIds = new Set(existing.map((row) => row.id));
    if (existing.length !== dto.ids.length || dto.ids.some((id) => !existingIds.has(id))) {
      throw new ApiException(
        'REORDER_SET_MISMATCH',
        'Send every question in the quiz exactly once when reordering.',
        422,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const [index, id] of dto.ids.entries()) {
        await tx.question.update({ where: { id }, data: { order: -1 - index } });
      }
      for (const [index, id] of dto.ids.entries()) {
        await tx.question.update({ where: { id }, data: { order: index } });
      }

      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'QUESTION_REORDERED',
        entityType: 'QUIZ',
        entityId: quizId,
        before: existing,
        after: dto.ids.map((id, index) => ({ id, order: index })),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return { reordered: dto.ids.length };
    });
  }

  // -------------------------------------------------------------------------
  // Question options
  // -------------------------------------------------------------------------

  async createOption(
    questionId: string,
    dto: CreateQuestionOptionDto,
    context: AdminActionContext,
  ) {
    await this.requireEditableQuestion(questionId);
    const order = dto.order ?? (await this.nextOptionOrder(questionId));

    if (dto.isCorrect) {
      const correct = await this.prisma.questionOption.count({
        where: { questionId, isCorrect: true },
      });
      if (correct > 0) {
        throw validationError(
          'isCorrect',
          'Only one option can be correct for this question type.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.questionOption.create({
        data: { ...this.optionCreateData(dto, order), questionId },
      });

      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'QUESTION_OPTION_CREATED',
        entityType: 'QUESTION_OPTION',
        entityId: created.id,
        after: created,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return created;
    });
  }

  async updateOption(id: string, dto: UpdateQuestionOptionDto, context: AdminActionContext) {
    assertUpdateHasFields(dto);
    const existing = await this.prisma.questionOption.findUnique({
      where: { id },
      include: { question: { select: { id: true, quizId: true } } },
    });
    if (!existing) {
      throw optionNotFound();
    }
    await this.requireEditableQuiz(existing.question.quizId);

    if (dto.isCorrect === true && !existing.isCorrect) {
      const correct = await this.prisma.questionOption.count({
        where: { questionId: existing.questionId, isCorrect: true, id: { not: id } },
      });
      if (correct > 0) {
        throw validationError(
          'isCorrect',
          'Only one option can be correct for this question type.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.questionOption.update({
        where: { id },
        data: {
          ...(dto.text !== undefined ? { text: dto.text.trim() } : {}),
          ...(dto.feedback !== undefined ? { feedback: dto.feedback } : {}),
          ...(dto.isCorrect !== undefined ? { isCorrect: dto.isCorrect } : {}),
          ...(dto.order !== undefined ? { order: dto.order } : {}),
        },
      });

      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'QUESTION_OPTION_UPDATED',
        entityType: 'QUESTION_OPTION',
        entityId: id,
        before: existing,
        after: updated,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return updated;
    });
  }

  async deleteOption(id: string, context: AdminActionContext): Promise<void> {
    const existing = await this.prisma.questionOption.findUnique({
      where: { id },
      include: {
        question: { select: { id: true, quizId: true } },
        _count: { select: { answers: true } },
      },
    });
    if (!existing) {
      throw optionNotFound();
    }
    await this.requireEditableQuiz(existing.question.quizId);
    if (existing._count.answers > 0) {
      throw quizHasAttempts();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.questionOption.delete({ where: { id } });
      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'QUESTION_OPTION_DELETED',
        entityType: 'QUESTION_OPTION',
        entityId: id,
        before: existing,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    });
  }

  async reorderOptions(questionId: string, dto: ReorderDto, context: AdminActionContext) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true, quizId: true },
    });
    if (!question) {
      throw questionNotFound();
    }
    await this.requireEditableQuiz(question.quizId);

    const existing = await this.prisma.questionOption.findMany({
      where: { questionId },
      select: { id: true, order: true },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
    const existingIds = new Set(existing.map((row) => row.id));
    if (existing.length !== dto.ids.length || dto.ids.some((id) => !existingIds.has(id))) {
      throw new ApiException(
        'REORDER_SET_MISMATCH',
        'Send every option in the question exactly once when reordering.',
        422,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const [index, id] of dto.ids.entries()) {
        await tx.questionOption.update({ where: { id }, data: { order: -1 - index } });
      }
      for (const [index, id] of dto.ids.entries()) {
        await tx.questionOption.update({ where: { id }, data: { order: index } });
      }

      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'QUESTION_OPTION_REORDERED',
        entityType: 'QUESTION',
        entityId: questionId,
        before: existing,
        after: dto.ids.map((id, index) => ({ id, order: index })),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return { reordered: dto.ids.length };
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async requireEditableQuiz(quizId: string): Promise<Quiz> {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) {
      throw quizNotFound();
    }
    if (quiz.status === PublicationStatus.PUBLISHED) {
      throw invalidStatusTransition('Unpublish the quiz before changing its questions or options.');
    }
    await this.assertNoAttempts(quiz.id);
    return quiz;
  }

  private async requireEditableQuestion(
    questionId: string,
  ): Promise<Question & { _count: { answers: number } }> {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: {
        _count: { select: { answers: true } },
        quiz: { select: { id: true } },
      },
    });
    if (!question) {
      throw questionNotFound();
    }
    await this.requireEditableQuiz(question.quizId);
    return question;
  }

  private async assertNoAttempts(quizId: string): Promise<void> {
    const attempts = await this.prisma.quizAttempt.count({ where: { quizId } });
    if (attempts > 0) {
      throw quizHasAttempts();
    }
  }

  private async nextQuestionOrder(quizId: string): Promise<number> {
    const last = await this.prisma.question.findFirst({
      where: { quizId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return (last?.order ?? -1) + 1;
  }

  private async nextOptionOrder(questionId: string): Promise<number> {
    const last = await this.prisma.questionOption.findFirst({
      where: { questionId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return (last?.order ?? -1) + 1;
  }

  private optionCreateData(
    option: CreateQuestionOptionDto,
    defaultOrder: number,
  ): { text: string; feedback: string | null; isCorrect: boolean; order: number } {
    return {
      text: option.text.trim(),
      feedback: option.feedback ?? null,
      isCorrect: option.isCorrect ?? false,
      order: option.order ?? defaultOrder,
    };
  }

  private assertOptionCorrectness(options: CreateQuestionOptionDto[]): void {
    if (options.filter((option) => option.isCorrect).length > 1) {
      throw validationError('options', 'Only one option can be correct per question.');
    }
  }

  private assertQuizCanPublish(
    quiz: Quiz & {
      questions: (Question & {
        options: { id: string; isCorrect: boolean; text: string }[];
      })[];
    },
  ): void {
    if (quiz.questions.length === 0) {
      throw publicationBlocked('Add at least one question before publishing the quiz.');
    }

    for (const [index, question] of quiz.questions.entries()) {
      if (question.options.length < 2) {
        throw publicationBlocked(
          `Question ${index + 1} needs at least two options.`,
          `questions.${index}.options`,
        );
      }
      if (question.type === QuestionType.TRUE_FALSE && question.options.length !== 2) {
        throw publicationBlocked(
          `Question ${index + 1} must have exactly two true/false options.`,
          `questions.${index}.options`,
        );
      }
      if (question.options.filter((option) => option.isCorrect).length !== 1) {
        throw publicationBlocked(
          `Question ${index + 1} must have exactly one correct option.`,
          `questions.${index}.options`,
        );
      }
      if (question.points <= 0) {
        throw publicationBlocked(
          `Question ${index + 1} must be worth at least one point.`,
          `questions.${index}.points`,
        );
      }
    }
  }

  private async uniqueSlug(base: string, version: number): Promise<string> {
    const normalized =
      base
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 70) || 'quiz';

    let candidate = `${normalized}-v${version}`;
    let suffix = 1;
    while (
      await this.prisma.quiz.findUnique({ where: { slug: candidate }, select: { id: true } })
    ) {
      candidate = `${normalized}-v${version}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  private throwConflictOnUnique(error: unknown): never {
    if (isPrismaErrorWithCode(error, 'P2002')) {
      throw new ApiException('SLUG_ALREADY_EXISTS', 'A quiz with this slug already exists.', 409);
    }
    throw error;
  }

  private async transitionQuiz(
    id: string,
    context: AdminActionContext,
    action: 'review' | 'publish' | 'unpublish' | 'archive',
    decide: (quiz: {
      id: string;
      status: PublicationStatus;
      publishedAt: Date | null;
    }) => Record<string, unknown> | null,
  ) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      select: { id: true, status: true, publishedAt: true },
    });
    if (!quiz) {
      throw quizNotFound();
    }

    const data = decide(quiz);
    if (data === null) {
      return this.getQuiz(id);
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
      const updated = await tx.quiz.update({
        where: { id },
        data: data as Prisma.QuizUpdateInput,
      });

      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: `QUIZ_${actionName}`,
        entityType: 'QUIZ',
        entityId: id,
        before: quiz,
        after: updated,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return updated;
    });
  }
}
