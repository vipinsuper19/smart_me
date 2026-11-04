/**
 * Verifies the published content graph before a release.
 *
 * Integrity problems (a published lesson without blocks, a quiz without a
 * correct option, a published course inside an unpublished path) fail the run.
 * Gaps against the PRD launch-library target are reported as warnings unless
 * `--strict` is passed, which turns them into failures too.
 *
 * Usage:
 *   pnpm --filter @smartme/backend content:verify
 *   pnpm --filter @smartme/backend content:verify -- --strict
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { AccessTier, ContentBlockType, PublicationStatus } from '../src/generated/prisma/enums';

const strict = process.argv.includes('--strict');
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is required to verify content.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5_000 }),
});

interface Issue {
  level: 'error' | 'warning';
  message: string;
}

const issues: Issue[] = [];

function error(message: string): void {
  issues.push({ level: 'error', message });
}

function warning(message: string): void {
  issues.push({ level: 'warning', message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAbsoluteHttpsUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^https:\/\/[^\s]+$/i.test(value);
}

const MEDIA_BLOCKS = new Set<ContentBlockType>([
  ContentBlockType.IMAGE,
  ContentBlockType.AUDIO,
  ContentBlockType.VIDEO,
]);

async function main(): Promise<void> {
  const [paths, counts] = await Promise.all([
    prisma.learningPath.findMany({
      where: { status: PublicationStatus.PUBLISHED },
      orderBy: { order: 'asc' },
      include: {
        courses: {
          where: { status: PublicationStatus.PUBLISHED },
          orderBy: { order: 'asc' },
          include: {
            modules: {
              orderBy: { order: 'asc' },
              include: {
                lessons: {
                  where: { status: PublicationStatus.PUBLISHED },
                  orderBy: { order: 'asc' },
                  include: {
                    blocks: {
                      orderBy: { order: 'asc' },
                      include: { mediaAsset: { select: { id: true } } },
                    },
                    quizzes: {
                      where: { status: PublicationStatus.PUBLISHED },
                      include: { questions: { include: { options: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    Promise.all([
      prisma.learningPath.count({ where: { status: PublicationStatus.PUBLISHED } }),
      prisma.course.count({ where: { status: PublicationStatus.PUBLISHED } }),
      prisma.courseModule.count({
        where: { course: { status: PublicationStatus.PUBLISHED } },
      }),
      prisma.lesson.count({ where: { status: PublicationStatus.PUBLISHED } }),
      prisma.quiz.count({ where: { status: PublicationStatus.PUBLISHED } }),
      prisma.question.count({
        where: { quiz: { status: PublicationStatus.PUBLISHED } },
      }),
      prisma.lessonContentBlock.count({
        where: {
          type: ContentBlockType.EXAMPLE_CONVERSATION,
          lesson: { status: PublicationStatus.PUBLISHED },
        },
      }),
    ]),
  ]);

  const [
    pathCount,
    courseCount,
    moduleCount,
    lessonCount,
    quizCount,
    questionCount,
    scenarioCount,
  ] = counts;

  let premiumLessonCount = 0;

  for (const path of paths) {
    if (path.courses.length === 0) {
      error(`Published path "${path.slug}" has no published courses.`);
    }

    const seenCourseOrders = new Set<number>();
    for (const course of path.courses) {
      if (seenCourseOrders.has(course.order)) {
        warning(`Path "${path.slug}" has two courses at order ${course.order}.`);
      }
      seenCourseOrders.add(course.order);

      if (course.objectives.length === 0) {
        warning(`Course "${course.slug}" has no learning objectives.`);
      }
      if (course.estimatedMinutes <= 0) {
        warning(`Course "${course.slug}" has a non-positive duration.`);
      }

      const modules = course.modules;
      if (modules.length === 0) {
        error(`Published course "${course.slug}" has no modules.`);
      }

      const lessonIds = new Set<string>();
      let courseLessonCount = 0;

      const seenModuleOrders = new Set<number>();
      for (const courseModule of modules) {
        if (seenModuleOrders.has(courseModule.order)) {
          warning(`Course "${course.slug}" has two modules at order ${courseModule.order}.`);
        }
        seenModuleOrders.add(courseModule.order);

        if (courseModule.lessons.length === 0) {
          error(
            `Module "${courseModule.slug}" in course "${course.slug}" has no published lessons.`,
          );
        }

        const seenLessonOrders = new Set<number>();
        for (const lesson of courseModule.lessons) {
          courseLessonCount += 1;
          if (lessonIds.has(lesson.id)) {
            error(`Lesson "${lesson.slug}" appears twice in course "${course.slug}".`);
          }
          lessonIds.add(lesson.id);

          if (seenLessonOrders.has(lesson.order)) {
            warning(`Module "${courseModule.slug}" has two lessons at order ${lesson.order}.`);
          }
          seenLessonOrders.add(lesson.order);

          if (lesson.accessTier === AccessTier.PREMIUM) premiumLessonCount += 1;

          if (lesson.blocks.length === 0) {
            error(`Published lesson "${lesson.slug}" has no content blocks.`);
          }

          const seenBlockOrders = new Set<number>();
          for (const block of lesson.blocks) {
            if (seenBlockOrders.has(block.order)) {
              warning(`Lesson "${lesson.slug}" has two blocks at order ${block.order}.`);
            }
            seenBlockOrders.add(block.order);

            const hasAsset = block.mediaAsset !== null;
            if (MEDIA_BLOCKS.has(block.type)) {
              // Media may be attached through the asset relation; a raw https
              // URL is the documented fallback for externally hosted files.
              const url = isRecord(block.payload) ? block.payload.url : undefined;
              if (!hasAsset && !isAbsoluteHttpsUrl(url)) {
                warning(
                  `Block ${block.order} in lesson "${lesson.slug}" has neither a media asset nor an absolute https URL.`,
                );
              }
            } else if (!isRecord(block.payload) || Object.keys(block.payload).length === 0) {
              error(`Block ${block.order} in lesson "${lesson.slug}" has an empty payload.`);
            }
          }

          if (lesson.requiresQuiz) {
            if (lesson.quizzes.length === 0) {
              error(`Lesson "${lesson.slug}" requires a quiz but has no published quiz.`);
            }
            if (lesson.quizzes.length > 1) {
              error(`Lesson "${lesson.slug}" has more than one published quiz.`);
            }
          }

          for (const quiz of lesson.quizzes) {
            if (quiz.questions.length === 0) {
              error(`Quiz "${quiz.slug}" has no questions.`);
            }
            if (quiz.passingScore < 1 || quiz.passingScore > 100) {
              error(`Quiz "${quiz.slug}" has a passing score outside 1-100.`);
            }
            if (quiz.xpReward < 0) {
              error(`Quiz "${quiz.slug}" has a negative XP reward.`);
            }

            const seenQuestionOrders = new Set<number>();
            for (const question of quiz.questions) {
              if (seenQuestionOrders.has(question.order)) {
                warning(`Quiz "${quiz.slug}" has two questions at order ${question.order}.`);
              }
              seenQuestionOrders.add(question.order);

              if (question.options.length < 2) {
                error(`Question "${question.prompt}" in quiz "${quiz.slug}" needs two options.`);
              }

              const correct = question.options.filter((option) => option.isCorrect);
              if (correct.length !== 1) {
                error(
                  `Question "${question.prompt}" in quiz "${quiz.slug}" has ${correct.length} correct options; expected exactly one.`,
                );
              }
              if (!question.explanation.trim()) {
                error(`Question "${question.prompt}" in quiz "${quiz.slug}" has no explanation.`);
              }
            }
          }
        }
      }

      if (courseLessonCount === 0) {
        error(`Published course "${course.slug}" has no published lessons.`);
      }
    }
  }

  // Catch content that is published but invisible because a parent is a draft.
  const hiddenCourses = await prisma.course.count({
    where: {
      status: PublicationStatus.PUBLISHED,
      learningPath: { status: { not: PublicationStatus.PUBLISHED } },
    },
  });
  if (hiddenCourses > 0) {
    error(`${hiddenCourses} published course(s) belong to an unpublished learning path.`);
  }

  if (premiumLessonCount === 0) {
    warning('No premium lessons are published, so free/premium gating cannot be exercised.');
  }

  // Launch-library target from PRD section 8. It is a content target, not a
  // software release blocker, so these are warnings by default.
  const targetIssues: string[] = [];
  if (pathCount < 3) targetIssues.push(`paths ${pathCount}/3`);
  if (courseCount < 6 || courseCount > 10) targetIssues.push(`courses ${courseCount}/6-10`);
  if (lessonCount < 50 || lessonCount > 100) targetIssues.push(`lessons ${lessonCount}/50-100`);
  if (scenarioCount < 10 || scenarioCount > 20) {
    targetIssues.push(`conversation scenarios ${scenarioCount}/10-20`);
  }

  if (targetIssues.length > 0) {
    const message = `Launch library is outside the PRD target: ${targetIssues.join(', ')}.`;
    if (strict) {
      error(message);
    } else {
      warning(message);
    }
  }

  const errors = issues.filter((issue) => issue.level === 'error');
  const warnings = issues.filter((issue) => issue.level === 'warning');

  console.log('SmartMe content verification');
  console.log(
    `Published: ${pathCount} paths · ${courseCount} courses · ${moduleCount} modules · ${lessonCount} lessons · ${quizCount} quizzes · ${questionCount} questions · ${scenarioCount} scenarios`,
  );

  if (warnings.length > 0) {
    console.log('\nWarnings:');
    for (const issue of warnings) console.log(`  - ${issue.message}`);
  }

  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const issue of errors) console.log(`  - ${issue.message}`);
    console.log(`\nContent verification failed with ${errors.length} error(s).`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `\nContent verification passed${warnings.length > 0 ? ` with ${warnings.length} warning(s)` : ''}.`,
  );
}

main()
  .catch((failure: unknown) => {
    console.error('Content verification could not run:', failure);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
