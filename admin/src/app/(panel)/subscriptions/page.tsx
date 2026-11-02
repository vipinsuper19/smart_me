'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AccessDenied,
  Alert,
  Badge,
  Button,
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
import { formatDate, formatNumber, formatPaise, formatRelative, titleCase } from '@/lib/format';
import { useApi, useDebouncedValue } from '@/lib/hooks';
import {
  SUBSCRIPTION_STATUSES,
  type Paginated,
  type Subscription,
  type SubscriptionPlan,
} from '@/lib/types';

export default function SubscriptionsPage() {
  const { canViewBusiness } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [planId, setPlanId] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, planId]);

  const { data: plans } = useApi<{ items: SubscriptionPlan[] }>(
    canViewBusiness ? '/admin/subscription-plans' : null,
  );
  const query = buildQuery({ page, pageSize: 20, search: debouncedSearch, status, planId });
  const { data, loading, error, reload } = useApi<Paginated<Subscription>>(
    canViewBusiness ? `/admin/subscriptions${query}` : null,
  );

  if (!canViewBusiness) {
    return (
      <>
        <PageHeader eyebrow="Business" title="Subscriptions" />
        <AccessDenied message="Subscription data is limited to super admins and analysts." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Business"
        title="Subscriptions"
        description="Read-only view of learner subscriptions, plans and billing state."
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
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_auto]">
          <Input
            placeholder="Search learner by name or email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search subscriptions"
          />
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {SUBSCRIPTION_STATUSES.map((item) => (
              <option key={item} value={item}>
                {titleCase(item)}
              </option>
            ))}
          </Select>
          <Select
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
            aria-label="Filter by plan"
          >
            <option value="">All plans</option>
            {(plans?.items ?? []).map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </Select>
          <span className="self-center text-sm text-slate-500">
            {data ? `${formatNumber(data.total)} record${data.total === 1 ? '' : 's'}` : 'Loading…'}
          </span>
        </div>

        {loading && !data ? (
          <PageLoading label="Loading subscriptions…" />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="No subscriptions found"
            description="Try a different learner, status or plan filter."
            className="m-4"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Learner</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Renewal</th>
                    <th className="px-4 py-3">Period end</th>
                    <th className="px-4 py-3">Started</th>
                    <th className="px-4 py-3 text-right">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((subscription) => (
                    <tr key={subscription.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        {subscription.user ? (
                          <>
                            <Link
                              href={`/users/${subscription.user.id}`}
                              className="font-medium text-slate-900 hover:text-indigo-600"
                            >
                              {subscription.user.name?.trim() || subscription.user.email}
                            </Link>
                            <p className="mt-0.5 max-w-xs truncate text-xs text-slate-500">
                              {subscription.user.email}
                            </p>
                          </>
                        ) : (
                          <span className="text-slate-400">Unknown learner</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">
                          {subscription.plan?.name ?? 'Unknown plan'}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {subscription.plan
                            ? `${formatPaise(subscription.plan.priceInPaise, subscription.plan.currency)} / ${titleCase(subscription.plan.billingPeriod)}`
                            : '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={subscription.status} />
                        <p className="mt-1 text-xs text-slate-500">
                          {titleCase(subscription.provider)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {subscription.autoRenewing ? (
                          <Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-600/20">
                            Auto-renewing
                          </Badge>
                        ) : (
                          <Badge>Manual</Badge>
                        )}
                        {subscription.cancelAtPeriodEnd ? (
                          <p className="mt-1 text-xs text-amber-600">Cancels at period end</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {formatDate(subscription.currentPeriodEnd)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {subscription.startedAt ? formatRelative(subscription.startedAt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/subscriptions/${subscription.id}`}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  ))}
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

      {plans && plans.items.length > 0 ? (
        <Card className="mt-5 overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Configured plans</h2>
            <p className="mt-1 text-sm text-slate-500">
              Plan catalogue used by the learner app and billing.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Billing</th>
                  <th className="px-4 py-3">Subscriptions</th>
                  <th className="px-4 py-3">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.items.map((plan) => (
                  <tr key={plan.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{plan.name}</p>
                      <p className="text-xs text-slate-400">{plan.code}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatPaise(plan.priceInPaise, plan.currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{titleCase(plan.billingPeriod)}</td>
                    <td className="px-4 py-3 text-slate-600">{plan._count?.subscriptions ?? 0}</td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          plan.isActive
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                            : 'bg-slate-100 text-slate-600 ring-slate-500/20'
                        }
                      >
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </>
  );
}
