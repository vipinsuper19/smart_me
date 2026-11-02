'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  AccessDenied,
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  PageLoading,
  SectionHeader,
  StatCard,
} from '@/components/ui';
import { useAdminAuth } from '@/lib/auth';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { AnalyticsData } from '@/lib/types';

const RANGES = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
];

function DailyChart({
  title,
  description,
  series,
  color,
}: {
  title: string;
  description: string;
  series: { date: string; value: number }[];
  color: string;
}) {
  const max = Math.max(1, ...series.map((point) => point.value));

  return (
    <Card className="overflow-hidden">
      <SectionHeader
        title={title}
        description={description}
        className="border-b border-slate-200 px-5 py-4"
      />
      <div className="px-5 py-5">
        {series.length === 0 ? (
          <p className="text-sm text-slate-500">No data for this range.</p>
        ) : (
          <>
            <div className="flex h-40 items-end gap-1">
              {series.map((point) => (
                <div
                  key={point.date}
                  className="group relative flex h-full flex-1 flex-col justify-end"
                >
                  <div
                    className={`w-full rounded-t ${color} transition group-hover:opacity-80`}
                    style={{ height: `${Math.max(2, (point.value / max) * 100)}%` }}
                  />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-[11px] whitespace-nowrap text-white group-hover:block">
                    {formatDate(point.date)} · {formatNumber(point.value)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-400">
              <span>{formatDate(series[0]?.date)}</span>
              <span>{formatDate(series[series.length - 1]?.date)}</span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { canViewBusiness } = useAdminAuth();
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useApi<AnalyticsData>(
    canViewBusiness ? `/admin/analytics/overview?days=${days}` : null,
  );

  if (!canViewBusiness) {
    return (
      <>
        <PageHeader eyebrow="Business" title="Analytics" />
        <AccessDenied message="Analytics are limited to super admins and analysts." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Business"
        title="Analytics"
        description="Learner activity, completion trends and quiz performance."
        actions={
          <>
            {RANGES.map((range) => (
              <Button
                key={range.days}
                variant={days === range.days ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setDays(range.days)}
              >
                {range.label}
              </Button>
            ))}
          </>
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

      {loading && !data ? (
        <PageLoading label="Loading analytics…" />
      ) : data ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Badge>{data.range.days}-day window</Badge>
            <span>
              {formatDate(data.range.from)} → {formatDate(data.range.to)}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Active learners"
              value={formatNumber(data.totals.activeLearners)}
              detail="Distinct learners with recorded activity"
              accent="indigo"
            />
            <StatCard
              label="New learners"
              value={formatNumber(data.totals.newUsers)}
              detail="Accounts created in this window"
              accent="emerald"
            />
            <StatCard
              label="Lessons completed"
              value={formatNumber(data.totals.lessonsCompleted)}
              detail={`${formatNumber(data.totals.minutesLearned)} minutes learned`}
              accent="amber"
            />
            <StatCard
              label="Quizzes completed"
              value={formatNumber(data.totals.quizzesCompleted)}
              detail={`${formatNumber(data.totals.submittedQuizAttempts)} submitted attempts`}
              accent="slate"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Average quiz score"
              value={formatPercent(data.totals.averageQuizScore)}
              detail="Across submitted attempts"
              accent="indigo"
            />
            <StatCard
              label="XP earned"
              value={formatNumber(data.totals.xpEarned)}
              detail="All XP transactions in range"
              accent="emerald"
            />
            <StatCard
              label="Minutes learned"
              value={formatNumber(data.totals.minutesLearned)}
              detail="Sum of daily activity"
              accent="amber"
            />
            <StatCard
              label="Daily average completions"
              value={formatNumber(
                Math.round((data.totals.lessonsCompleted / Math.max(1, data.range.days)) * 10) / 10,
              )}
              detail="Lessons completed per day"
              accent="slate"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <DailyChart
              title="Lessons completed"
              description="Daily completed lessons over the selected window."
              series={data.daily.map((day) => ({ date: day.date, value: day.lessonsCompleted }))}
              color="bg-indigo-500"
            />
            <DailyChart
              title="Active learners"
              description="Daily learners with any recorded activity."
              series={data.daily.map((day) => ({ date: day.date, value: day.activeLearners }))}
              color="bg-emerald-500"
            />
          </div>

          <Card className="overflow-hidden">
            <SectionHeader
              title="Product events"
              description="Client analytics events ingested in this window."
              className="border-b border-slate-200 px-5 py-4"
              actions={<Badge>{formatNumber(data.productEvents.total)} total</Badge>}
            />
            {data.productEvents.top.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">
                No product events recorded in this window.
              </p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {data.productEvents.top.map((event, index) => (
                  <li key={event.name} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {index + 1}
                    </span>
                    <code className="min-w-0 flex-1 truncate font-mono text-sm text-slate-900">
                      {event.name}
                    </code>
                    <Badge>{formatNumber(event.count)}</Badge>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
            <Card className="overflow-hidden">
              <SectionHeader
                title="Top lessons"
                description="Most completions in this window."
                className="border-b border-slate-200 px-5 py-4"
              />
              {data.topLessons.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-500">
                  No lesson completions in this window.
                </p>
              ) : (
                <ol className="divide-y divide-slate-100">
                  {data.topLessons.map((row, index) => (
                    <li
                      key={`${row.lesson?.id ?? 'unknown'}-${index}`}
                      className="flex items-center gap-3 px-5 py-3.5"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        {row.lesson ? (
                          <Link
                            href={`/content/lessons/${row.lesson.id}`}
                            className="block truncate font-medium text-slate-900 hover:text-indigo-600"
                          >
                            {row.lesson.title}
                          </Link>
                        ) : (
                          <span className="text-slate-500">Deleted lesson</span>
                        )}
                        {row.lesson ? (
                          <p className="truncate text-xs text-slate-400">/{row.lesson.slug}</p>
                        ) : null}
                      </div>
                      <Badge>{formatNumber(row.completions)}</Badge>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card className="overflow-hidden">
              <SectionHeader
                title="Daily breakdown"
                description="Underlying activity series for the selected window."
                className="border-b border-slate-200 px-5 py-4"
              />
              {data.daily.length === 0 ? (
                <EmptyState title="No daily activity" className="m-5" />
              ) : (
                <div className="max-h-96 overflow-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Active</th>
                        <th className="px-4 py-3 text-right">New</th>
                        <th className="px-4 py-3 text-right">Lessons</th>
                        <th className="px-4 py-3 text-right">Quizzes</th>
                        <th className="px-4 py-3 text-right">Minutes</th>
                        <th className="px-4 py-3 text-right">XP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...data.daily].reverse().map((day) => (
                        <tr key={day.date} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5 text-slate-700">{formatDate(day.date)}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">
                            {formatNumber(day.activeLearners)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-600">
                            {formatNumber(day.newUsers)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-600">
                            {formatNumber(day.lessonsCompleted)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-600">
                            {formatNumber(day.quizzesCompleted)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-600">
                            {formatNumber(day.minutesLearned)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-600">
                            {formatNumber(day.xpEarned)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}
