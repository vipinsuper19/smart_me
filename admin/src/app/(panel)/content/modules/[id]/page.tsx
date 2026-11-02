'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { DeleteAction, StatusActions } from '@/components/actions';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  ChevronIcon,
  EmptyState,
  Field,
  Input,
  MiniIconButton,
  Modal,
  PageHeader,
  PageLoading,
  SectionHeader,
  Select,
  StatusBadge,
  Textarea,
} from '@/components/ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { useAdminAuth } from '@/lib/auth';
import { formatDateTime, formatRelative, titleCase } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import {
  ACCESS_TIERS,
  CONTENT_LANGUAGES,
  PROFICIENCY_LEVELS,
  type AccessTier,
  type ContentLanguage,
  type CourseModule,
  type Lesson,
  type ProficiencyLevel,
} from '@/lib/types';

interface ModuleFormState {
  slug: string;
  title: string;
  description: string;
  estimatedMinutes: string;
}

interface LessonFormState {
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

const emptyLessonForm: LessonFormState = {
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

export default function ModuleDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const { canWriteContent } = useAdminAuth();
  const { data, loading, error, reload } = useApi<CourseModule>(id ? `/admin/modules/${id}` : null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [moduleFormOpen, setModuleFormOpen] = useState(false);
  const [moduleForm, setModuleForm] = useState<ModuleFormState | null>(null);
  const [moduleSaving, setModuleSaving] = useState(false);
  const [moduleFormError, setModuleFormError] = useState<string | null>(null);
  const [lessonFormOpen, setLessonFormOpen] = useState(false);
  const [lessonForm, setLessonForm] = useState<LessonFormState>(emptyLessonForm);
  const [lessonSaving, setLessonSaving] = useState(false);
  const [lessonFormError, setLessonFormError] = useState<string | null>(null);
  const [reordering, setReordering] = useState<string | null>(null);

  function openModuleForm() {
    if (!data) return;
    setModuleForm({
      slug: data.slug,
      title: data.title,
      description: data.description ?? '',
      estimatedMinutes: data.estimatedMinutes ? String(data.estimatedMinutes) : '',
    });
    setModuleFormError(null);
    setModuleFormOpen(true);
  }

  async function saveModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!moduleForm) return;
    setModuleSaving(true);
    setModuleFormError(null);
    try {
      await apiFetch(`/admin/modules/${id}`, {
        method: 'PATCH',
        json: {
          slug: moduleForm.slug.trim(),
          title: moduleForm.title.trim(),
          description: moduleForm.description.trim() || null,
          estimatedMinutes: moduleForm.estimatedMinutes
            ? Number(moduleForm.estimatedMinutes)
            : null,
        },
      });
      setModuleFormOpen(false);
      await reload(true);
    } catch (cause) {
      setModuleFormError(errorMessage(cause));
    } finally {
      setModuleSaving(false);
    }
  }

  function openLessonForm() {
    setLessonForm(emptyLessonForm);
    setLessonFormError(null);
    setLessonFormOpen(true);
  }

  async function createLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLessonSaving(true);
    setLessonFormError(null);
    try {
      await apiFetch('/admin/lessons', {
        method: 'POST',
        json: {
          moduleId: id,
          slug: lessonForm.slug.trim(),
          title: lessonForm.title.trim(),
          summary: lessonForm.summary.trim(),
          objective: lessonForm.objective.trim(),
          difficulty: lessonForm.difficulty,
          estimatedMinutes: Number(lessonForm.estimatedMinutes) || 5,
          accessTier: lessonForm.accessTier,
          primaryLanguage: lessonForm.primaryLanguage,
          requiresQuiz: lessonForm.requiresQuiz,
        },
      });
      setLessonFormOpen(false);
      await reload(true);
    } catch (cause) {
      setLessonFormError(errorMessage(cause));
    } finally {
      setLessonSaving(false);
    }
  }

  async function moveLesson(lesson: Lesson, direction: -1 | 1) {
    if (!data?.lessons) return;
    const ids = data.lessons.map((item) => item.id);
    const index = ids.indexOf(lesson.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;

    setReordering(lesson.id);
    setActionError(null);
    try {
      [ids[index], ids[target]] = [ids[target], ids[index]];
      await apiFetch('/admin/lessons/reorder', { method: 'POST', json: { ids } });
      await reload(true);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setReordering(null);
    }
  }

  if (loading && !data) {
    return <PageLoading label="Loading module…" />;
  }

  if (error || !data) {
    return (
      <>
        <PageHeader
          title="Module"
          back={
            <Link href="/content/modules" className="text-indigo-600 hover:text-indigo-500">
              ← Modules
            </Link>
          }
        />
        <Alert variant="error">
          {error ?? 'This module could not be found.'}{' '}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => void reload()}>
            Retry
          </Button>
        </Alert>
      </>
    );
  }

  const lessons = data.lessons ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Module"
        title={data.title}
        description={data.description ?? 'Lessons grouped inside this module.'}
        back={
          <div className="flex flex-wrap items-center gap-2 text-indigo-600">
            <Link href="/content/courses" className="hover:text-indigo-500">
              Courses
            </Link>
            <span className="text-slate-300">/</span>
            <Link href={`/content/courses/${data.courseId}`} className="hover:text-indigo-500">
              {data.course?.title ?? 'Course'}
            </Link>
          </div>
        }
        actions={
          <>
            {canWriteContent ? (
              <Button variant="secondary" size="sm" onClick={openModuleForm}>
                Edit module
              </Button>
            ) : null}
            <DeleteAction
              kind="modules"
              id={data.id}
              onDeleted={() => router.push(`/content/courses/${data.courseId}`)}
              onError={setActionError}
            />
          </>
        }
      />

      {actionError ? (
        <Alert variant="error" className="mb-4" title="Action failed">
          {actionError}
        </Alert>
      ) : null}

      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>/{data.slug}</Badge>
          {data.estimatedMinutes ? <Badge>{data.estimatedMinutes} min</Badge> : null}
          <Badge>{lessons.length} lessons</Badge>
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">Created</dt>
            <dd className="mt-1 text-slate-700">{formatDateTime(data.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">Updated</dt>
            <dd className="mt-1 text-slate-700">{formatDateTime(data.updatedAt)}</dd>
          </div>
        </dl>
      </Card>

      <Card className="overflow-hidden">
        <SectionHeader
          title="Lessons"
          description="Each lesson can carry blocks, translations and a quiz."
          actions={
            canWriteContent ? (
              <Button size="sm" onClick={openLessonForm}>
                Add lesson
              </Button>
            ) : undefined
          }
          className="border-b border-slate-200 px-5 py-4"
        />
        {lessons.length === 0 ? (
          <EmptyState
            title="No lessons yet"
            description="Add the first lesson to this module."
            action={
              canWriteContent ? <Button onClick={openLessonForm}>Create lesson</Button> : undefined
            }
            className="m-5"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="w-16 px-4 py-3">Order</th>
                  <th className="px-4 py-3">Lesson</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Content</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lessons.map((lesson, index) => (
                  <tr key={lesson.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="w-5 text-xs text-slate-400">{lesson.order}</span>
                        {canWriteContent ? (
                          <div className="flex flex-col">
                            <MiniIconButton
                              label="Move up"
                              disabled={index === 0 || reordering === lesson.id}
                              onClick={() => void moveLesson(lesson, -1)}
                            >
                              <ChevronIcon direction="up" />
                            </MiniIconButton>
                            <MiniIconButton
                              label="Move down"
                              disabled={index === lessons.length - 1 || reordering === lesson.id}
                              onClick={() => void moveLesson(lesson, 1)}
                            >
                              <ChevronIcon direction="down" />
                            </MiniIconButton>
                          </div>
                        ) : null}
                      </div>
                    </td>
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
                        <Badge>{titleCase(lesson.accessTier)}</Badge>
                        {lesson.requiresQuiz ? <Badge>Quiz gated</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lesson.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {lesson._count?.blocks ?? 0} blocks · {lesson._count?.quizzes ?? 0} quizzes ·{' '}
                      {lesson._count?.translations ?? 0} translations
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
        )}
      </Card>

      <Modal
        open={moduleFormOpen}
        onClose={() => setModuleFormOpen(false)}
        title="Edit module"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModuleFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="edit-module-form" loading={moduleSaving}>
              Save changes
            </Button>
          </>
        }
      >
        {moduleForm ? (
          <form id="edit-module-form" className="space-y-4" onSubmit={saveModule}>
            {moduleFormError ? <Alert variant="error">{moduleFormError}</Alert> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor="edit-module-title" required>
                <Input
                  id="edit-module-title"
                  value={moduleForm.title}
                  onChange={(event) => setModuleForm({ ...moduleForm, title: event.target.value })}
                  required
                />
              </Field>
              <Field label="Slug" htmlFor="edit-module-slug" required>
                <Input
                  id="edit-module-slug"
                  value={moduleForm.slug}
                  onChange={(event) => setModuleForm({ ...moduleForm, slug: event.target.value })}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                />
              </Field>
            </div>
            <Field label="Description" htmlFor="edit-module-description">
              <Textarea
                id="edit-module-description"
                value={moduleForm.description}
                onChange={(event) =>
                  setModuleForm({ ...moduleForm, description: event.target.value })
                }
              />
            </Field>
            <Field label="Estimated minutes" htmlFor="edit-module-minutes">
              <Input
                id="edit-module-minutes"
                type="number"
                min={1}
                value={moduleForm.estimatedMinutes}
                onChange={(event) =>
                  setModuleForm({ ...moduleForm, estimatedMinutes: event.target.value })
                }
              />
            </Field>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={lessonFormOpen}
        onClose={() => setLessonFormOpen(false)}
        title="Add lesson"
        description={`Create a lesson inside ${data.title}.`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLessonFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="new-lesson-form" loading={lessonSaving}>
              Create lesson
            </Button>
          </>
        }
      >
        <form id="new-lesson-form" className="space-y-4" onSubmit={createLesson}>
          {lessonFormError ? <Alert variant="error">{lessonFormError}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor="new-lesson-title" required>
              <Input
                id="new-lesson-title"
                value={lessonForm.title}
                onChange={(event) => setLessonForm({ ...lessonForm, title: event.target.value })}
                required
              />
            </Field>
            <Field label="Slug" htmlFor="new-lesson-slug" required>
              <Input
                id="new-lesson-slug"
                value={lessonForm.slug}
                onChange={(event) => setLessonForm({ ...lessonForm, slug: event.target.value })}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
            </Field>
          </div>
          <Field label="Summary" htmlFor="new-lesson-summary" required>
            <Input
              id="new-lesson-summary"
              value={lessonForm.summary}
              onChange={(event) => setLessonForm({ ...lessonForm, summary: event.target.value })}
              required
            />
          </Field>
          <Field label="Objective" htmlFor="new-lesson-objective" required>
            <Textarea
              id="new-lesson-objective"
              value={lessonForm.objective}
              onChange={(event) => setLessonForm({ ...lessonForm, objective: event.target.value })}
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Difficulty" htmlFor="new-lesson-difficulty">
              <Select
                id="new-lesson-difficulty"
                value={lessonForm.difficulty}
                onChange={(event) =>
                  setLessonForm({
                    ...lessonForm,
                    difficulty: event.target.value as ProficiencyLevel,
                  })
                }
              >
                {PROFICIENCY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {titleCase(level)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Access" htmlFor="new-lesson-access">
              <Select
                id="new-lesson-access"
                value={lessonForm.accessTier}
                onChange={(event) =>
                  setLessonForm({ ...lessonForm, accessTier: event.target.value as AccessTier })
                }
              >
                {ACCESS_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {titleCase(tier)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Estimated minutes" htmlFor="new-lesson-minutes">
              <Input
                id="new-lesson-minutes"
                type="number"
                min={1}
                max={600}
                value={lessonForm.estimatedMinutes}
                onChange={(event) =>
                  setLessonForm({ ...lessonForm, estimatedMinutes: event.target.value })
                }
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Primary language" htmlFor="new-lesson-language">
              <Select
                id="new-lesson-language"
                value={lessonForm.primaryLanguage}
                onChange={(event) =>
                  setLessonForm({
                    ...lessonForm,
                    primaryLanguage: event.target.value as ContentLanguage,
                  })
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
                description="Learners must pass a published quiz before this lesson is complete."
                checked={lessonForm.requiresQuiz}
                onChange={(event) =>
                  setLessonForm({ ...lessonForm, requiresQuiz: event.target.checked })
                }
                className="w-full"
              />
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
