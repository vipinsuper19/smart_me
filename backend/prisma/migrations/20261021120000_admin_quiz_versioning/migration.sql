-- Allow multiple quiz versions per lesson. Only one version is published at a
-- time (enforced by the admin API), while attempts remain attached to the
-- version they answered.

DROP INDEX "quizzes_lessonId_key";

ALTER TABLE "quizzes"
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "quizzes_lessonId_status_idx" ON "quizzes"("lessonId", "status");

CREATE UNIQUE INDEX "quizzes_lessonId_version_key" ON "quizzes"("lessonId", "version");
