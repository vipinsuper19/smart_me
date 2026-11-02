'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AccessDenied,
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  PageHeader,
  PageLoading,
  Pagination,
  Select,
  StatusBadge,
} from '@/components/ui';
import { buildQuery } from '@/lib/api';
import { useAdminAuth } from '@/lib/auth';
import { formatNumber, formatRelative, titleCase } from '@/lib/format';
import { useApi, useDebouncedValue } from '@/lib/hooks';
import { USER_STATUSES, type Paginated, type UserSummary } from '@/lib/types';

function initials(name: string | null, email: string): string {
  const base = name?.trim() || email;
  return base.slice(0, 2).toUpperCase();
}

export default function UsersPage() {
  const { canViewBusiness } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  const query = buildQuery({ page, pageSize: 20, search: debouncedSearch, status });
  const { data, loading, error, reload } = useApi<Paginated<UserSummary>>(
    canViewBusiness ? `/admin/users${query}` : null,
  );

  if (!canViewBusiness) {
    return (
      <>
        <PageHeader eyebrow="Business" title="Learners" />
        <AccessDenied message="Learner and subscription data is limited to super admins and analysts." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Business"
        title="Learners"
        description="Read-only learner directory with learning activity, streaks and entitlement state."
        actions={
          <ButtonLink href="/analytics" variant="secondary" size="sm">
            Open analytics
          </ButtonLink>
        }
      />

      {error ? (
        <Alert variant="error" className="mb-4">
          <div className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button variant="secondary" size="sm" onClick={() => void reload()}>
              Retry
            </Button>
          </div>
        </Alert>
      ) : null}

      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-[1.6fr_1fr_auto]">
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search learners"
          />
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {USER_STATUSES.map((item) => (
              <option key={item} value={item}>
                {titleCase(item)}
              </option>
            ))}
          </Select>
          <span className="self-center text-sm text-slate-500">
            {data
              ? `${formatNumber(data.total)} learner${data.total === 1 ? '' : 's'}`
              : 'Loading…'}
          </span>
        </div>

        {loading && !data ? (
          <PageLoading label="Loading learners…" />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="No learners found"
            description="Try a different search term or status filter."
            className="m-4"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Learner</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3">Learning</th>
                    <th className="px-4 py-3">Access</th>
                    <th className="px-4 py-3">Last active</th>
                    <th className="px-4 py-3 text-right">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((user) => {
                    const entitlementActive =
                      user.entitlement?.isActive &&
                      user.entitlement.tier === 'PREMIUM' &&
                      (!user.entitlement.validUntil ||
                        new Date(user.entitlement.validUntil).getTime() > Date.now());

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                              {initials(user.name, user.email)}
                            </span>
                            <div className="min-w-0">
                              <Link
                                href={`/users/${user.id}`}
                                className="font-medium text-slate-900 hover:text-indigo-600"
                              >
                                {user.name?.trim() || 'Unnamed learner'}
                              </Link>
                              <p className="mt-0.5 max-w-xs truncate text-xs text-slate-500">
                                {user.email}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {user.emailVerifiedAt ? (
                                  <Badge>Email verified</Badge>
                                ) : (
                                  <Badge>Unverified</Badge>
                                )}
                                {user.onboardingCompletedAt ? null : (
                                  <Badge>Onboarding pending</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={user.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {user.stats ? (
                            <>
                              <p className="font-medium text-slate-800">
                                Level {user.stats.currentLevel}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatNumber(user.stats.totalXp)} XP · {user.stats.currentStreak}d
                                streak
                              </p>
                            </>
                          ) : (
                            <span className="text-slate-400">No activity</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <p className="text-xs">
                            <span className="font-medium text-slate-800">
                              {user._count?.lessonProgress ?? 0}
                            </span>{' '}
                            lesson progress
                          </p>
                          <p className="text-xs">
                            <span className="font-medium text-slate-800">
                              {user._count?.quizAttempts ?? 0}
                            </span>{' '}
                            quiz attempts
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {entitlementActive ? (
                            <Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-600/20">
                              Premium
                            </Badge>
                          ) : (
                            <Badge>Free</Badge>
                          )}
                          <p className="mt-1 text-xs text-slate-500">
                            {user._count?.subscriptions ?? 0} subscription
                            {(user._count?.subscriptions ?? 0) === 1 ? '' : 's'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {user.lastActiveAt ? formatRelative(user.lastActiveAt) : 'Never'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/users/${user.id}`}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                          >
                            Open →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </>
  );
}
