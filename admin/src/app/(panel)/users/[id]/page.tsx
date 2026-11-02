'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  AccessDenied,
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  JsonBlock,
  PageHeader,
  PageLoading,
  SectionHeader,
  StatusBadge,
} from '@/components/ui';
import { useAdminAuth } from '@/lib/auth';
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatPaise,
  formatRelative,
  titleCase,
} from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { UserDetail } from '@/lib/types';

function initials(name: string | null, email: string): string {
  const base = name?.trim() || email;
  return base.slice(0, 2).toUpperCase();
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { canViewBusiness } = useAdminAuth();
  const { data, loading, error, reload } = useApi<UserDetail>(
    id && canViewBusiness ? `/admin/users/${id}` : null,
  );
  const [showProfileJson, setShowProfileJson] = useState(false);

  if (!canViewBusiness) {
    return (
      <>
        <PageHeader eyebrow="Business" title="Learner" />
        <AccessDenied message="Learner details are limited to super admins and analysts." />
      </>
    );
  }

  if (loading && !data) {
    return <PageLoading label="Loading learner…" />;
  }

  if (error || !data) {
    return (
      <>
        <PageHeader
          title="Learner"
          back={
            <Link href="/users" className="text-indigo-600 hover:text-indigo-500">
              ← Learners
            </Link>
          }
        />
        <Alert variant="error">
          {error ?? 'This learner could not be found.'}{' '}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => void reload()}>
            Retry
          </Button>
        </Alert>
      </>
    );
  }

  const entitlementActive =
    data.entitlement?.isActive &&
    data.entitlement.tier === 'PREMIUM' &&
    (!data.entitlement.validUntil || new Date(data.entitlement.validUntil).getTime() > Date.now());

  return (
    <>
      <PageHeader
        eyebrow="Learner"
        title={data.name?.trim() || data.email}
        description={`${titleCase(data.status)} · joined ${formatDate(data.createdAt)}`}
        back={
          <Link href="/users" className="text-indigo-600 hover:text-indigo-500">
            ← Learners
          </Link>
        }
        actions={
          <>
            <StatusBadge status={data.status} />
            {entitlementActive ? (
              <Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-600/20">Premium</Badge>
            ) : (
              <Badge>Free</Badge>
            )}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-lg font-semibold text-white">
                {initials(data.name, data.email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-slate-900">
                  {data.name?.trim() || 'Unnamed learner'}
                </p>
                <p className="truncate text-sm text-slate-500">{data.email}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {data.emailVerifiedAt ? (
                    <Badge>Email verified</Badge>
                  ) : (
                    <Badge>Email unverified</Badge>
                  )}
                  {data.onboardingCompletedAt ? (
                    <Badge>Onboarded</Badge>
                  ) : (
                    <Badge tone="bg-amber-50 text-amber-700 ring-amber-600/20">
                      Onboarding pending
                    </Badge>
                  )}
                  <Badge>{titleCase(data.locale)}</Badge>
                  <Badge>{data.timeZone}</Badge>
                </div>
              </div>
            </div>

            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  Last active
                </dt>
                <dd className="mt-1 text-slate-700">
                  {data.lastActiveAt
                    ? `${formatRelative(data.lastActiveAt)} (${formatDateTime(data.lastActiveAt)})`
                    : 'Never'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  Created
                </dt>
                <dd className="mt-1 text-slate-700">{formatDateTime(data.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  Updated
                </dt>
                <dd className="mt-1 text-slate-700">{formatDateTime(data.updatedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  Deleted
                </dt>
                <dd className="mt-1 text-slate-700">{formatDateTime(data.deletedAt)}</dd>
              </div>
            </dl>
          </Card>

          <Card className="overflow-hidden">
            <SectionHeader
              title="Lesson progress"
              description="The ten most recently accessed lessons."
              className="border-b border-slate-200 px-5 py-4"
            />
            {data.lessonProgress.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">
                This learner has not opened a lesson yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Lesson</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Progress</th>
                      <th className="px-4 py-3">Last accessed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.lessonProgress.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <Link
                            href={`/content/lessons/${row.lesson.id}`}
                            className="font-medium text-slate-900 hover:text-indigo-600"
                          >
                            {row.lesson.title}
                          </Link>
                          <p className="text-xs text-slate-400">/{row.lesson.slug}</p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-indigo-500"
                                style={{
                                  width: `${Math.min(100, Math.max(0, row.progressPercent))}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-slate-600">{row.progressPercent}%</span>
                          </div>
                          {row.completedAt ? (
                            <p className="mt-1 text-xs text-emerald-600">
                              Completed {formatRelative(row.completedAt)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {formatRelative(row.lastAccessedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <SectionHeader
              title="Quiz attempts"
              description="The ten most recent attempts."
              className="border-b border-slate-200 px-5 py-4"
            />
            {data.quizAttempts.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">No quiz attempts recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Quiz</th>
                      <th className="px-4 py-3">Attempt</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Started</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.quizAttempts.map((attempt) => (
                      <tr key={attempt.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <Link
                            href={`/content/quizzes/${attempt.quiz.id}`}
                            className="font-medium text-slate-900 hover:text-indigo-600"
                          >
                            {attempt.quiz.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-600">#{attempt.attemptNumber}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={attempt.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {attempt.score === null ? '—' : `${attempt.score}%`}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {formatRelative(attempt.startedAt)}
                          {attempt.submittedAt ? (
                            <p className="text-slate-400">
                              Submitted {formatRelative(attempt.submittedAt)}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <SectionHeader
              title="Subscriptions"
              description="Subscription history for this learner."
              className="border-b border-slate-200 px-5 py-4"
            />
            {data.subscriptions.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">No subscriptions.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.subscriptions.map((subscription) => (
                  <li
                    key={subscription.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/subscriptions/${subscription.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {subscription.plan?.name ?? 'Subscription'}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {titleCase(subscription.provider)} ·{' '}
                        {subscription.plan
                          ? formatPaise(subscription.plan.priceInPaise, subscription.plan.currency)
                          : '—'}
                        {subscription.plan
                          ? ` / ${titleCase(subscription.plan.billingPeriod)}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={subscription.status} />
                      <span className="text-xs text-slate-500">
                        Ends {formatDate(subscription.currentPeriodEnd)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
              Learning stats
            </p>
            {data.stats ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Stat label="Total XP" value={formatNumber(data.stats.totalXp)} />
                <Stat label="Level" value={String(data.stats.currentLevel)} />
                <Stat label="Current streak" value={`${data.stats.currentStreak}d`} />
                <Stat label="Longest streak" value={`${data.stats.longestStreak}d`} />
                <Stat label="Lessons done" value={formatNumber(data.stats.lessonsCompleted)} />
                <Stat label="Quizzes done" value={formatNumber(data.stats.quizzesCompleted)} />
                <Stat label="Minutes learned" value={formatNumber(data.stats.minutesLearned)} />
                <Stat
                  label="Last learning"
                  value={
                    data.stats.lastLearningDate ? formatDate(data.stats.lastLearningDate) : '—'
                  }
                />
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                No learning stats have been recorded yet.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
              Entitlement
            </p>
            {data.entitlement ? (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Tier</span>
                  <Badge
                    tone={
                      entitlementActive
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                        : 'bg-slate-100 text-slate-600 ring-slate-500/20'
                    }
                  >
                    {titleCase(data.entitlement.tier)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Active</span>
                  <span className="font-medium text-slate-800">
                    {entitlementActive ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Source</span>
                  <span className="font-medium text-slate-800">
                    {titleCase(data.entitlement.source ?? '—')}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Valid until</span>
                  <span className="font-medium text-slate-800">
                    {formatDate(data.entitlement.validUntil)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                No entitlement record; the learner is on the free tier.
              </p>
            )}
          </Card>

          <Card className="overflow-hidden">
            <SectionHeader title="Identities" className="border-b border-slate-200 px-5 py-4" />
            {data.identities.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">No linked identities.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.identities.map((identity) => (
                  <li
                    key={identity.provider}
                    className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{titleCase(identity.provider)}</p>
                      {identity.providerEmail ? (
                        <p className="text-xs text-slate-500">{identity.providerEmail}</p>
                      ) : null}
                    </div>
                    <span className="text-xs text-slate-400">
                      {identity.lastUsedAt ? formatRelative(identity.lastUsedAt) : 'Never used'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <SectionHeader
              title="Deletion requests"
              className="border-b border-slate-200 px-5 py-4"
            />
            {data.deletionRequests.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">No deletion requests.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.deletionRequests.map((request) => (
                  <li
                    key={request.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <div>
                      <StatusBadge status={request.status} />
                      <p className="mt-1 text-xs text-slate-500">
                        Requested {formatRelative(request.requestedAt)}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {request.completedAt ? formatRelative(request.completedAt) : 'Pending'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  Profile data
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Onboarding answers and preferences captured for this learner.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowProfileJson((current) => !current)}
              >
                {showProfileJson ? 'Hide' : 'View'}
              </Button>
            </div>
            {showProfileJson ? (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Onboarding profile</p>
                  <JsonBlock value={data.profile} />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Preferences</p>
                  <JsonBlock value={data.preferences} />
                </div>
              </div>
            ) : null}
          </Card>

          {data.subscriptions.length === 0 ? (
            <EmptyState
              title="No subscription history"
              description="Free-tier learners appear here until they purchase a plan."
            />
          ) : null}
        </div>
      </div>
    </>
  );
}
