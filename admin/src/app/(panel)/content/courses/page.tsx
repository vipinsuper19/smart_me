'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { StatusActions } from '@/components/actions';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoading,
  Pagination,
  Select,
  StatusBadge,
  Textarea,
} from '@/components/ui';
import { apiFetch, buildQuery, errorMessage } from '@/lib/api';
import { useAdminAuth } from '@/lib/auth';
import { formatRelative, titleCase } from '@/lib/format';
import { useApi, useDebouncedValue } from '@/lib/hooks';
import {
  ACCESS_TIERS,
  CONTENT_LANGUAGES,
  PROFICIENCY_LEVELS,
  PUBLICATION_STATUSES,
  type AccessTier,
  type ContentLanguage,
  type Course,
  type LearningPath,
  type Paginated,
  type ProficiencyLevel,
} from '@/lib/types';

interface CourseFormState {
  learningPathId: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  coverImageUrl: string;
  objectives: string;
  difficulty: ProficiencyLevel;
  estimatedMinutes: string;
  accessTier: AccessTier;
  availableLanguages: ContentLanguage[];
}

export default function CoursesPage() {
  const { canWriteContent } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [pathId, setPathId] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CourseFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pathId, status]);

  const query = buildQuery({
    page,
    pageSize: 20,
    search: debouncedSearch,
    status,
    learningPathId: pathId,
  });
  const { data, loading, error, reload } = useApi<Paginated<Course>>(`/admin/courses${query}`);
  const { data: paths } = useApi<Paginated<LearningPath>>(
    '/admin/learning-paths?page=1&pageSize=100',
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialPath = params.get('learningPathId');
    if (initialPath) {
      setPathId(initialPath);
    }
  }, []);

  function openCreate() {
    setForm({
      learningPathId: pathId || paths?.items[0]?.id || '',
      slug: '',
      title: '',
      shortDescription: '',
      description: '',
      coverImageUrl: '',
      objectives: '',
      difficulty: 'BEGINNER',
      estimatedMinutes: '10',
      accessTier: 'FREE',
      availableLanguages: ['ENGLISH'],
    });
    setFormError(null);
    setFormOpen(true);
  }

  function toggleLanguage(language: ContentLanguage) {
    setForm((current) => {
      if (!current) return current;
      const has = current.availableLanguages.includes(language);
      const next = has
        ? current.availableLanguages.filter((item) => item !== language)
        : [...current.availableLanguages, language];
      return {
        ...current,
        availableLanguages: next.length > 0 ? next : current.availableLanguages,
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch('/admin/courses', {
        method: 'POST',
        json: {
          learningPathId: form.learningPathId,
          slug: form.slug.trim(),
          title: form.title.trim(),
          shortDescription: form.shortDescription.trim(),
          description: form.description.trim() || null,
          coverImageUrl: form.coverImageUrl.trim() || null,
          objectives: form.objectives
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean),
          difficulty: form.difficulty,
          estimatedMinutes: Number(form.estimatedMinutes) || 10,
          accessTier: form.accessTier,
          availableLanguages: form.availableLanguages,
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
        title="Courses"
        description="Browse every course across the catalogue and publish content into the right path."
        actions={
          canWriteContent ? (
            <Button onClick={openCreate} disabled={!paths?.items.length}>
              New course
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
      {actionError ? (
        <Alert variant="error" className="mb-4" title="Action failed">
          {actionError}
        </Alert>
      ) : null}

      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_auto]">
          <Input
            placeholder="Search courses…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search courses"
          />
          <Select
            value={pathId}
            onChange={(event) => setPathId(event.target.value)}
            aria-label="Filter by learning path"
          >
            <option value="">All learning paths</option>
            {paths?.items.map((path) => (
              <option key={path.id} value={path.id}>
                {path.title}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {PUBLICATION_STATUSES.map((item) => (
              <option key={item} value={item}>
                {titleCase(item)}
              </option>
            ))}
          </Select>
          <span className="self-center text-sm text-slate-500">
            {data ? `${data.total} course${data.total === 1 ? '' : 's'}` : 'Loading…'}
          </span>
        </div>

        {loading && !data ? (
          <PageLoading label="Loading courses…" />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="No courses found"
            description="Create a course inside a learning path, or adjust your filters."
            action={
              canWriteContent ? (
                <Button onClick={openCreate} disabled={!paths?.items.length}>
                  Create course
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
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Learning path</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Structure</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((course) => (
                    <tr key={course.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <Link
                          href={`/content/courses/${course.id}`}
                          className="font-medium text-slate-900 hover:text-indigo-600"
                        >
                          {course.title}
                        </Link>
                        <p className="mt-0.5 max-w-md truncate text-xs text-slate-400">
                          {course.shortDescription}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {course.learningPath?.title ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={course.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {course.moduleCount ?? course._count?.modules ?? 0} modules ·{' '}
                        {course.lessonCount ?? '—'} lessons
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatRelative(course.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {canWriteContent ? (
                            <StatusActions
                              kind="courses"
                              id={course.id}
                              status={course.status}
                              compact
                              onChanged={() => reload(true)}
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
        title="New course"
        description="Courses group modules and lessons under a learner-facing path."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="new-course-form" loading={saving}>
              Create course
            </Button>
          </>
        }
      >
        {form ? (
          <form id="new-course-form" className="space-y-4" onSubmit={handleSubmit}>
            {formError ? <Alert variant="error">{formError}</Alert> : null}
            <Field label="Learning path" htmlFor="new-course-path" required>
              <Select
                id="new-course-path"
                value={form.learningPathId}
                onChange={(event) => setForm({ ...form, learningPathId: event.target.value })}
                required
              >
                <option value="">Choose a path…</option>
                {paths?.items.map((path) => (
                  <option key={path.id} value={path.id}>
                    {path.title}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor="new-course-title" required>
                <Input
                  id="new-course-title"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  required
                />
              </Field>
              <Field label="Slug" htmlFor="new-course-slug" required>
                <Input
                  id="new-course-slug"
                  value={form.slug}
                  onChange={(event) => setForm({ ...form, slug: event.target.value })}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                />
              </Field>
            </div>
            <Field label="Short description" htmlFor="new-course-short" required>
              <Input
                id="new-course-short"
                value={form.shortDescription}
                onChange={(event) => setForm({ ...form, shortDescription: event.target.value })}
                required
              />
            </Field>
            <Field label="Long description" htmlFor="new-course-description">
              <Textarea
                id="new-course-description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </Field>
            <Field label="Cover image URL" htmlFor="new-course-cover">
              <Input
                id="new-course-cover"
                type="url"
                value={form.coverImageUrl}
                onChange={(event) => setForm({ ...form, coverImageUrl: event.target.value })}
              />
            </Field>
            <Field
              label="Objectives"
              htmlFor="new-course-objectives"
              hint="One objective per line."
            >
              <Textarea
                id="new-course-objectives"
                value={form.objectives}
                onChange={(event) => setForm({ ...form, objectives: event.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Difficulty" htmlFor="new-course-difficulty">
                <Select
                  id="new-course-difficulty"
                  value={form.difficulty}
                  onChange={(event) =>
                    setForm({ ...form, difficulty: event.target.value as ProficiencyLevel })
                  }
                >
                  {PROFICIENCY_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {titleCase(level)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Access" htmlFor="new-course-access">
                <Select
                  id="new-course-access"
                  value={form.accessTier}
                  onChange={(event) =>
                    setForm({ ...form, accessTier: event.target.value as AccessTier })
                  }
                >
                  {ACCESS_TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {titleCase(tier)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Estimated minutes" htmlFor="new-course-minutes">
                <Input
                  id="new-course-minutes"
                  type="number"
                  min={1}
                  value={form.estimatedMinutes}
                  onChange={(event) => setForm({ ...form, estimatedMinutes: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Available languages" required>
              <div className="grid gap-2 sm:grid-cols-3">
                {CONTENT_LANGUAGES.map((language) => (
                  <Checkbox
                    key={language}
                    label={titleCase(language)}
                    checked={form.availableLanguages.includes(language)}
                    onChange={() => toggleLanguage(language)}
                  />
                ))}
              </div>
            </Field>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
