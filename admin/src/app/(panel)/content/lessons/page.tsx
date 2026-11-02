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
  type CourseModule,
  type Lesson,
  type Paginated,
  type ProficiencyLevel,
} from '@/lib/types';

interface LessonFormState {
  moduleId: string;
  slug: string;
  title: string;
  summary: string;
  objective: string;
  difficulty: ProficiencyLevel;
  estimatedMinutes: string;
  accessTier: AccessTier;
  primaryLanguage: ContentLanguage;
  requiresQuiz: boolean;
}

const emptyForm: LessonFormState = {
  moduleId: '',
  slug: '',
  title: '',
  summary: '',
  objective: '',
  difficulty: 'BEGINNER',
  estimatedMinutes: '5',
  accessTier: 'FREE',
  primaryLanguage: 'ENGLISH',
  requiresQuiz: false,
};

export default function LessonsPage() {
  const { canWriteContent } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [moduleId, setModuleId] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<LessonFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, moduleId, status]);

  const query = buildQuery({ page, pageSize: 20, search: debouncedSearch, status, moduleId });
  const { data, loading, error, reload } = useApi<Paginated<Lesson>>(`/admin/lessons${query}`);
  const { data: modules } = useApi<Paginated<CourseModule>>('/admin/modules?page=1&pageSize=100');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialStatus = params.get('status');
    const initialModule = params.get('moduleId');
    if (initialStatus) {
      setStatus(initialStatus);
    }
    if (initialModule) {
      setModuleId(initialModule);
    }
  }, []);

  function openCreate() {
    setForm({ ...emptyForm, moduleId: moduleId || modules?.items[0]?.id || '' });
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch('/admin/lessons', {
        method: 'POST',
        json: {
          moduleId: form.moduleId,
          slug: form.slug.trim(),
          title: form.title.trim(),
          summary: form.summary.trim(),
          objective: form.objective.trim(),
          difficulty: form.difficulty,
          estimatedMinutes: Number(form.estimatedMinutes) || 5,
          accessTier: form.accessTier,
          primaryLanguage: form.primaryLanguage,
          requiresQuiz: form.requiresQuiz,
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
        title="Lessons"
        description="Search every lesson, track its publication state and jump into the editor."
        actions={
          canWriteContent ? (
            <Button onClick={openCreate} disabled={!modules?.items.length}>
              New lesson
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
            placeholder="Search lessons…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search lessons"
          />
          <Select
            value={moduleId}
            onChange={(event) => setModuleId(event.target.value)}
            aria-label="Filter by module"
          >
            <option value="">All modules</option>
            {modules?.items.map((module) => (
              <option key={module.id} value={module.id}>
                {module.course?.title ? `${module.course.title} / ` : ''}
                {module.title}
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
            {data ? `${data.total} lesson${data.total === 1 ? '' : 's'}` : 'Loading…'}
          </span>
        </div>

        {loading && !data ? (
          <PageLoading label="Loading lessons…" />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="No lessons found"
            description="Create a lesson inside a module, or adjust your filters."
            action={
              canWriteContent ? (
                <Button onClick={openCreate} disabled={!modules?.items.length}>
                  Create lesson
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
                    <th className="px-4 py-3">Lesson</th>
                    <th className="px-4 py-3">Placement</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Content</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((lesson) => (
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
                          <Badge>{titleCase(lesson.accessTier)}</Badge>
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
                        {lesson._count?.blocks ?? 0} blocks · {lesson._count?.quizzes ?? 0} quizzes
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
                              onChanged={() => reload(true)}
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
        title="New lesson"
        description="Pick the module that should contain this lesson."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="new-lesson-list-form" loading={saving}>
              Create lesson
            </Button>
          </>
        }
      >
        <form id="new-lesson-list-form" className="space-y-4" onSubmit={handleSubmit}>
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Field label="Module" htmlFor="lesson-module" required>
            <Select
              id="lesson-module"
              value={form.moduleId}
              onChange={(event) => setForm({ ...form, moduleId: event.target.value })}
              required
            >
              <option value="">Choose a module…</option>
              {modules?.items.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.course?.title ? `${module.course.title} / ` : ''}
                  {module.title}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor="lesson-title" required>
              <Input
                id="lesson-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                required
              />
            </Field>
            <Field label="Slug" htmlFor="lesson-slug" required>
              <Input
                id="lesson-slug"
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
            </Field>
          </div>
          <Field label="Summary" htmlFor="lesson-summary" required>
            <Input
              id="lesson-summary"
              value={form.summary}
              onChange={(event) => setForm({ ...form, summary: event.target.value })}
              required
            />
          </Field>
          <Field label="Objective" htmlFor="lesson-objective" required>
            <Textarea
              id="lesson-objective"
              value={form.objective}
              onChange={(event) => setForm({ ...form, objective: event.target.value })}
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Difficulty" htmlFor="lesson-difficulty">
              <Select
                id="lesson-difficulty"
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
            <Field label="Access" htmlFor="lesson-access">
              <Select
                id="lesson-access"
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
            <Field label="Estimated minutes" htmlFor="lesson-minutes">
              <Input
                id="lesson-minutes"
                type="number"
                min={1}
                max={600}
                value={form.estimatedMinutes}
                onChange={(event) => setForm({ ...form, estimatedMinutes: event.target.value })}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Primary language" htmlFor="lesson-language">
              <Select
                id="lesson-language"
                value={form.primaryLanguage}
                onChange={(event) =>
                  setForm({ ...form, primaryLanguage: event.target.value as ContentLanguage })
                }
              >
                {CONTENT_LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {titleCase(language)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <Checkbox
                label="Quiz required for completion"
                checked={form.requiresQuiz}
                onChange={(event) => setForm({ ...form, requiresQuiz: event.target.checked })}
                className="w-full"
              />
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
