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
  type Course,
  type CourseModule,
  type ProficiencyLevel,
} from '@/lib/types';

interface CourseFormState {
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

interface ModuleFormState {
  slug: string;
  title: string;
  description: string;
  estimatedMinutes: string;
}

const emptyModuleForm: ModuleFormState = {
  slug: '',
  title: '',
  description: '',
  estimatedMinutes: '',
};

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const { canWriteContent } = useAdminAuth();
  const { data, loading, error, reload } = useApi<Course>(id ? `/admin/courses/${id}` : null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [courseForm, setCourseForm] = useState<CourseFormState | null>(null);
  const [courseSaving, setCourseSaving] = useState(false);
  const [courseFormError, setCourseFormError] = useState<string | null>(null);
  const [moduleFormOpen, setModuleFormOpen] = useState(false);
  const [moduleForm, setModuleForm] = useState<ModuleFormState>(emptyModuleForm);
  const [moduleSaving, setModuleSaving] = useState(false);
  const [moduleFormError, setModuleFormError] = useState<string | null>(null);
  const [reordering, setReordering] = useState<string | null>(null);

  function openCourseForm() {
    if (!data) return;
    setCourseForm({
      slug: data.slug,
      title: data.title,
      shortDescription: data.shortDescription,
      description: data.description ?? '',
      coverImageUrl: data.coverImageUrl ?? '',
      objectives: data.objectives.join('\n'),
      difficulty: data.difficulty,
      estimatedMinutes: String(data.estimatedMinutes),
      accessTier: data.accessTier,
      availableLanguages: data.availableLanguages,
    });
    setCourseFormError(null);
    setCourseFormOpen(true);
  }

  function toggleLanguage(language: ContentLanguage) {
    setCourseForm((current) => {
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

  async function saveCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!courseForm) return;
    setCourseSaving(true);
    setCourseFormError(null);
    try {
      await apiFetch(`/admin/courses/${id}`, {
        method: 'PATCH',
        json: {
          slug: courseForm.slug.trim(),
          title: courseForm.title.trim(),
          shortDescription: courseForm.shortDescription.trim(),
          description: courseForm.description.trim() || null,
          coverImageUrl: courseForm.coverImageUrl.trim() || null,
          objectives: courseForm.objectives
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean),
          difficulty: courseForm.difficulty,
          estimatedMinutes: Number(courseForm.estimatedMinutes) || 10,
          accessTier: courseForm.accessTier,
          availableLanguages: courseForm.availableLanguages,
        },
      });
      setCourseFormOpen(false);
      await reload(true);
    } catch (cause) {
      setCourseFormError(errorMessage(cause));
    } finally {
      setCourseSaving(false);
    }
  }

  function openModuleForm() {
    setModuleForm(emptyModuleForm);
    setModuleFormError(null);
    setModuleFormOpen(true);
  }

  async function createModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setModuleSaving(true);
    setModuleFormError(null);
    try {
      await apiFetch('/admin/modules', {
        method: 'POST',
        json: {
          courseId: id,
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

  async function moveModule(module: CourseModule, direction: -1 | 1) {
    if (!data?.modules) return;
    const ids = data.modules.map((item) => item.id);
    const index = ids.indexOf(module.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;

    setReordering(module.id);
    setActionError(null);
    try {
      [ids[index], ids[target]] = [ids[target], ids[index]];
      await apiFetch('/admin/modules/reorder', { method: 'POST', json: { ids } });
      await reload(true);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setReordering(null);
    }
  }

  if (loading && !data) {
    return <PageLoading label="Loading course…" />;
  }

  if (error || !data) {
    return (
      <>
        <PageHeader
          title="Course"
          back={
            <Link href="/content/courses" className="text-indigo-600 hover:text-indigo-500">
              ← Courses
            </Link>
          }
        />
        <Alert variant="error">
          {error ?? 'This course could not be found.'}{' '}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => void reload()}>
            Retry
          </Button>
        </Alert>
      </>
    );
  }

  const modules = data.modules ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Course"
        title={data.title}
        description={data.shortDescription}
        back={
          <div className="flex flex-wrap items-center gap-2 text-indigo-600">
            <Link href="/content/learning-paths" className="hover:text-indigo-500">
              Learning paths
            </Link>
            <span className="text-slate-300">/</span>
            <Link
              href={`/content/learning-paths/${data.learningPathId}`}
              className="hover:text-indigo-500"
            >
              {data.learningPath?.title ?? 'Path'}
            </Link>
          </div>
        }
        actions={
          <>
            {canWriteContent ? (
              <>
                <Button variant="secondary" size="sm" onClick={openCourseForm}>
                  Edit course
                </Button>
                <StatusActions
                  kind="courses"
                  id={data.id}
                  status={data.status}
                  onChanged={() => reload(true)}
                  onError={setActionError}
                />
              </>
            ) : null}
            <DeleteAction
              kind="courses"
              id={data.id}
              onDeleted={() => router.push(`/content/learning-paths/${data.learningPathId}`)}
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

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} />
            <Badge>{titleCase(data.difficulty)}</Badge>
            <Badge>{titleCase(data.accessTier)}</Badge>
            <Badge>{data.estimatedMinutes} min</Badge>
            <Badge>{data.availableLanguages.map(titleCase).join(' · ')}</Badge>
          </div>
          {data.description ? (
            <p className="mt-4 text-sm leading-relaxed text-slate-600">{data.description}</p>
          ) : null}
          {data.objectives.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Objectives
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {data.objectives.map((objective) => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
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
          </dl>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Structure</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-2xl font-semibold text-slate-900">{modules.length}</p>
              <p className="text-xs text-slate-500">Modules</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-2xl font-semibold text-slate-900">
                {modules.reduce((sum, module) => sum + (module._count?.lessons ?? 0), 0)}
              </p>
              <p className="text-xs text-slate-500">Lessons</p>
            </div>
          </div>
          {data.prerequisites && data.prerequisites.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Prerequisites
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.prerequisites.map((item) => (
                  <Badge key={item.prerequisite.id}>{item.prerequisite.title}</Badge>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <SectionHeader
          title="Modules"
          description="Ordered modules that group lessons inside this course."
          actions={
            canWriteContent ? (
              <Button size="sm" onClick={openModuleForm}>
                Add module
              </Button>
            ) : undefined
          }
          className="border-b border-slate-200 px-5 py-4"
        />
        {modules.length === 0 ? (
          <EmptyState
            title="No modules yet"
            description="Create a module to start arranging lessons."
            action={
              canWriteContent ? <Button onClick={openModuleForm}>Create module</Button> : undefined
            }
            className="m-5"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="w-16 px-4 py-3">Order</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Lessons</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {modules.map((module, index) => (
                  <tr key={module.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="w-5 text-xs text-slate-400">{module.order}</span>
                        {canWriteContent ? (
                          <div className="flex flex-col">
                            <MiniIconButton
                              label="Move up"
                              disabled={index === 0 || reordering === module.id}
                              onClick={() => void moveModule(module, -1)}
                            >
                              <ChevronIcon direction="up" />
                            </MiniIconButton>
                            <MiniIconButton
                              label="Move down"
                              disabled={index === modules.length - 1 || reordering === module.id}
                              onClick={() => void moveModule(module, 1)}
                            >
                              <ChevronIcon direction="down" />
                            </MiniIconButton>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/content/modules/${module.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {module.title}
                      </Link>
                      {module.description ? (
                        <p className="mt-0.5 max-w-md truncate text-xs text-slate-400">
                          {module.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{module._count?.lessons ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatRelative(module.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <DeleteAction
                          kind="modules"
                          id={module.id}
                          label="Delete"
                          size="xs"
                          onDeleted={() => reload(true)}
                          onError={setActionError}
                        />
                        <Link
                          href={`/content/modules/${module.id}`}
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
        open={courseFormOpen}
        onClose={() => setCourseFormOpen(false)}
        title="Edit course"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCourseFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="edit-course-form" loading={courseSaving}>
              Save changes
            </Button>
          </>
        }
      >
        {courseForm ? (
          <form id="edit-course-form" className="space-y-4" onSubmit={saveCourse}>
            {courseFormError ? <Alert variant="error">{courseFormError}</Alert> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor="edit-course-title" required>
                <Input
                  id="edit-course-title"
                  value={courseForm.title}
                  onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })}
                  required
                />
              </Field>
              <Field label="Slug" htmlFor="edit-course-slug" required>
                <Input
                  id="edit-course-slug"
                  value={courseForm.slug}
                  onChange={(event) => setCourseForm({ ...courseForm, slug: event.target.value })}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                />
              </Field>
            </div>
            <Field label="Short description" htmlFor="edit-course-short" required>
              <Input
                id="edit-course-short"
                value={courseForm.shortDescription}
                onChange={(event) =>
                  setCourseForm({ ...courseForm, shortDescription: event.target.value })
                }
                required
              />
            </Field>
            <Field label="Long description" htmlFor="edit-course-description">
              <Textarea
                id="edit-course-description"
                value={courseForm.description}
                onChange={(event) =>
                  setCourseForm({ ...courseForm, description: event.target.value })
                }
              />
            </Field>
            <Field label="Cover image URL" htmlFor="edit-course-cover">
              <Input
                id="edit-course-cover"
                type="url"
                value={courseForm.coverImageUrl}
                onChange={(event) =>
                  setCourseForm({ ...courseForm, coverImageUrl: event.target.value })
                }
              />
            </Field>
            <Field
              label="Objectives"
              htmlFor="edit-course-objectives"
              hint="One objective per line."
            >
              <Textarea
                id="edit-course-objectives"
                value={courseForm.objectives}
                onChange={(event) =>
                  setCourseForm({ ...courseForm, objectives: event.target.value })
                }
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Difficulty" htmlFor="edit-course-difficulty">
                <Select
                  id="edit-course-difficulty"
                  value={courseForm.difficulty}
                  onChange={(event) =>
                    setCourseForm({
                      ...courseForm,
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
              <Field label="Access" htmlFor="edit-course-access">
                <Select
                  id="edit-course-access"
                  value={courseForm.accessTier}
                  onChange={(event) =>
                    setCourseForm({ ...courseForm, accessTier: event.target.value as AccessTier })
                  }
                >
                  {ACCESS_TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {titleCase(tier)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Estimated minutes" htmlFor="edit-course-minutes">
                <Input
                  id="edit-course-minutes"
                  type="number"
                  min={1}
                  value={courseForm.estimatedMinutes}
                  onChange={(event) =>
                    setCourseForm({ ...courseForm, estimatedMinutes: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Available languages" required>
              <div className="grid gap-2 sm:grid-cols-3">
                {CONTENT_LANGUAGES.map((language) => (
                  <Checkbox
                    key={language}
                    label={titleCase(language)}
                    checked={courseForm.availableLanguages.includes(language)}
                    onChange={() => toggleLanguage(language)}
                  />
                ))}
              </div>
            </Field>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={moduleFormOpen}
        onClose={() => setModuleFormOpen(false)}
        title="Add module"
        description={`Create a module inside ${data.title}.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModuleFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="module-form" loading={moduleSaving}>
              Create module
            </Button>
          </>
        }
      >
        <form id="module-form" className="space-y-4" onSubmit={createModule}>
          {moduleFormError ? <Alert variant="error">{moduleFormError}</Alert> : null}
          <Field label="Title" htmlFor="module-title" required>
            <Input
              id="module-title"
              value={moduleForm.title}
              onChange={(event) => setModuleForm({ ...moduleForm, title: event.target.value })}
              placeholder="Foundations"
              required
            />
          </Field>
          <Field label="Slug" htmlFor="module-slug" required>
            <Input
              id="module-slug"
              value={moduleForm.slug}
              onChange={(event) => setModuleForm({ ...moduleForm, slug: event.target.value })}
              placeholder="foundations"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
          </Field>
          <Field label="Description" htmlFor="module-description">
            <Textarea
              id="module-description"
              value={moduleForm.description}
              onChange={(event) =>
                setModuleForm({ ...moduleForm, description: event.target.value })
              }
            />
          </Field>
          <Field label="Estimated minutes" htmlFor="module-minutes">
            <Input
              id="module-minutes"
              type="number"
              min={1}
              value={moduleForm.estimatedMinutes}
              onChange={(event) =>
                setModuleForm({ ...moduleForm, estimatedMinutes: event.target.value })
              }
            />
          </Field>
        </form>
      </Modal>
    </>
  );
}
