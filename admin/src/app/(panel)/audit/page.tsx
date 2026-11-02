'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  JsonBlock,
  Modal,
  PageHeader,
  PageLoading,
  Pagination,
} from '@/components/ui';
import { buildQuery } from '@/lib/api';
import { actionLabel, formatDateTime, formatRelative, titleCase } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { AuditLog, Paginated } from '@/lib/types';

interface AuditFilters {
  entityType: string;
  action: string;
  adminUserId: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: AuditFilters = {
  entityType: '',
  action: '',
  adminUserId: '',
  from: '',
  to: '',
};

function toIsoStart(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;
}

function toIsoEnd(value: string): string | undefined {
  return value ? new Date(`${value}T23:59:59.999Z`).toISOString() : undefined;
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<AuditFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<AuditFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const query = useMemo(
    () =>
      buildQuery({
        page,
        pageSize: 25,
        entityType: applied.entityType,
        action: applied.action,
        adminUserId: applied.adminUserId,
        from: toIsoStart(applied.from),
        to: toIsoEnd(applied.to),
      }),
    [applied, page],
  );

  const { data, loading, error, reload } = useApi<Paginated<AuditLog>>(`/admin/audit-logs${query}`);

  const activeFilters =
    applied.entityType || applied.action || applied.adminUserId || applied.from || applied.to;

  function applyFilters() {
    setPage(1);
    setApplied(draft);
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  }

  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Audit log"
        description="Append-only record of administrative changes and admin sign-ins."
        actions={
          <>
            {activeFilters ? <Badge>Filtered</Badge> : null}
            <Button variant="secondary" size="sm" onClick={() => void reload()}>
              Refresh
            </Button>
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

      <Card className="mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="Entity type" htmlFor="audit-entity-type">
            <Input
              id="audit-entity-type"
              placeholder="LESSON"
              value={draft.entityType}
              onChange={(event) =>
                setDraft({ ...draft, entityType: event.target.value.toUpperCase() })
              }
            />
          </Field>
          <Field label="Action" htmlFor="audit-action">
            <Input
              id="audit-action"
              placeholder="LESSON_PUBLISHED"
              value={draft.action}
              onChange={(event) => setDraft({ ...draft, action: event.target.value.toUpperCase() })}
            />
          </Field>
          <Field label="Admin user ID" htmlFor="audit-admin">
            <Input
              id="audit-admin"
              placeholder="Admin user UUID"
              value={draft.adminUserId}
              onChange={(event) => setDraft({ ...draft, adminUserId: event.target.value.trim() })}
            />
          </Field>
          <Field label="From" htmlFor="audit-from">
            <Input
              id="audit-from"
              type="date"
              value={draft.from}
              onChange={(event) => setDraft({ ...draft, from: event.target.value })}
            />
          </Field>
          <Field label="To" htmlFor="audit-to">
            <Input
              id="audit-to"
              type="date"
              value={draft.to}
              onChange={(event) => setDraft({ ...draft, to: event.target.value })}
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={clearFilters}
            disabled={
              !draft.entityType &&
              !draft.action &&
              !draft.adminUserId &&
              !draft.from &&
              !draft.to &&
              !activeFilters
            }
          >
            Clear
          </Button>
          <Button size="sm" onClick={applyFilters}>
            Apply filters
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading && !data ? (
          <PageLoading label="Loading audit log…" />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="No audit entries found"
            description="Adjust the filters, or perform an admin action to generate an entry."
            className="m-4"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">IP address</th>
                    <th className="px-4 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <p className="font-medium text-slate-800">
                          {formatRelative(entry.createdAt)}
                        </p>
                        <p className="text-slate-400">{formatDateTime(entry.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        {entry.admin ? (
                          <>
                            <p className="font-medium text-slate-800">{entry.admin.name}</p>
                            <p className="max-w-xs truncate text-xs text-slate-500">
                              {entry.admin.email}
                            </p>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">System / deleted admin</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            entry.action.includes('DELETED')
                              ? 'bg-rose-50 text-rose-700 ring-rose-600/20'
                              : entry.action.includes('PUBLISHED')
                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                                : undefined
                          }
                        >
                          {actionLabel(entry.action)}
                        </Badge>
                        <p className="mt-1 font-mono text-[11px] text-slate-400">{entry.action}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700">{titleCase(entry.entityType)}</p>
                        {entry.entityId ? (
                          <p className="mt-0.5 max-w-[12rem] truncate font-mono text-[11px] text-slate-400">
                            {entry.entityId}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {entry.ipAddress ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="xs" onClick={() => setSelected(entry)}>
                          View
                        </Button>
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
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? actionLabel(selected.action) : 'Audit entry'}
        description={
          selected
            ? `${titleCase(selected.entityType)} · ${formatDateTime(selected.createdAt)}`
            : undefined
        }
        size="xl"
        footer={
          <Button variant="secondary" onClick={() => setSelected(null)}>
            Close
          </Button>
        }
      >
        {selected ? (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  Actor
                </dt>
                <dd className="mt-1 text-slate-700">
                  {selected.admin ? `${selected.admin.name} (${selected.admin.email})` : 'System'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  Action
                </dt>
                <dd className="mt-1 font-mono text-xs text-slate-700">{selected.action}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  Entity type
                </dt>
                <dd className="mt-1 text-slate-700">{titleCase(selected.entityType)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  Entity ID
                </dt>
                <dd className="mt-1 break-all font-mono text-xs text-slate-700">
                  {selected.entityId ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  IP address
                </dt>
                <dd className="mt-1 font-mono text-xs text-slate-700">
                  {selected.ipAddress ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  User agent
                </dt>
                <dd className="mt-1 break-all text-xs text-slate-700">
                  {selected.userAgent ?? '—'}
                </dd>
              </div>
            </dl>

            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-slate-400 uppercase">
                Before
              </p>
              <JsonBlock value={selected.before} />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-slate-400 uppercase">
                After
              </p>
              <JsonBlock value={selected.after} />
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
