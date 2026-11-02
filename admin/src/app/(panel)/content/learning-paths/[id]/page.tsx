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
  type LearningPath,
  type ProficiencyLevel,
} from '@/lib/types';

interface PathFormState {
  slug: string;
  title: string;
  description: string;
  coverImageUrl: string;
  iconUrl: string;
  availableLanguages: ContentLanguage[];
}

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

const emptyCourseForm: CourseFormState = {
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
};

export default function LearningPathDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const { canWriteContent } = useAdminAuth();
  const { data, loading, error, reload } = useApi<LearningPath>(
    id ? `/admin/learning-paths/${id}` : null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [pathFormOpen, setPathFormOpen] = useState(false);
  const [pathForm, setPathForm] = useState<PathFormState | null>(null);
  const [pathSaving, setPathSaving] = useState(false);
  const [pathFormError, setPathFormError] = useState<string | null>(null);
  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [courseForm, setCourseForm] = useState<CourseFormState>(emptyCourseForm);
  const [courseSaving, setCourseSaving] = useState(false);
  const [courseFormError, setCourseFormError] = useState<string | null>(null);
  const [reordering, setReordering] = useState<string | null>(null);

  function openPathForm() {
    if (!data) return;
    setPathForm({
      slug: data.slug,
      title: data.title,
      description: data.description,
      coverImageUrl: data.coverImageUrl ?? '',
      iconUrl: data.iconUrl ?? '',
      availableLanguages: data.availableLanguages,
    });
    setPathFormError(null);
    setPathFormOpen(true);
  }

  function togglePathLanguage(language: ContentLanguage) {
    setPathForm((current) => {
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

  async function savePath(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pathForm) return;
    setPathSaving(true);
    setPathFormError(null);
    try {
      await apiFetch(`/admin/learning-paths/${id}`, {
        method: 'PATCH',
        json: {
          slug: pathForm.slug.trim(),
          title: pathForm.title.trim(),
          description: pathForm.description.trim(),
          coverImageUrl: pathForm.coverImageUrl.trim() || null,
          iconUrl: pathForm.iconUrl.trim() || null,
          availableLanguages: pathForm.availableLanguages,
        },
      });
      setPathFormOpen(false);
      await reload(true);
    } catch (cause) {
      setPathFormError(errorMessage(cause));
    } finally {
      setPathSaving(false);
    }
  }

  function openCourseForm() {
    setCourseForm(emptyCourseForm);
    setCourseFormError(null);
    setCourseFormOpen(true);
  }

  function toggleCourseLanguage(language: ContentLanguage) {
    setCourseForm((current) => {
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

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCourseSaving(true);
    setCourseFormError(null);
    try {
      await apiFetch('/admin/courses', {
        method: 'POST',
        json: {
          learningPathId: id,
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

  async function moveCourse(course: Course, direction: -1 | 1) {
    if (!data?.courses) return;
    const ids = data.courses.map((item) => item.id);
    const index = ids.indexOf(course.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;

    setReordering(course.id);
    setActionError(null);
    try {
      [ids[index], ids[target]] = [ids[target], ids[index]];
      await apiFetch('/admin/courses/reorder', { method: 'POST', json: { ids } });
      await reload(true);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setReordering(null);
    }
  }

  if (loading && !data) {
    return <PageLoading label="Loading learning path…" />;
  }

  if (error || !data) {
    return (
      <>
        <PageHeader
          title="Learning path"
          back={
            <Link href="/content/learning-paths" className="text-indigo-600 hover:text-indigo-500">
              ← Learning paths
            </Link>
          }
        />
        <Alert variant="error">
          {error ?? 'This learning path could not be found.'}{' '}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => void reload()}>
            Retry
          </Button>
        </Alert>
      </>
    );
  }

  const courses = data.courses ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Learning path"
        title={data.title}
        description={data.description}
        back={
          <Link href="/content/learning-paths" className="text-indigo-600 hover:text-indigo-500">
            ← Learning paths
          </Link>
        }
        actions={
          <>
            {canWriteContent ? (
              <>
                <Button variant="secondary" size="sm" onClick={openPathForm}>
                  Edit path
                </Button>
                <StatusActions
                  kind="learning-paths"
                  id={data.id}
                  status={data.status}
                  onChanged={() => reload(true)}
                  onError={setActionError}
                />
              </>
            ) : null}
            <DeleteAction
              kind="learning-paths"
              id={data.id}
              onDeleted={() => router.push('/content/learning-paths')}
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
            <Badge>/{data.slug}</Badge>
            <Badge>{data.availableLanguages.map(titleCase).join(' · ')}</Badge>
          </div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Created
              </dt>
              <dd className="mt-1 text-slate-700">{formatDateTime(data.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Last updated
              </dt>
              <dd className="mt-1 text-slate-700">{formatDateTime(data.updatedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Published
              </dt>
              <dd className="mt-1 text-slate-700">{formatDateTime(data.publishedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Archived
              </dt>
              <dd className="mt-1 text-slate-700">{formatDateTime(data.archivedAt)}</dd>
            </div>
          </dl>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
            Catalogue footprint
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-2xl font-semibold text-slate-900">{courses.length}</p>
              <p className="text-xs text-slate-500">Courses</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-2xl font-semibold text-slate-900">
                {courses.reduce((sum, course) => sum + (course.lessonCount ?? 0), 0)}
              </p>
              <p className="text-xs text-slate-500">Lessons</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <SectionHeader
          title="Courses"
          description="Ordered courses inside this learning path."
          actions={
            canWriteContent ? (
              <Button size="sm" onClick={openCourseForm}>
                Add course
              </Button>
            ) : undefined
          }
          className="border-b border-slate-200 px-5 py-4"
        />
        {courses.length === 0 ? (
          <EmptyState
            title="No courses yet"
            description="Add the first course so learners have somewhere to begin."
            action={
              canWriteContent ? <Button onClick={openCourseForm}>Create course</Button> : undefined
            }
            className="m-5"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="w-16 px-4 py-3">Order</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Structure</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courses.map((course, index) => (
                  <tr key={course.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="w-5 text-xs text-slate-400">{course.order}</span>
                        {canWriteContent ? (
                          <div className="flex flex-col">
                            <MiniIconButton
                              label="Move up"
                              disabled={index === 0 || reordering === course.id}
                              onClick={() => void moveCourse(course, -1)}
                            >
                              <ChevronIcon direction="up" />
                            </MiniIconButton>
                            <MiniIconButton
                              label="Move down"
                              disabled={index === courses.length - 1 || reordering === course.id}
                              onClick={() => void moveCourse(course, 1)}
                            >
                              <ChevronIcon direction="down" />
                            </MiniIconButton>
                          </div>
                        ) : null}
                      </div>
                    </td>
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
                    <td className="px-4 py-3">
                      <StatusBadge status={course.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {course.moduleCount ?? course._count?.modules ?? 0} modules ·{' '}
                      {course.lessonCount ?? 0} lessons
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
        )}
      </Card>

      <Modal
        open={pathFormOpen}
        onClose={() => setPathFormOpen(false)}
        title="Edit learning path"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPathFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="path-detail-form" loading={pathSaving}>
              Save changes
            </Button>
          </>
        }
      >
        {pathForm ? (
          <form id="path-detail-form" className="space-y-4" onSubmit={savePath}>
            {pathFormError ? <Alert variant="error">{pathFormError}</Alert> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor="edit-path-title" required>
                <Input
                  id="edit-path-title"
                  value={pathForm.title}
                  onChange={(event) => setPathForm({ ...pathForm, title: event.target.value })}
                  required
                />
              </Field>
              <Field label="Slug" htmlFor="edit-path-slug" required>
                <Input
                  id="edit-path-slug"
                  value={pathForm.slug}
                  onChange={(event) => setPathForm({ ...pathForm, slug: event.target.value })}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                />
              </Field>
            </div>
            <Field label="Description" htmlFor="edit-path-description" required>
              <Textarea
                id="edit-path-description"
                value={pathForm.description}
                onChange={(event) => setPathForm({ ...pathForm, description: event.target.value })}
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cover image URL" htmlFor="edit-path-cover">
                <Input
                  id="edit-path-cover"
                  type="url"
                  value={pathForm.coverImageUrl}
                  onChange={(event) =>
                    setPathForm({ ...pathForm, coverImageUrl: event.target.value })
                  }
                />
              </Field>
              <Field label="Icon URL" htmlFor="edit-path-icon">
                <Input
                  id="edit-path-icon"
                  type="url"
                  value={pathForm.iconUrl}
                  onChange={(event) => setPathForm({ ...pathForm, iconUrl: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Available languages" required>
              <div className="grid gap-2 sm:grid-cols-3">
                {CONTENT_LANGUAGES.map((language) => (
                  <Checkbox
                    key={language}
                    label={titleCase(language)}
                    checked={pathForm.availableLanguages.includes(language)}
                    onChange={() => togglePathLanguage(language)}
                  />
                ))}
              </div>
            </Field>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={courseFormOpen}
        onClose={() => setCourseFormOpen(false)}
        title="Add course"
        description={`This course will belong to ${data.title}.`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCourseFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="course-form" loading={courseSaving}>
              Create course
            </Button>
          </>
        }
      >
        <form id="course-form" className="space-y-4" onSubmit={createCourse}>
          {courseFormError ? <Alert variant="error">{courseFormError}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor="course-title" required>
              <Input
                id="course-title"
                value={courseForm.title}
                onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })}
                placeholder="Speaking with clarity"
                required
              />
            </Field>
            <Field label="Slug" htmlFor="course-slug" required>
              <Input
                id="course-slug"
                value={courseForm.slug}
                onChange={(event) => setCourseForm({ ...courseForm, slug: event.target.value })}
                placeholder="speaking-with-clarity"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
            </Field>
          </div>
          <Field label="Short description" htmlFor="course-short" required>
            <Input
              id="course-short"
              value={courseForm.shortDescription}
              onChange={(event) =>
                setCourseForm({ ...courseForm, shortDescription: event.target.value })
              }
              placeholder="One sentence shown in course cards."
              required
            />
          </Field>
          <Field label="Long description" htmlFor="course-description">
            <Textarea
              id="course-description"
              value={courseForm.description}
              onChange={(event) =>
                setCourseForm({ ...courseForm, description: event.target.value })
              }
            />
          </Field>
          <Field label="Cover image URL" htmlFor="course-cover">
            <Input
              id="course-cover"
              type="url"
              value={courseForm.coverImageUrl}
              onChange={(event) =>
                setCourseForm({ ...courseForm, coverImageUrl: event.target.value })
              }
            />
          </Field>
          <Field label="Objectives" htmlFor="course-objectives" hint="One objective per line.">
            <Textarea
              id="course-objectives"
              value={courseForm.objectives}
              onChange={(event) => setCourseForm({ ...courseForm, objectives: event.target.value })}
              placeholder={'Speak clearly in meetings\nHandle difficult conversations'}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Difficulty" htmlFor="course-difficulty">
              <Select
                id="course-difficulty"
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
            <Field label="Access" htmlFor="course-access">
              <Select
                id="course-access"
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
            <Field label="Estimated minutes" htmlFor="course-minutes">
              <Input
                id="course-minutes"
                type="number"
                min={1}
                max={10_000}
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
                  onChange={() => toggleCourseLanguage(language)}
                />
              ))}
            </div>
          </Field>
        </form>
      </Modal>
    </>
  );
}
