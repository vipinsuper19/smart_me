import type { LessonProgress, Prisma } from '../generated/prisma/client';
import type { RewardResultView } from '../gamification/gamification.types';
import {
  AccessTier,
  ContentBlockType,
  ContentLanguage,
  LessonProgressStatus,
  ProficiencyLevel,
} from '../generated/prisma/enums';

export interface PaginatedView<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ProgressSummaryView {
  totalLessons: number;
  startedLessons: number;
  completedLessons: number;
  percent: number;
}

export interface LessonProgressView {
  lessonId: string;
  status: LessonProgressStatus;
  progressPercent: number;
  lastBlockOrder: number | null;
  startedAt: Date;
  lastAccessedAt: Date;
  completedAt: Date | null;
  timeSpentSeconds: number;
}

export interface LessonCompletionView extends LessonProgressView {
  /** True when an earlier request had already completed the lesson. */
  alreadyCompleted: boolean;
  rewards: RewardResultView;
}

export interface PathRefView {
  id: string;
  slug: string;
  title: string;
}

export interface CourseRefView {
  id: string;
  slug: string;
  title: string;
  accessTier: AccessTier;
  locked: boolean;
}

export interface ModuleRefView {
  id: string;
  slug: string;
  title: string;
  order: number;
}

export interface MediaAssetView {
  id: string;
  url: string;
  type: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  altText: string | null;
}

export interface LessonBlockView {
  id: string;
  type: ContentBlockType;
  order: number;
  payload: Prisma.JsonValue;
  caption: string | null;
  media: MediaAssetView | null;
}

export interface LessonTranslationView {
  language: ContentLanguage;
  title: string;
  summary: string;
  objective: string;
}

export interface QuizSummaryView {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  passingScore: number;
  xpReward: number;
  timeLimitSeconds: number | null;
  questionCount: number;
  /** Mirrors `Lesson.requiresQuiz` so the client can explain why completion is blocked. */
  required: boolean;
  /** All attempts the learner has started, including the active one. */
  attemptCount: number;
  /** Highest score across submitted attempts, or null if none were submitted. */
  bestScore: number | null;
  passed: boolean;
  activeAttemptId: string | null;
}

export interface LessonCardView {
  id: string;
  slug: string;
  title: string;
  summary: string;
  objective: string;
  difficulty: ProficiencyLevel;
  estimatedMinutes: number;
  accessTier: AccessTier;
  effectiveAccessTier: AccessTier;
  locked: boolean;
  order: number;
  requiresQuiz: boolean;
  module: ModuleRefView;
  course: CourseRefView;
  progress: LessonProgressView | null;
}

export interface CourseCardView {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string | null;
  objectives: string[];
  coverImageUrl: string | null;
  difficulty: ProficiencyLevel;
  estimatedMinutes: number;
  accessTier: AccessTier;
  locked: boolean;
  order: number;
  availableLanguages: ContentLanguage[];
  moduleCount: number;
  lessonCount: number;
  hasPremiumLessons: boolean;
  progress: ProgressSummaryView;
  learningPath: PathRefView;
}

export interface LearningPathCardView {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  iconUrl: string | null;
  order: number;
  availableLanguages: ContentLanguage[];
  courseCount: number;
  lessonCount: number;
  hasPremiumContent: boolean;
  progress: ProgressSummaryView;
}

export interface LearningPathDetailView extends LearningPathCardView {
  courses: CourseCardView[];
}

export interface ModuleView {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  order: number;
  estimatedMinutes: number | null;
  lessons: LessonCardView[];
}

export interface CourseDetailView extends CourseCardView {
  modules: ModuleView[];
  prerequisites: CourseRefView[];
}

export interface CourseLessonsView extends PaginatedView<LessonCardView> {
  course: CourseCardView;
}

export interface NextLessonView {
  id: string;
  slug: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  accessTier: AccessTier;
  effectiveAccessTier: AccessTier;
  locked: boolean;
  module: ModuleRefView;
}

export interface LessonDetailView {
  id: string;
  slug: string;
  title: string;
  summary: string;
  objective: string;
  difficulty: ProficiencyLevel;
  estimatedMinutes: number;
  accessTier: AccessTier;
  effectiveAccessTier: AccessTier;
  order: number;
  version: number;
  primaryLanguage: ContentLanguage;
  requiresQuiz: boolean;
  completionCriteria: Prisma.JsonValue | null;
  publishedAt: Date | null;
  availableLanguages: ContentLanguage[];
  course: CourseRefView;
  module: ModuleRefView;
  blocks: LessonBlockView[];
  translations: LessonTranslationView[];
  quiz: QuizSummaryView | null;
  progress: LessonProgressView | null;
  nextLesson: NextLessonView | null;
}

export type RecommendationReason = 'PREFERENCE_MATCH' | 'FIRST_AVAILABLE' | 'PREMIUM_CONTENT';

export interface RecommendedLessonView {
  lesson: LessonCardView;
  learningPath: PathRefView;
  reason: RecommendationReason;
}

export function effectiveAccessTier(courseTier: AccessTier, lessonTier: AccessTier): AccessTier {
  return courseTier === AccessTier.PREMIUM || lessonTier === AccessTier.PREMIUM
    ? AccessTier.PREMIUM
    : AccessTier.FREE;
}

export function isLocked(tier: AccessTier, hasPremiumAccess: boolean): boolean {
  return tier === AccessTier.PREMIUM && !hasPremiumAccess;
}

export function toLessonProgressView(progress: LessonProgress): LessonProgressView {
  return {
    lessonId: progress.lessonId,
    status: progress.status,
    progressPercent: progress.progressPercent,
    lastBlockOrder: progress.lastBlockOrder,
    startedAt: progress.startedAt,
    lastAccessedAt: progress.lastAccessedAt,
    completedAt: progress.completedAt,
    timeSpentSeconds: progress.timeSpentSeconds,
  };
}

export function summarizeProgress(
  lessonIds: string[],
  progressByLesson: Map<string, LessonProgress>,
): ProgressSummaryView {
  const rows = lessonIds
    .map((lessonId) => progressByLesson.get(lessonId))
    .filter((row): row is LessonProgress => row !== undefined);
  const completedLessons = rows.filter(
    (row) => row.status === LessonProgressStatus.COMPLETED,
  ).length;

  return {
    totalLessons: lessonIds.length,
    startedLessons: rows.length,
    completedLessons,
    percent: lessonIds.length === 0 ? 0 : Math.round((completedLessons / lessonIds.length) * 100),
  };
}
