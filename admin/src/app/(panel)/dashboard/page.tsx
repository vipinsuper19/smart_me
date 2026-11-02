'use client';

import Link from 'next/link';
import { useAdminAuth } from '@/lib/auth';
import {
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelative,
  titleCase,
} from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { DashboardData, PublicationStatus } from '@/lib/types';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  PageHeader,
  PageLoading,
  SectionHeader,
  StatCard,
} from '@/components/ui';

const statuses: PublicationStatus[] = ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED'];

export default function DashboardPage() {
  const { admin, canWriteContent, canViewBusiness } = useAdminAuth();
  const { data, loading, error, reload } = useApi<DashboardData>('/admin/dashboard');

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={`Good ${greeting()}, ${admin?.name?.split(' ')[0] ?? 'admin'}`}
        description={`Operational snapshot for ${formatDateTime(data?.generatedAt ?? new Date().toISOString())}.`}
        actions={
          <>
            {canWriteContent ? (
              <>
                <ButtonLink href="/media" variant="secondary" size="sm">
                  Add media
                </ButtonLink>
                <ButtonLink href="/content/learning-paths?new=1" size="sm">
                  Create learning path
                </ButtonLink>
              </>
            ) : (
              <ButtonLink href="/analytics" variant="secondary" size="sm">
                Open analytics
              </ButtonLink>
            )}
          </>
        }
      />

      {error ? (
        <Alert variant="error" className="mb-5">
          <div className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button variant="secondary" size="sm" onClick={() => void reload()}>
              Retry
            </Button>
          </div>
        </Alert>
      ) : null}

      {loading ? (
        <PageLoading label="Loading dashboard…" />
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total learners"
              value={formatNumber(data.users.total)}
              detail={`${formatNumber(data.users.newLast7Days)} joined in the last 7 days`}
              accent="indigo"
            />
            <StatCard
              label="Active learners · 7d"
              value={formatNumber(data.users.activeLast7Days)}
              detail="Learners with activity in the last week"
              accent="emerald"
            />
            <StatCard
              label="Lessons completed"
              value={formatNumber(data.learning.completedLessons)}
              detail={`${formatNumber(data.learning.submittedQuizAttempts)} submitted quiz attempts`}
              accent="amber"
            />
            <StatCard
              label="Average quiz score"
              value={formatPercent(data.learning.averageQuizScore)}
              detail={`${formatNumber(data.learning.totalXp)} XP awarded`}
              accent="rose"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Active subscriptions"
              value={formatNumber(data.monetization.activeSubscriptions)}
              detail={`${formatNumber(data.monetization.premiumEntitlements)} premium entitlements`}
              accent="emerald"
              href={canViewBusiness ? '/subscriptions' : undefined}
            />
            <StatCard
              label="Lessons in review"
              value={formatNumber(data.content.lessonsInReview)}
              detail="Waiting for a publish decision"
              accent="amber"
              href="/review"
            />
            <StatCard
              label="Published lessons"
              value={formatNumber(data.content.lessons.PUBLISHED)}
              detail={`${formatNumber(data.content.lessons.DRAFT)} drafts in progress`}
              accent="indigo"
              href="/content/lessons?status=PUBLISHED"
            />
            <StatCard
              label="Content catalogue"
              value={formatNumber(
                Object.values(data.content.learningPaths).reduce((sum, value) => sum + value, 0),
              )}
              detail="Learning paths across all statuses"
              accent="slate"
              href="/content/learning-paths"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
            <Card>
              <SectionHeader
                title="Content pipeline"
                description="How the catalogue is distributed across the review workflow."
                actions={<Badge>{data.content.lessonsInReview} lessons in review</Badge>}
                className="border-b border-slate-200 px-5 py-4"
              />
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    <tr>
                      <th className="px-5 py-2.5">Type</th>
                      {statuses.map((status) => (
                        <th key={status} className="px-3 py-2.5 text-right">
                          {titleCase(status)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ['Learning paths', data.content.learningPaths, '/content/learning-paths'],
                      ['Courses', data.content.courses, '/content/courses'],
                      ['Lessons', data.content.lessons, '/content/lessons'],
                    ].map(([label, counts, href]) => (
                      <tr key={String(label)} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <Link
                            href={String(href)}
                            className="font-medium text-slate-800 hover:text-indigo-600"
                          >
                            {String(label)}
                          </Link>
                        </td>
                        {statuses.map((status) => (
                          <td
                            key={status}
                            className="px-3 py-3 text-right tabular-nums text-slate-700"
                          >
                            {formatNumber((counts as Record<PublicationStatus, number>)[status])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <SectionHeader
                title="Needs review"
                description="Lessons submitted for a publish decision."
                actions={
                  <ButtonLink href="/review" variant="ghost" size="sm">
                    View queue
                  </ButtonLink>
                }
                className="border-b border-slate-200 px-5 py-4"
              />
              {data.needsReview.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">
                  Nothing is waiting for review.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.needsReview.map((lesson) => (
                    <li key={lesson.id} className="px-5 py-3.5">
                      <Link
                        href={`/content/lessons/${lesson.id}`}
                        className="text-sm font-medium text-slate-800 hover:text-indigo-600"
                      >
                        {lesson.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {lesson.module.course.learningPath.title} → {lesson.module.course.title} →{' '}
                        {lesson.module.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Updated {formatRelative(lesson.updatedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <SectionHeader
                title="Recent admin activity"
                description="The latest writes from the audit trail."
                actions={
                  <ButtonLink href="/audit" variant="ghost" size="sm">
                    Open audit log
                  </ButtonLink>
                }
                className="border-b border-slate-200 px-5 py-4"
              />
              {data.recentAudit.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">
                  No admin activity yet.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentAudit.slice(0, 6).map((entry) => (
                    <li key={entry.id} className="flex items-start justify-between gap-4 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {entry.admin?.name ?? entry.adminUser?.name ?? 'System'}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {titleCase(entry.action)} · {titleCase(entry.entityType)}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">
                        {formatRelative(entry.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <SectionHeader
                title="Newest learners"
                description="Accounts created most recently."
                actions={
                  canViewBusiness ? (
                    <ButtonLink href="/users" variant="ghost" size="sm">
                      All learners
                    </ButtonLink>
                  ) : undefined
                }
                className="border-b border-slate-200 px-5 py-4"
              />
              {data.recentUsers.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">
                  No learner accounts yet.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentUsers.map((user) => (
                    <li key={user.id} className="flex items-center justify-between gap-4 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {user.name ?? 'Unnamed learner'}
                        </p>
                        <p className="truncate text-xs text-slate-500">{user.email}</p>
                      </div>
                      <div className="text-right">
                        <Badge>{titleCase(user.status)}</Badge>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatRelative(user.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
