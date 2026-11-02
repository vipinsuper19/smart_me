import type { QuizAttempt } from '../generated/prisma/client';
import { QuestionType, QuizAttemptStatus } from '../generated/prisma/enums';
import type { RewardResultView } from '../gamification/gamification.types';

export interface QuizOptionView {
  id: string;
  text: string;
  order: number;
}

export interface QuizQuestionView {
  id: string;
  type: QuestionType;
  prompt: string;
  scenario: string | null;
  order: number;
  points: number;
  options: QuizOptionView[];
}

export interface QuizAttemptSummaryView {
  id: string;
  quizId: string;
  attemptNumber: number;
  status: QuizAttemptStatus;
  startedAt: Date;
  submittedAt: Date | null;
  score: number | null;
  passingScore: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  answeredCount: number;
  xpAwarded: number;
}

export interface QuizSavedAnswerView {
  questionId: string;
  selectedOptionId: string | null;
  answeredAt: Date;
}

export interface LatestAttemptView extends QuizAttemptSummaryView {
  quizTitle: string;
  /** Saved selections so an interrupted attempt can be restored without revealing correctness. */
  answers: QuizSavedAnswerView[];
}

export interface LessonQuizView {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  lessonId: string;
  passingScore: number;
  xpReward: number;
  timeLimitSeconds: number | null;
  questionCount: number;
  totalPoints: number;
  questions: QuizQuestionView[];
  latestAttempt: LatestAttemptView | null;
}

export interface QuizAttemptStartView {
  quizId: string;
  quizTitle: string;
  passingScore: number;
  xpReward: number;
  timeLimitSeconds: number | null;
  totalQuestions: number;
  resumed: boolean;
  attempt: QuizAttemptSummaryView;
  /** Existing selections when `resumed` is true; empty for a new attempt. */
  answers: QuizSavedAnswerView[];
}

export interface QuizResultOptionView extends QuizOptionView {
  isCorrect: boolean;
  selected: boolean;
  feedback: string | null;
}

export interface QuizResultQuestionView {
  id: string;
  type: QuestionType;
  prompt: string;
  scenario: string | null;
  explanation: string;
  order: number;
  points: number;
  selectedOptionId: string | null;
  isCorrect: boolean;
  earnedPoints: number;
  options: QuizResultOptionView[];
}

export interface QuizResultView {
  quiz: {
    id: string;
    title: string;
    passingScore: number;
    xpReward: number;
  };
  attempt: QuizAttemptSummaryView;
  questions: QuizResultQuestionView[];
}

export interface QuizSubmissionView extends QuizResultView {
  firstAttempt: boolean;
  rewards: RewardResultView | null;
}

export function toQuizAttemptSummary(
  attempt: QuizAttempt,
  answeredCount: number,
  passingScore: number,
): QuizAttemptSummaryView {
  return {
    id: attempt.id,
    quizId: attempt.quizId,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    score: attempt.score,
    passingScore,
    passed: attempt.score !== null && attempt.score >= passingScore,
    correctCount: attempt.correctCount,
    totalQuestions: attempt.totalQuestions,
    answeredCount,
    xpAwarded: attempt.xpAwarded,
  };
}
