'use client';

import Link from 'next/link';
import { useState } from 'react';
import { StatusActions } from '@/components/actions';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  PageLoading,
  SectionHeader,
  StatusBadge,
} from '@/components/ui';
import { useAdminAuth } from '@/lib/auth';
import { formatRelative, titleCase } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Course, LearningPath, Lesson, Paginated } from '@/lib/types';

export default function ReviewQueuePage() {
  const { canWriteContent } = useAdminAuth();
  const [actionError, setActionError] = useState<string | null>(null);

  const paths = useApi<Paginated<LearningPath>>(
    '/admin/learning-paths?status=IN_REVIEW&page=1&pageSize=50',
  );
  const courses = useApi<Paginated<Course>>('/admin/courses?status=IN_REVIEW&page=1&pageSize=50');
  const lessons = useApi<Paginated<Lesson>>('/admin/lessons?status=IN_REVIEW&page=1&pageSize=50');

  const loading = paths.loading || courses.loading || lessons.loading;
  const error = paths.error ?? courses.error ?? lessons.error;
  const total = (paths.data?.total ?? 0) + (courses.data?.total ?? 0) + (lessons.data?.total ?? 0);

  async function refreshAll() {
    await Promise.all([paths.reload(true), courses.reload(true), lessons.reload(true)]);
  }

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Review queue"
        description="Everything submitted for review, ready for a publish decision."
        actions={
          <>
            <Badge>
              {total} item{total === 1 ? '' : 's'} waiting
            </Badge>
            <Button variant="secondary" size="sm" onClick={() => void refreshAll()}>
              Refresh
            </Button>
          </>
        }
      />

      {error ? (
        <Alert variant="error" className="mb-4">
          <div className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button variant="secondary" size="sm" onClick={() => void refreshAll()}>
              Retry
            </Button>
          </div>
        </Alert>
      ) : null}
      {actionError ? (
        <Alert variant="error" className="mb-4" title="Action failed">
          {actionError}
        </Alert>
      ) : null}

      {loading && !paths.data && !courses.data && !lessons.data ? (
        <PageLoading label="Loading review queue…" />
      ) : total === 0 ? (
        <EmptyState
          title="The review queue is clear"
          description="Lessons, courses and learning paths appear here when an editor submits them for review."
          action={
            <ButtonLink href="/content/lessons" variant="secondary" size="sm">
              Browse lessons
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <SectionHeader
              title="Lessons"
              description="The most common review unit. Publishing makes the lesson visible to learners."
              actions={<Badge>{lessons.data?.total ?? 0} waiting</Badge>}
              className="border-b border-slate-200 px-5 py-4"
            />
            {(lessons.data?.items.length ?? 0) === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">No lessons are waiting for review.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Lesson</th>
                      <th className="px-4 py-3">Placement</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Updated</th>
                      <th className="px-4 py-3 text-right">Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lessons.data?.items.map((lesson) => (
                      <tr key={lesson.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <Link
                            href={`/content/lessons/${lesson.id}`}
                            className="font-medium text-slate-900 hover:text-indigo-600"
                          >
                            {lesson.title}
                          </Link>
                          <p className="mt-0.5 max-w-md truncate text-xs text-slate-400">
                            {lesson.summary}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge>{titleCase(lesson.difficulty)}</Badge>
                            {lesson.requiresQuiz ? <Badge>Quiz gated</Badge> : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {lesson.module?.course?.learningPath?.title ? (
                            <span className="text-slate-400">
                              {lesson.module.course.learningPath.title} /{' '}
                            </span>
                          ) : null}
                          {lesson.module?.course?.title ? (
                            <span className="text-slate-400">{lesson.module.course.title} / </span>
                          ) : null}
                          <span className="font-medium text-slate-700">
                            {lesson.module?.title ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={lesson.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {formatRelative(lesson.updatedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {canWriteContent ? (
                              <StatusActions
                                kind="lessons"
                                id={lesson.id}
                                status={lesson.status}
                                compact
                                onChanged={refreshAll}
                                onError={setActionError}
                              />
                            ) : null}
                            <Link
                              href={`/content/lessons/${lesson.id}`}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                            >
                              Open →
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="overflow-hidden">
              <SectionHeader
                title="Courses"
                description="Courses waiting for a publish decision."
                actions={<Badge>{courses.data?.total ?? 0} waiting</Badge>}
                className="border-b border-slate-200 px-5 py-4"
              />
              {(courses.data?.items.length ?? 0) === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-500">
                  No courses are waiting for review.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {courses.data?.items.map((course) => (
                    <li key={course.id} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/content/courses/${course.id}`}
                            className="font-medium text-slate-900 hover:text-indigo-600"
                          >
                            {course.title}
                          </Link>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {course.learningPath?.title ?? 'Learning path'} ·{' '}
                            {course._count?.modules ?? course.moduleCount ?? 0} modules
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Updated {formatRelative(course.updatedAt)}
                          </p>
                        </div>
                        <StatusBadge status={course.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                        {canWriteContent ? (
                          <StatusActions
                            kind="courses"
                            id={course.id}
                            status={course.status}
                            compact
                            onChanged={refreshAll}
                            onError={setActionError}
                          />
                        ) : null}
                        <Link
                          href={`/content/courses/${course.id}`}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                        >
                          Open →
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="overflow-hidden">
              <SectionHeader
                title="Learning paths"
                description="Top-level paths waiting for a publish decision."
                actions={<Badge>{paths.data?.total ?? 0} waiting</Badge>}
                className="border-b border-slate-200 px-5 py-4"
              />
              {(paths.data?.items.length ?? 0) === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-500">
                  No learning paths are waiting for review.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {paths.data?.items.map((path) => (
                    <li key={path.id} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/content/learning-paths/${path.id}`}
                            className="font-medium text-slate-900 hover:text-indigo-600"
                          >
                            {path.title}
                          </Link>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {path._count?.courses ?? path.courses?.length ?? 0} courses
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Updated {formatRelative(path.updatedAt)}
                          </p>
                        </div>
                        <StatusBadge status={path.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                        {canWriteContent ? (
                          <StatusActions
                            kind="learning-paths"
                            id={path.id}
                            status={path.status}
                            compact
                            onChanged={refreshAll}
                            onError={setActionError}
                          />
                        ) : null}
                        <Link
                          href={`/content/learning-paths/${path.id}`}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                        >
                          Open →
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
