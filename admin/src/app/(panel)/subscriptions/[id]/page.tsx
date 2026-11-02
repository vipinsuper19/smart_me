'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AccessDenied,
  Alert,
  Badge,
  Button,
  Card,
  PageHeader,
  PageLoading,
  SectionHeader,
  StatusBadge,
} from '@/components/ui';
import { useAdminAuth } from '@/lib/auth';
import { formatDate, formatDateTime, formatPaise, formatRelative, titleCase } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Subscription } from '@/lib/types';

function DateRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{formatDateTime(value)}</span>
    </div>
  );
}

export default function SubscriptionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { canViewBusiness } = useAdminAuth();
  const { data, loading, error, reload } = useApi<Subscription>(
    id && canViewBusiness ? `/admin/subscriptions/${id}` : null,
  );

  if (!canViewBusiness) {
    return (
      <>
        <PageHeader eyebrow="Business" title="Subscription" />
        <AccessDenied message="Subscription details are limited to super admins and analysts." />
      </>
    );
  }

  if (loading && !data) {
    return <PageLoading label="Loading subscription…" />;
  }

  if (error || !data) {
    return (
      <>
        <PageHeader
          title="Subscription"
          back={
            <Link href="/subscriptions" className="text-indigo-600 hover:text-indigo-500">
              ← Subscriptions
            </Link>
          }
        />
        <Alert variant="error">
          {error ?? 'This subscription could not be found.'}{' '}
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
        eyebrow="Subscription"
        title={data.plan?.name ?? 'Subscription'}
        description={`${titleCase(data.provider)} · created ${formatDate(data.createdAt)}`}
        back={
          <Link href="/subscriptions" className="text-indigo-600 hover:text-indigo-500">
            ← Subscriptions
          </Link>
        }
        actions={
          <>
            <StatusBadge status={data.status} />
            {data.autoRenewing ? <Badge>Auto-renewing</Badge> : <Badge>Manual renewal</Badge>}
            {data.cancelAtPeriodEnd ? (
              <Badge tone="bg-amber-50 text-amber-700 ring-amber-600/20">
                Cancels at period end
              </Badge>
            ) : null}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Learner</p>
            {data.user ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Link
                    href={`/users/${data.user.id}`}
                    className="text-lg font-semibold text-slate-900 hover:text-indigo-600"
                  >
                    {data.user.name?.trim() || data.user.email}
                  </Link>
                  <p className="text-sm text-slate-500">{data.user.email}</p>
                </div>
                <StatusBadge status={data.user.status} />
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                The linked learner record is unavailable.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Plan</p>
            {data.plan ? (
              <div className="mt-2 space-y-1.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Name</span>
                  <span className="font-medium text-slate-800">{data.plan.name}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Code</span>
                  <span className="font-medium text-slate-800">{data.plan.code}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Price</span>
                  <span className="font-medium text-slate-800">
                    {formatPaise(data.plan.priceInPaise, data.plan.currency)} /{' '}
                    {titleCase(data.plan.billingPeriod)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Google Play product</span>
                  <span className="font-medium text-slate-800">
                    {data.plan.googlePlayProductId ?? '—'}
                  </span>
                </div>
                {data.plan.benefits.length > 0 ? (
                  <div className="pt-2">
                    <p className="text-xs font-medium text-slate-500">Benefits</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-700">
                      {data.plan.benefits.map((benefit) => (
                        <li key={benefit}>{benefit}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No plan details available.</p>
            )}
          </Card>

          <Card className="overflow-hidden">
            <SectionHeader
              title="Purchases"
              description="Verified store transactions linked to this subscription."
              actions={<Badge>{data.purchases?.length ?? 0}</Badge>}
              className="border-b border-slate-200 px-5 py-4"
            />
            {(data.purchases?.length ?? 0) === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">No purchase records.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Purchased</th>
                      <th className="px-4 py-3">Verified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.purchases?.map((purchase) => (
                      <tr key={purchase.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{purchase.productId}</p>
                          {purchase.orderId ? (
                            <p className="text-xs text-slate-400">Order {purchase.orderId}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {purchase.priceInPaise === null
                            ? '—'
                            : formatPaise(purchase.priceInPaise, purchase.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={purchase.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {formatDateTime(purchase.purchaseTime)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {purchase.verifiedAt
                            ? formatRelative(purchase.verifiedAt)
                            : 'Not verified'}
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
              title="Billing events"
              description="Provider webhook and lifecycle events."
              actions={<Badge>{data.billingEvents?.length ?? 0}</Badge>}
              className="border-b border-slate-200 px-5 py-4"
            />
            {(data.billingEvents?.length ?? 0) === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">No billing events recorded.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.billingEvents?.map((event) => (
                  <li
                    key={event.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{titleCase(event.type)}</p>
                      <p className="text-xs text-slate-500">
                        {event.providerEventType ?? 'No provider event type'}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatDateTime(event.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Lifecycle</p>
            <div className="mt-2 divide-y divide-slate-100 text-sm">
              <DateRow label="Started" value={data.startedAt} />
              <DateRow label="Current period start" value={data.currentPeriodStart} />
              <DateRow label="Current period end" value={data.currentPeriodEnd} />
              <DateRow label="Canceled" value={data.canceledAt} />
              <DateRow label="Ended" value={data.endedAt} />
              <DateRow label="Last verified" value={data.lastVerifiedAt} />
              <DateRow label="Created" value={data.createdAt} />
              <DateRow label="Updated" value={data.updatedAt} />
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
              Entitlement
            </p>
            {data.entitlement ? (
              <div className="mt-2 space-y-1.5 text-sm">
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
                  <span className="text-slate-500">Valid until</span>
                  <span className="font-medium text-slate-800">
                    {formatDate(data.entitlement.validUntil)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Source</span>
                  <span className="font-medium text-slate-800">
                    {titleCase(data.entitlement.source ?? '—')}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                No entitlement is linked to this subscription.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Provider</p>
            <div className="mt-2 space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Provider</span>
                <span className="font-medium text-slate-800">{titleCase(data.provider)}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-500">Provider ID</span>
                <span className="max-w-[60%] break-all text-right font-medium text-slate-800">
                  {data.providerSubscriptionId ?? '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Auto-renewing</span>
                <span className="font-medium text-slate-800">
                  {data.autoRenewing ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Cancel at period end</span>
                <span className="font-medium text-slate-800">
                  {data.cancelAtPeriodEnd ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
