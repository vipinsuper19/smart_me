'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { DeleteAction } from '@/components/actions';
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
  StatusBadge,
  Textarea,
} from '@/components/ui';
import { apiFetch, buildQuery, errorMessage } from '@/lib/api';
import { useAdminAuth } from '@/lib/auth';
import { formatDateTime, formatRelative, titleCase } from '@/lib/format';
import { useApi, useDebouncedValue } from '@/lib/hooks';
import { MEDIA_TYPES, type MediaAsset, type MediaType, type Paginated } from '@/lib/types';

interface MediaFormState {
  key: string;
  url: string;
  type: MediaType;
  mimeType: string;
  sizeBytes: string;
  width: string;
  height: string;
  durationSeconds: string;
  altText: string;
  checksum: string;
}

const emptyForm: MediaFormState = {
  key: '',
  url: '',
  type: 'IMAGE',
  mimeType: 'image/jpeg',
  sizeBytes: '0',
  width: '',
  height: '',
  durationSeconds: '',
  altText: '',
  checksum: '',
};

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function MediaLibraryPage() {
  const { canWriteContent } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MediaAsset | null>(null);
  const [form, setForm] = useState<MediaFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: detail } = useApi<MediaAsset>(selectedId ? `/admin/media/${selectedId}` : null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, type]);

  const query = buildQuery({ page, pageSize: 20, search: debouncedSearch, type });
  const { data, loading, error, reload } = useApi<Paginated<MediaAsset>>(`/admin/media${query}`);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(asset: MediaAsset) {
    setEditing(asset);
    setForm({
      key: asset.key,
      url: asset.url,
      type: asset.type,
      mimeType: asset.mimeType,
      sizeBytes: String(asset.sizeBytes),
      width: asset.width ? String(asset.width) : '',
      height: asset.height ? String(asset.height) : '',
      durationSeconds: asset.durationSeconds ? String(asset.durationSeconds) : '',
      altText: asset.altText ?? '',
      checksum: asset.checksum ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const body = {
        key: form.key.trim(),
        url: form.url.trim(),
        type: form.type,
        mimeType: form.mimeType.trim(),
        sizeBytes: Number(form.sizeBytes) || 0,
        width: form.width ? Number(form.width) : null,
        height: form.height ? Number(form.height) : null,
        durationSeconds: form.durationSeconds ? Number(form.durationSeconds) : null,
        altText: form.altText.trim() || null,
        checksum: form.checksum.trim() || null,
      };
      if (editing) {
        await apiFetch(`/admin/media/${editing.id}`, { method: 'PATCH', json: body });
      } else {
        await apiFetch('/admin/media', { method: 'POST', json: body });
      }
      setFormOpen(false);
      setEditing(null);
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
        title="Media library"
        description="Register media metadata and URLs. Binary upload is deferred; assets can be attached to lesson blocks."
        actions={
          canWriteContent ? (
            <Button onClick={openCreate}>Add media</Button>
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
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_auto]">
          <Input
            placeholder="Search key, URL or alt text…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search media"
          />
          <Select
            value={type}
            onChange={(event) => setType(event.target.value)}
            aria-label="Filter by media type"
          >
            <option value="">All media types</option>
            {MEDIA_TYPES.map((item) => (
              <option key={item} value={item}>
                {titleCase(item)}
              </option>
            ))}
          </Select>
          <span className="self-center text-sm text-slate-500">
            {data ? `${data.total} asset${data.total === 1 ? '' : 's'}` : 'Loading…'}
          </span>
        </div>

        {loading && !data ? (
          <PageLoading label="Loading media…" />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="No media assets found"
            description="Add the first asset, or adjust your filters."
            action={canWriteContent ? <Button onClick={openCreate}>Add media</Button> : undefined}
            className="m-4"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Asset</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Dimensions</th>
                    <th className="px-4 py-3">Used by</th>
                    <th className="px-4 py-3">Added</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((asset) => (
                    <tr key={asset.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedId(asset.id)}
                          className="text-left font-medium text-slate-900 hover:text-indigo-600"
                        >
                          {asset.key}
                        </button>
                        <p className="mt-0.5 max-w-md truncate text-xs text-slate-400">
                          {asset.url}
                        </p>
                        {asset.altText ? (
                          <p className="mt-0.5 max-w-md truncate text-xs text-slate-500">
                            {asset.altText}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Badge>{titleCase(asset.type)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {formatBytes(asset.sizeBytes)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {asset.width && asset.height ? `${asset.width}×${asset.height}` : '—'}
                        {asset.durationSeconds ? ` · ${asset.durationSeconds}s` : ''}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{asset._count?.blocks ?? 0}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatRelative(asset.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button variant="ghost" size="xs" onClick={() => setSelectedId(asset.id)}>
                            Details
                          </Button>
                          {canWriteContent ? (
                            <Button variant="ghost" size="xs" onClick={() => openEdit(asset)}>
                              Edit
                            </Button>
                          ) : null}
                          <DeleteAction
                            kind="media"
                            id={asset.id}
                            size="xs"
                            allowEditor
                            onDeleted={() => reload(true)}
                            onError={setActionError}
                          />
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
        title={editing ? 'Edit media asset' : 'Add media asset'}
        description="Store where the file lives; uploading the binary is handled outside this MVP panel."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="media-form" loading={saving}>
              {editing ? 'Save changes' : 'Add asset'}
            </Button>
          </>
        }
      >
        <form id="media-form" className="space-y-4" onSubmit={handleSubmit}>
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Key"
              htmlFor="media-key"
              hint="Letters, numbers, slashes, underscores, dots or hyphens."
              required
            >
              <Input
                id="media-key"
                value={form.key}
                onChange={(event) => setForm({ ...form, key: event.target.value })}
                placeholder="lessons/intro/cover.jpg"
                pattern="[A-Za-z0-9/_\-.]+"
                required
              />
            </Field>
            <Field label="Type" htmlFor="media-type">
              <Select
                id="media-type"
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value as MediaType })}
              >
                {MEDIA_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {titleCase(item)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="URL" htmlFor="media-url" required>
            <Input
              id="media-url"
              type="url"
              value={form.url}
              onChange={(event) => setForm({ ...form, url: event.target.value })}
              placeholder="https://cdn.example.com/file.jpg"
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="MIME type" htmlFor="media-mime" required>
              <Input
                id="media-mime"
                value={form.mimeType}
                onChange={(event) => setForm({ ...form, mimeType: event.target.value })}
                placeholder="image/jpeg"
                required
              />
            </Field>
            <Field label="Size in bytes" htmlFor="media-size" required>
              <Input
                id="media-size"
                type="number"
                min={0}
                value={form.sizeBytes}
                onChange={(event) => setForm({ ...form, sizeBytes: event.target.value })}
                required
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Width" htmlFor="media-width">
              <Input
                id="media-width"
                type="number"
                min={1}
                value={form.width}
                onChange={(event) => setForm({ ...form, width: event.target.value })}
              />
            </Field>
            <Field label="Height" htmlFor="media-height">
              <Input
                id="media-height"
                type="number"
                min={1}
                value={form.height}
                onChange={(event) => setForm({ ...form, height: event.target.value })}
              />
            </Field>
            <Field label="Duration (seconds)" htmlFor="media-duration">
              <Input
                id="media-duration"
                type="number"
                min={0}
                value={form.durationSeconds}
                onChange={(event) => setForm({ ...form, durationSeconds: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Alt text" htmlFor="media-alt" hint="Describe the media for accessibility.">
            <Textarea
              id="media-alt"
              value={form.altText}
              onChange={(event) => setForm({ ...form, altText: event.target.value })}
            />
          </Field>
          <Field
            label="Checksum"
            htmlFor="media-checksum"
            hint="Optional content hash for future upload verification."
          >
            <Input
              id="media-checksum"
              value={form.checksum}
              onChange={(event) => setForm({ ...form, checksum: event.target.value })}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title={detail?.key ?? 'Media asset'}
        description={detail ? `${titleCase(detail.type)} · ${detail.mimeType}` : 'Loading asset…'}
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setSelectedId(null)}>
            Close
          </Button>
        }
      >
        {detail ? (
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">URL</p>
              <a
                href={detail.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all text-indigo-600 hover:text-indigo-500"
              >
                {detail.url}
              </a>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">Size</dt>
                <dd className="mt-1 text-slate-700">{formatBytes(detail.sizeBytes)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  Dimensions
                </dt>
                <dd className="mt-1 text-slate-700">
                  {detail.width && detail.height ? `${detail.width}×${detail.height}` : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  Duration
                </dt>
                <dd className="mt-1 text-slate-700">
                  {detail.durationSeconds ? `${detail.durationSeconds}s` : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  Added
                </dt>
                <dd className="mt-1 text-slate-700">{formatDateTime(detail.createdAt)}</dd>
              </div>
            </dl>
            {detail.altText ? (
              <div>
                <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  Alt text
                </p>
                <p className="mt-1 text-slate-700">{detail.altText}</p>
              </div>
            ) : null}
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Referenced by
              </p>
              {detail.blocks && detail.blocks.length > 0 ? (
                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {detail.blocks.map((block) => (
                    <li
                      key={block.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <Link
                        href={`/content/lessons/${block.lesson.id}`}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                      >
                        {block.lesson.title}
                      </Link>
                      <StatusBadge status={block.lesson.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-slate-500">Not referenced by any lesson block.</p>
              )}
            </div>
          </div>
        ) : (
          <PageLoading label="Loading media details…" />
        )}
      </Modal>
    </>
  );
}
