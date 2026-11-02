export type AdminRole = 'SUPER_ADMIN' | 'CONTENT_EDITOR' | 'ANALYST';

export const ADMIN_ROLES: AdminRole[] = ['SUPER_ADMIN', 'CONTENT_EDITOR', 'ANALYST'];

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  lastLoginAt: string | null;
}

export interface AdminTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  tokenType: 'Bearer';
}

export interface AdminSession {
  admin: AdminUser;
  tokens: AdminTokens;
}

export interface AdminAuthResponse {
  admin: AdminUser;
  tokens: AdminTokens;
}

export type PublicationStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED';

export const PUBLICATION_STATUSES: PublicationStatus[] = [
  'DRAFT',
  'IN_REVIEW',
  'PUBLISHED',
  'ARCHIVED',
];

export type ContentLanguage = 'ENGLISH' | 'HINDI' | 'HINGLISH';
export const CONTENT_LANGUAGES: ContentLanguage[] = ['ENGLISH', 'HINDI', 'HINGLISH'];

export type ProficiencyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export const PROFICIENCY_LEVELS: ProficiencyLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

export type AccessTier = 'FREE' | 'PREMIUM';
export const ACCESS_TIERS: AccessTier[] = ['FREE', 'PREMIUM'];

export type ContentBlockType =
  | 'HEADING'
  | 'PARAGRAPH'
  | 'BULLET_LIST'
  | 'CALLOUT'
  | 'IMAGE'
  | 'AUDIO'
  | 'VIDEO'
  | 'EXAMPLE_CONVERSATION'
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'RECAP'
  | 'COMPLETION';

export const CONTENT_BLOCK_TYPES: ContentBlockType[] = [
  'HEADING',
  'PARAGRAPH',
  'BULLET_LIST',
  'CALLOUT',
  'IMAGE',
  'AUDIO',
  'VIDEO',
  'EXAMPLE_CONVERSATION',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'RECAP',
  'COMPLETION',
];

export type QuestionType = 'SINGLE_CHOICE' | 'TRUE_FALSE' | 'SCENARIO';
export const QUESTION_TYPES: QuestionType[] = ['SINGLE_CHOICE', 'TRUE_FALSE', 'SCENARIO'];

export type MediaType = 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT';
export const MEDIA_TYPES: MediaType[] = ['IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT'];

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export const USER_STATUSES: UserStatus[] = ['ACTIVE', 'SUSPENDED', 'DELETED'];

export type SubscriptionStatus =
  'PENDING' | 'ACTIVE' | 'GRACE_PERIOD' | 'EXPIRED' | 'CANCELED' | 'REFUNDED';

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'PENDING',
  'ACTIVE',
  'GRACE_PERIOD',
  'EXPIRED',
  'CANCELED',
  'REFUNDED',
];

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface Count {
  _count: number;
}

export interface LearningPath {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  iconUrl: string | null;
  order: number;
  status: PublicationStatus;
  availableLanguages: ContentLanguage[];
  publishedAt: string | null;
  archivedAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { courses: number };
  courses?: Course[];
}

export interface Course {
  id: string;
  learningPathId: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string | null;
  coverImageUrl: string | null;
  objectives: string[];
  difficulty: ProficiencyLevel;
  estimatedMinutes: number;
  accessTier: AccessTier;
  status: PublicationStatus;
  order: number;
  availableLanguages: ContentLanguage[];
  publishedAt: string | null;
  archivedAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  learningPath?: Pick<LearningPath, 'id' | 'slug' | 'title' | 'status'>;
  _count?: { modules: number };
  moduleCount?: number;
  lessonCount?: number;
  modules?: CourseModule[];
  prerequisites?: {
    prerequisite: Pick<Course, 'id' | 'slug' | 'title' | 'status'>;
  }[];
}

export interface CourseModule {
  id: string;
  courseId: string;
  slug: string;
  title: string;
  description: string | null;
  order: number;
  estimatedMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  course?: {
    id: string;
    slug: string;
    title: string;
    status: PublicationStatus;
    learningPath?: Pick<LearningPath, 'id' | 'slug' | 'title'>;
  };
  lessons?: Lesson[];
  _count?: { lessons: number };
}

export interface LessonBlock {
  id: string;
  lessonId: string;
  type: ContentBlockType;
  order: number;
  payload: unknown;
  mediaAssetId: string | null;
  caption: string | null;
  createdAt: string;
  updatedAt: string;
  mediaAsset?: MediaAsset | null;
}

export interface LessonTranslation {
  id: string;
  lessonId: string;
  language: ContentLanguage;
  title: string;
  summary: string;
  objective: string;
  content: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface Lesson {
  id: string;
  moduleId: string;
  slug: string;
  title: string;
  summary: string;
  objective: string;
  difficulty: ProficiencyLevel;
  estimatedMinutes: number;
  accessTier: AccessTier;
  status: PublicationStatus;
  order: number;
  version: number;
  primaryLanguage: ContentLanguage;
  requiresQuiz: boolean;
  completionCriteria: unknown;
  publishedAt: string | null;
  archivedAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  module?: CourseModule & {
    course?: Course & {
      learningPath?: Pick<LearningPath, 'id' | 'slug' | 'title' | 'status'>;
    };
  };
  blocks: LessonBlock[];
  translations: LessonTranslation[];
  quizzes: Quiz[];
  createdBy?: { id: string; name: string; email: string } | null;
  _count?: { blocks: number; translations: number; quizzes: number };
}

export interface Quiz {
  id: string;
  slug: string;
  kind: 'LESSON';
  lessonId: string | null;
  version: number;
  title: string;
  description: string | null;
  passingScore: number;
  xpReward: number;
  status: PublicationStatus;
  timeLimitSeconds: number | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lesson?: Pick<Lesson, 'id' | 'slug' | 'title' | 'status'> | null;
  questions?: Question[];
  _count?: { questions: number; attempts: number };
}

export interface Question {
  id: string;
  quizId: string;
  type: QuestionType;
  prompt: string;
  scenario: string | null;
  explanation: string;
  order: number;
  points: number;
  createdAt: string;
  updatedAt: string;
  options: QuestionOption[];
  _count?: { answers: number };
}

export interface QuestionOption {
  id: string;
  questionId: string;
  text: string;
  feedback: string | null;
  isCorrect: boolean;
  order: number;
  createdAt: string;
  _count?: { answers: number };
}

export interface MediaAsset {
  id: string;
  key: string;
  url: string;
  type: MediaType;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  altText: string | null;
  checksum: string | null;
  uploadedById: string | null;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: { id: string; name: string; email: string } | null;
  blocks?: {
    id: string;
    lesson: { id: string; title: string; status: PublicationStatus };
  }[];
  _count?: { blocks: number };
}

export interface AuditLog {
  id: string;
  adminUserId: string | null;
  admin: { id: string; name: string; email: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface DashboardAuditLog extends Omit<AuditLog, 'admin'> {
  admin?: { id: string; name: string; email: string } | null;
  adminUser?: { id: string; name: string; email: string } | null;
}

export interface DashboardData {
  generatedAt: string;
  users: {
    total: number;
    newLast7Days: number;
    activeLast7Days: number;
  };
  content: {
    learningPaths: Record<PublicationStatus, number>;
    courses: Record<PublicationStatus, number>;
    lessons: Record<PublicationStatus, number>;
    lessonsInReview: number;
  };
  learning: {
    completedLessons: number;
    submittedQuizAttempts: number;
    averageQuizScore: number | null;
    totalXp: number;
  };
  monetization: {
    activeSubscriptions: number;
    premiumEntitlements: number;
  };
  recentAudit: DashboardAuditLog[];
  recentUsers: UserSummary[];
  needsReview: {
    id: string;
    slug: string;
    title: string;
    updatedAt: string;
    module: {
      id: string;
      title: string;
      course: {
        id: string;
        title: string;
        learningPath: { id: string; title: string };
      };
    };
  }[];
}

export interface UserStats {
  id: string;
  userId: string;
  totalXp: number;
  currentLevel: number;
  currentStreak: number;
  longestStreak: number;
  lastLearningDate: string | null;
  lessonsCompleted: number;
  quizzesCompleted: number;
  minutesLearned: number;
  updatedAt: string;
}

export interface Entitlement {
  id: string;
  userId: string;
  tier: AccessTier;
  isActive: boolean;
  source: string | null;
  validUntil: string | null;
  subscriptionId: string | null;
  updatedAt: string;
}

export interface UserSummary {
  id: string;
  email: string;
  name: string | null;
  status: UserStatus;
  emailVerifiedAt: string | null;
  onboardingCompletedAt: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  stats?: UserStats | null;
  entitlement?: Entitlement | null;
  _count?: {
    lessonProgress: number;
    quizAttempts: number;
    subscriptions: number;
  };
}

export interface UserDetail extends UserSummary {
  avatarUrl: string | null;
  timeZone: string;
  locale: string;
  updatedAt: string;
  deletedAt: string | null;
  profile: Record<string, unknown> | null;
  preferences: Record<string, unknown> | null;
  identities: { provider: string; providerEmail: string | null; lastUsedAt: string | null }[];
  subscriptions: Subscription[];
  lessonProgress: {
    id: string;
    status: string;
    progressPercent: number;
    lastAccessedAt: string;
    completedAt: string | null;
    lesson: { id: string; slug: string; title: string };
  }[];
  quizAttempts: {
    id: string;
    status: string;
    score: number | null;
    attemptNumber: number;
    startedAt: string;
    submittedAt: string | null;
    quiz: { id: string; slug: string; title: string };
  }[];
  deletionRequests: {
    id: string;
    status: string;
    requestedAt: string;
    completedAt: string | null;
  }[];
}

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  billingPeriod: string;
  priceInPaise: number;
  currency: string;
  googlePlayProductId: string | null;
  benefits: string[];
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  _count?: { subscriptions: number };
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  provider: string;
  status: SubscriptionStatus;
  providerSubscriptionId: string | null;
  autoRenewing: boolean;
  startedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  endedAt: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; email: string; name: string | null; status: UserStatus };
  plan?: SubscriptionPlan;
  entitlement?: Entitlement | null;
  purchases?: {
    id: string;
    productId: string;
    orderId: string | null;
    purchaseTime: string;
    priceInPaise: number | null;
    currency: string;
    status: string;
    verifiedAt: string | null;
  }[];
  billingEvents?: {
    id: string;
    type: string;
    providerEventType: string | null;
    createdAt: string;
  }[];
  _count?: { purchases: number; billingEvents: number };
}

export interface AnalyticsData {
  range: { days: number; from: string; to: string };
  totals: {
    activeLearners: number;
    newUsers: number;
    lessonsCompleted: number;
    quizzesCompleted: number;
    minutesLearned: number;
    xpEarned: number;
    submittedQuizAttempts: number;
    averageQuizScore: number | null;
  };
  topLessons: {
    lesson: { id: string; title: string; slug: string } | null;
    completions: number;
  }[];
  productEvents: {
    total: number;
    top: { name: string; count: number }[];
  };
  daily: {
    date: string;
    activeLearners: number;
    newUsers: number;
    lessonsCompleted: number;
    quizzesCompleted: number;
    minutesLearned: number;
    xpEarned: number;
  }[];
}

export interface OverviewList {
  items: {
    id: string;
    user: { id: string; email: string; name: string | null; status: UserStatus };
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    createdAt: string;
    currentPeriodEnd: string | null;
    _count: { purchases: number; billingEvents: number };
  }[];
  page: number;
  pageSize: number;
  total: number;
}
