-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('SUBSCRIPTION', 'MANUAL', 'PROMO');

-- CreateEnum
CREATE TYPE "SessionRevocationReason" AS ENUM ('LOGOUT', 'ROTATED', 'REUSE_DETECTED', 'PASSWORD_CHANGED', 'ACCOUNT_DELETED', 'ADMIN_REVOKED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SubscriptionStatus" ADD VALUE 'PAUSED';
ALTER TYPE "SubscriptionStatus" ADD VALUE 'ON_HOLD';

-- AlterEnum
ALTER TYPE "XPReason" ADD VALUE 'ACHIEVEMENT_UNLOCKED';

-- DropForeignKey
ALTER TABLE "lesson_progress" DROP CONSTRAINT "lesson_progress_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "quiz_answers" DROP CONSTRAINT "quiz_answers_questionId_fkey";

-- DropForeignKey
ALTER TABLE "quiz_attempts" DROP CONSTRAINT "quiz_attempts_quizId_fkey";

-- DropIndex
DROP INDEX "billing_events_eventId_key";

-- DropIndex
DROP INDEX "purchases_purchaseToken_idx";

-- DropIndex
DROP INDEX "subscriptions_purchaseToken_key";

-- AlterTable
ALTER TABLE "admin_sessions" ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "replacedBySessionId" TEXT,
ADD COLUMN     "revokedReason" "SessionRevocationReason";

-- AlterTable
ALTER TABLE "billing_events" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ADD COLUMN     "providerEventType" TEXT;

-- AlterTable
ALTER TABLE "entitlements" DROP COLUMN "source",
ADD COLUMN     "source" "EntitlementSource";

-- AlterTable
ALTER TABLE "purchases" DROP COLUMN "purchaseToken",
ADD COLUMN     "purchaseTokenHash" TEXT;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "revokedReason" "SessionRevocationReason";

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "purchaseToken",
ADD COLUMN     "purchaseTokenEncrypted" TEXT,
ADD COLUMN     "purchaseTokenHash" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN     "privacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT;

-- CreateIndex
CREATE INDEX "admin_sessions_familyId_idx" ON "admin_sessions"("familyId");

-- CreateIndex
CREATE INDEX "billing_events_nextRetryAt_idx" ON "billing_events"("nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "billing_events_provider_eventId_key" ON "billing_events"("provider", "eventId");

-- CreateIndex
CREATE INDEX "purchases_purchaseTokenHash_idx" ON "purchases"("purchaseTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_purchaseTokenHash_key" ON "subscriptions"("purchaseTokenHash");

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Application invariants that Prisma's schema language cannot express.

-- Emails are normalised to lowercase at the API boundary. This check makes the
-- unique index case-insensitive even if a future code path forgets.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_check" CHECK ("email" = lower("email"));
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_email_lowercase_check" CHECK ("email" = lower("email"));

-- A learner can have only one live subscription at a time.
CREATE UNIQUE INDEX "subscriptions_one_current_per_user"
  ON "subscriptions"("userId")
  WHERE "status" IN ('ACTIVE', 'GRACE_PERIOD', 'PAUSED', 'ON_HOLD');

-- A learner can have only one pending deletion request at a time.
CREATE UNIQUE INDEX "account_deletion_requests_one_pending"
  ON "account_deletion_requests"("userId")
  WHERE "status" = 'PENDING';

-- Range checks for values produced by application logic.
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_percent_check"
  CHECK ("progressPercent" BETWEEN 0 AND 100);
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_score_check"
  CHECK ("score" IS NULL OR ("score" BETWEEN 0 AND 100));
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_price_check"
  CHECK ("priceInPaise" > 0);
