'use client';

import { useState } from 'react';
import { apiFetch, errorMessage } from '@/lib/api';
import { useAdminAuth } from '@/lib/auth';
import type { PublicationStatus } from '@/lib/types';
import { Button } from './ui';

export type ContentKind = 'learning-paths' | 'courses' | 'modules' | 'lessons' | 'quizzes';

export function StatusActions({
  kind,
  id,
  status,
  onChanged,
  onError,
  compact = false,
}: {
  kind: ContentKind;
  id: string;
  status: PublicationStatus;
  onChanged: () => void | Promise<void>;
  onError?: (message: string) => void;
  compact?: boolean;
}) {
  const { canWriteContent, isSuperAdmin } = useAdminAuth();
  const [busy, setBusy] = useState<string | null>(null);

  if (!canWriteContent) {
    return null;
  }

  async function run(action: 'submit-review' | 'publish' | 'unpublish' | 'archive') {
    setBusy(action);
    try {
      await apiFetch(`/admin/${kind}/${id}/${action}`, { method: 'POST' });
      await onChanged();
    } catch (cause) {
      onError?.(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  const size = compact ? 'xs' : 'sm';

  return (
    <>
      {status === 'DRAFT' ? (
        <Button
          variant="secondary"
          size={size}
          loading={busy === 'submit-review'}
          disabled={Boolean(busy)}
          onClick={() => void run('submit-review')}
        >
          Submit review
        </Button>
      ) : null}
      {status !== 'PUBLISHED' ? (
        <Button
          variant="subtle"
          size={size}
          loading={busy === 'publish'}
          disabled={Boolean(busy)}
          onClick={() => void run('publish')}
        >
          Publish
        </Button>
      ) : null}
      {status === 'PUBLISHED' && isSuperAdmin ? (
        <>
          <Button
            variant="secondary"
            size={size}
            loading={busy === 'unpublish'}
            disabled={Boolean(busy)}
            onClick={() => void run('unpublish')}
          >
            Unpublish
          </Button>
          <Button
            variant="dangerGhost"
            size={size}
            loading={busy === 'archive'}
            disabled={Boolean(busy)}
            onClick={() => void run('archive')}
          >
            Archive
          </Button>
        </>
      ) : null}
    </>
  );
}

export function DeleteAction({
  kind,
  id,
  label = 'Delete',
  onDeleted,
  onError,
  allowEditor = false,
  size = 'sm',
}: {
  kind: ContentKind | 'media';
  id: string;
  label?: string;
  onDeleted: () => void | Promise<void>;
  onError?: (message: string) => void;
  allowEditor?: boolean;
  size?: 'xs' | 'sm' | 'md';
}) {
  const { isSuperAdmin, canWriteContent } = useAdminAuth();
  const [busy, setBusy] = useState(false);

  if (!isSuperAdmin && !(allowEditor && canWriteContent)) {
    return null;
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete this ${kind.replaceAll('-', ' ')} permanently? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/admin/${kind}/${id}`, { method: 'DELETE' });
      await onDeleted();
    } catch (cause) {
      onError?.(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="dangerGhost" size={size} loading={busy} onClick={() => void handleDelete()}>
      {label}
    </Button>
  );
}
