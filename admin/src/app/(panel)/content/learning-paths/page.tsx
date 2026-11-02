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
  ChevronIcon,
  EmptyState,
  Field,
  Input,
  MiniIconButton,
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
  CONTENT_LANGUAGES,
  PUBLICATION_STATUSES,
  type ContentLanguage,
  type LearningPath,
  type Paginated,
} from '@/lib/types';

interface PathFormState {
  slug: string;
  title: string;
  description: string;
  coverImageUrl: string;
  iconUrl: string;
  availableLanguages: ContentLanguage[];
}

const emptyForm: PathFormState = {
  slug: '',
  title: '',
  description: '',
  coverImageUrl: '',
  iconUrl: '',
  availableLanguages: ['ENGLISH'],
};

export default function LearningPathsPage() {
  const { canWriteContent } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LearningPath | null>(null);
  const [form, setForm] = useState<PathFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reordering, setReordering] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1' && canWriteContent) {
      setForm(emptyForm);
      setEditing(null);
      setFormOpen(true);
    }
  }, [canWriteContent]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  const query = buildQuery({ page, pageSize: 20, search: debouncedSearch, status });
  const { data, loading, error, reload } = useApi<Paginated<LearningPath>>(
    `/admin/learning-paths${query}`,
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(path: LearningPath) {
    setEditing(path);
    setForm({
      slug: path.slug,
      title: path.title,
      description: path.description,
      coverImageUrl: path.coverImageUrl ?? '',
      iconUrl: path.iconUrl ?? '',
      availableLanguages: path.availableLanguages,
    });
    setFormError(null);
    setFormOpen(true);
  }

  function toggleLanguage(language: ContentLanguage) {
    setForm((current) => {
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
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        slug: form.slug.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        coverImageUrl: form.coverImageUrl.trim() || null,
        iconUrl: form.iconUrl.trim() || null,
        availableLanguages: form.availableLanguages,
      };
      if (editing) {
        await apiFetch(`/admin/learning-paths/${editing.id}`, {
          method: 'PATCH',
          json: payload,
        });
      } else {
        await apiFetch('/admin/learning-paths', { method: 'POST', json: payload });
      }
      setFormOpen(false);
      await reload(true);
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function move(path: LearningPath, direction: -1 | 1) {
    setReordering(path.id);
    setActionError(null);
    try {
      const all = await apiFetch<Paginated<LearningPath>>(
        '/admin/learning-paths?page=1&pageSize=100',
      );
      if (all.total > 100) {
        throw new Error('Reordering is limited to the first 100 paths in this MVP.');
      }
      const ids = all.items.map((item) => item.id);
      const index = ids.indexOf(path.id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= ids.length) {
        return;
      }
      [ids[index], ids[target]] = [ids[target], ids[index]];
      await apiFetch('/admin/learning-paths/reorder', { method: 'POST', json: { ids } });
      await reload(true);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setReordering(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Learning paths"
        description="Top-level journeys that group courses around a learner goal."
        actions={
          canWriteContent ? (
            <Button onClick={openCreate}>New learning path</Button>
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
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <Input
              placeholder="Search by title or slug…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search learning paths"
            />
          </div>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by status"
            className="sm:w-44"
          >
            <option value="">All statuses</option>
            {PUBLICATION_STATUSES.map((item) => (
              <option key={item} value={item}>
                {titleCase(item)}
              </option>
            ))}
          </Select>
          <span className="text-sm text-slate-500">
            {data ? `${data.total} path${data.total === 1 ? '' : 's'}` : 'Loading…'}
          </span>
        </div>

        {loading && !data ? (
          <PageLoading label="Loading learning paths…" />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="No learning paths found"
            description={
              search || status
                ? 'Try clearing the filters or searching for a different title.'
                : 'Create the first learning path to start building the catalogue.'
            }
            action={
              canWriteContent ? (
                <Button onClick={openCreate}>Create learning path</Button>
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
                    <th className="w-16 px-4 py-3">Order</th>
                    <th className="px-4 py-3">Path</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Courses</th>
                    <th className="px-4 py-3">Languages</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.items.map((path, index) => (
                    <tr key={path.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="w-5 text-xs text-slate-400">{path.order}</span>
                          {canWriteContent ? (
                            <div className="flex flex-col">
                              <MiniIconButton
                                label="Move up"
                                disabled={index === 0 || reordering === path.id}
                                onClick={() => void move(path, -1)}
                              >
                                <ChevronIcon direction="up" />
                              </MiniIconButton>
                              <MiniIconButton
                                label="Move down"
                                disabled={index === data.items.length - 1 || reordering === path.id}
                                onClick={() => void move(path, 1)}
                              >
                                <ChevronIcon direction="down" />
                              </MiniIconButton>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/content/learning-paths/${path.id}`}
                          className="font-medium text-slate-900 hover:text-indigo-600"
                        >
                          {path.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-400">/{path.slug}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={path.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{path._count?.courses ?? 0}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {path.availableLanguages.map(titleCase).join(', ')}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatRelative(path.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {canWriteContent ? (
                            <>
                              <Button variant="ghost" size="xs" onClick={() => openEdit(path)}>
                                Edit
                              </Button>
                              <StatusActions
                                kind="learning-paths"
                                id={path.id}
                                status={path.status}
                                compact
                                onChanged={() => reload(true)}
                                onError={setActionError}
                              />
                            </>
                          ) : null}
                          <Link
                            href={`/content/learning-paths/${path.id}`}
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
        title={editing ? 'Edit learning path' : 'New learning path'}
        description="Paths are the top level of the content hierarchy."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="path-form" loading={saving}>
              {editing ? 'Save changes' : 'Create path'}
            </Button>
          </>
        }
      >
        <form id="path-form" className="space-y-4" onSubmit={handleSubmit}>
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor="path-title" required>
              <Input
                id="path-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Build confidence"
                required
              />
            </Field>
            <Field
              label="Slug"
              htmlFor="path-slug"
              hint="Lowercase letters, numbers and single hyphens."
              required
            >
              <Input
                id="path-slug"
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
                placeholder="build-confidence"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
            </Field>
          </div>
          <Field label="Description" htmlFor="path-description" required>
            <Textarea
              id="path-description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="What will a learner gain from this path?"
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cover image URL" htmlFor="path-cover">
              <Input
                id="path-cover"
                type="url"
                value={form.coverImageUrl}
                onChange={(event) => setForm({ ...form, coverImageUrl: event.target.value })}
                placeholder="https://cdn.example.com/cover.jpg"
              />
            </Field>
            <Field label="Icon URL" htmlFor="path-icon">
              <Input
                id="path-icon"
                type="url"
                value={form.iconUrl}
                onChange={(event) => setForm({ ...form, iconUrl: event.target.value })}
                placeholder="https://cdn.example.com/icon.svg"
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
      </Modal>
    </>
  );
}
