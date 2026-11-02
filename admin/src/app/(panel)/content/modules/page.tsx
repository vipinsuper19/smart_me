'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoading,
  Pagination,
  Select,
  Textarea,
} from '@/components/ui';
import { apiFetch, buildQuery, errorMessage } from '@/lib/api';
import { useAdminAuth } from '@/lib/auth';
import { formatRelative } from '@/lib/format';
import { useApi, useDebouncedValue } from '@/lib/hooks';
import type { Course, CourseModule, Paginated } from '@/lib/types';

interface ModuleFormState {
  courseId: string;
  slug: string;
  title: string;
  description: string;
  estimatedMinutes: string;
}

export default function ModulesPage() {
  const { canWriteContent } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ModuleFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [courseId, debouncedSearch]);

  const query = buildQuery({ page, pageSize: 20, search: debouncedSearch, courseId });
  const { data, loading, error, reload } = useApi<Paginated<CourseModule>>(
    `/admin/modules${query}`,
  );
  const { data: courses } = useApi<Paginated<Course>>('/admin/courses?page=1&pageSize=100');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialCourse = params.get('courseId');
    if (initialCourse) {
      setCourseId(initialCourse);
    }
  }, []);

  function openCreate() {
    setForm({
      courseId: courseId || courses?.items[0]?.id || '',
      slug: '',
      title: '',
      description: '',
      estimatedMinutes: '',
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch('/admin/modules', {
        method: 'POST',
        json: {
          courseId: form.courseId,
          slug: form.slug.trim(),
          title: form.title.trim(),
          description: form.description.trim() || null,
          estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : null,
        },
      });
      setFormOpen(false);
      await reload(true);
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Modules"
        description="Group lessons into coherent chunks inside a course."
        actions={
          canWriteContent ? (
            <Button onClick={openCreate} disabled={!courses?.items.length}>
              New module
            </Button>
          ) : (
            <Badge>Read-only role</Badge>
          )
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
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_auto]">
          <Input
            placeholder="Search modules…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search modules"
          />
          <Select
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            aria-label="Filter by course"
          >
            <option value="">All courses</option>
            {courses?.items.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </Select>
          <span className="self-center text-sm text-slate-500">
            {data ? `${data.total} module${data.total === 1 ? '' : 's'}` : 'Loading…'}
          </span>
        </div>

        {loading && !data ? (
          <PageLoading label="Loading modules…" />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="No modules found"
            description="Create a module inside a course, or adjust your filters."
            action={
              canWriteContent ? (
                <Button onClick={openCreate} disabled={!courses?.items.length}>
                  Create module
                </Button>
              ) : undefined
            }
            className="m-4"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Module</th>
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Lessons</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((module) => (
                    <tr key={module.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <Link
                          href={`/content/modules/${module.id}`}
                          className="font-medium text-slate-900 hover:text-indigo-600"
                        >
                          {module.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-400">/{module.slug}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {module.course?.learningPath?.title ? (
                          <span className="text-slate-400">
                            {module.course.learningPath.title} /{' '}
                          </span>
                        ) : null}
                        {module.course?.title ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{module._count?.lessons ?? 0}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatRelative(module.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/content/modules/${module.id}`}
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

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="New module"
        description="Modules keep lessons in a deliberate learning order."
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="new-module-form" loading={saving}>
              Create module
            </Button>
          </>
        }
      >
        {form ? (
          <form id="new-module-form" className="space-y-4" onSubmit={handleSubmit}>
            {formError ? <Alert variant="error">{formError}</Alert> : null}
            <Field label="Course" htmlFor="new-module-course" required>
              <Select
                id="new-module-course"
                value={form.courseId}
                onChange={(event) => setForm({ ...form, courseId: event.target.value })}
                required
              >
                <option value="">Choose a course…</option>
                {courses?.items.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.learningPath?.title ? `${course.learningPath.title} / ` : ''}
                    {course.title}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor="new-module-title" required>
                <Input
                  id="new-module-title"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  required
                />
              </Field>
              <Field label="Slug" htmlFor="new-module-slug" required>
                <Input
                  id="new-module-slug"
                  value={form.slug}
                  onChange={(event) => setForm({ ...form, slug: event.target.value })}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                />
              </Field>
            </div>
            <Field label="Description" htmlFor="new-module-description">
              <Textarea
                id="new-module-description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </Field>
            <Field label="Estimated minutes" htmlFor="new-module-minutes">
              <Input
                id="new-module-minutes"
                type="number"
                min={1}
                value={form.estimatedMinutes}
                onChange={(event) => setForm({ ...form, estimatedMinutes: event.target.value })}
              />
            </Field>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
