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
  CONTENT_BLOCK_TYPES,
  CONTENT_LANGUAGES,
  PROFICIENCY_LEVELS,
  type AccessTier,
  type ContentBlockType,
  type ContentLanguage,
  type Lesson,
  type LessonBlock,
  type LessonTranslation,
  type MediaAsset,
  type Paginated,
  type ProficiencyLevel,
  type Quiz,
} from '@/lib/types';

type TabKey = 'blocks' | 'translations' | 'quizzes';

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

interface BlockLineForm {
  speaker: string;
  text: string;
}

interface BlockFormState {
  type: ContentBlockType;
  text: string;
  items: string;
  title: string;
  language: string;
  url: string;
  mediaAssetId: string;
  caption: string;
  lines: BlockLineForm[];
  json: string;
  message: string;
}

interface TranslationFormState {
  language: ContentLanguage;
  title: string;
  summary: string;
  objective: string;
  contentJson: string;
}

interface QuizFormState {
  title: string;
  description: string;
  passingScore: string;
  xpReward: string;
  timeLimitSeconds: string;
}

const emptyBlockForm: BlockFormState = {
  type: 'PARAGRAPH',
  text: '',
  items: '',
  title: '',
  language: '',
  url: '',
  mediaAssetId: '',
  caption: '',
  lines: [{ speaker: '', text: '' }],
  json: '{\n  "prompt": ""\n}',
  message: '',
};

const emptyQuizForm: QuizFormState = {
  title: '',
  description: '',
  passingScore: '70',
  xpReward: '20',
  timeLimitSeconds: '',
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isMediaBlock(type: ContentBlockType): boolean {
  return type === 'IMAGE' || type === 'AUDIO' || type === 'VIDEO';
}

function blockFormFrom(block: LessonBlock): BlockFormState {
  const payload = asRecord(block.payload);
  return {
    type: block.type,
    text: typeof payload.text === 'string' ? payload.text : '',
    items: Array.isArray(payload.items)
      ? payload.items.filter((item) => typeof item === 'string').join('\n')
      : '',
    title: typeof payload.title === 'string' ? payload.title : '',
    language: typeof payload.language === 'string' ? payload.language : '',
    url: typeof payload.url === 'string' ? payload.url : '',
    mediaAssetId: block.mediaAssetId ?? '',
    caption: block.caption ?? '',
    lines:
      Array.isArray(payload.lines) && payload.lines.length > 0
        ? payload.lines.map((line) => {
            const record = asRecord(line);
            return {
              speaker: typeof record.speaker === 'string' ? record.speaker : '',
              text: typeof record.text === 'string' ? record.text : '',
            };
          })
        : [{ speaker: '', text: '' }],
    json: JSON.stringify(payload, null, 2),
    message: typeof payload.message === 'string' ? payload.message : '',
  };
}

function buildBlockPayload(form: BlockFormState): Record<string, unknown> {
  switch (form.type) {
    case 'HEADING':
    case 'PARAGRAPH':
      return { text: form.text.trim() };
    case 'BULLET_LIST':
    case 'RECAP':
      return {
        items: form.items
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
      };
    case 'CALLOUT':
      return {
        title: form.title.trim(),
        text: form.text.trim(),
        ...(form.language ? { language: form.language } : {}),
      };
    case 'IMAGE':
    case 'AUDIO':
    case 'VIDEO':
      return form.url.trim() ? { url: form.url.trim() } : {};
    case 'EXAMPLE_CONVERSATION':
      return {
        lines: form.lines
          .map((line) => ({ speaker: line.speaker.trim(), text: line.text.trim() }))
          .filter((line) => line.speaker || line.text),
      };
    case 'MULTIPLE_CHOICE':
    case 'TRUE_FALSE': {
      let parsed: unknown;
      try {
        parsed = JSON.parse(form.json || '{}');
      } catch {
        throw new Error('The JSON payload is not valid JSON.');
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('The JSON payload must be an object.');
      }
      return parsed as Record<string, unknown>;
    }
    case 'COMPLETION':
      return form.message.trim() ? { message: form.message.trim() } : {};
    default:
      return {};
  }
}

function BlockPreview({ block, compact = false }: { block: LessonBlock; compact?: boolean }) {
  const payload = asRecord(block.payload);
  const textClassName = compact ? 'text-sm' : 'text-[15px]';

  switch (block.type) {
    case 'HEADING':
      return (
        <h3 className={compact ? 'text-base font-semibold' : 'text-xl font-semibold'}>
          {String(payload.text ?? '')}
        </h3>
      );
    case 'PARAGRAPH':
      return (
        <p className={`${textClassName} leading-relaxed text-slate-700`}>
          {String(payload.text ?? '')}
        </p>
      );
    case 'BULLET_LIST':
    case 'RECAP': {
      const items = Array.isArray(payload.items) ? payload.items : [];
      return (
        <ul className={`list-disc space-y-1 pl-5 ${textClassName} text-slate-700`}>
          {items.map((item, index) => (
            <li key={`${String(item)}-${index}`}>{String(item)}</li>
          ))}
        </ul>
      );
    }
    case 'CALLOUT':
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-amber-900">{String(payload.title ?? '')}</p>
            {payload.language ? (
              <Badge tone="bg-amber-100 text-amber-800 ring-amber-600/20">
                {String(payload.language)}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-amber-800">
            {String(payload.text ?? '')}
          </p>
        </div>
      );
    case 'IMAGE': {
      const url = typeof payload.url === 'string' ? payload.url : block.mediaAsset?.url;
      return (
        <figure>
          {url ? (
            <img
              src={url}
              alt={block.caption ?? block.mediaAsset?.altText ?? ''}
              className="max-h-72 w-full rounded-xl object-contain"
            />
          ) : (
            <p className="text-sm text-slate-500">No image URL configured.</p>
          )}
          {block.caption ? (
            <figcaption className="mt-2 text-xs text-slate-500">{block.caption}</figcaption>
          ) : null}
        </figure>
      );
    }
    case 'AUDIO': {
      const url = typeof payload.url === 'string' ? payload.url : block.mediaAsset?.url;
      return (
        <div>
          {url ? (
            <audio controls src={url} className="w-full" />
          ) : (
            <p className="text-sm text-slate-500">No audio URL configured.</p>
          )}
          {block.caption ? <p className="mt-2 text-xs text-slate-500">{block.caption}</p> : null}
        </div>
      );
    }
    case 'VIDEO': {
      const url = typeof payload.url === 'string' ? payload.url : block.mediaAsset?.url;
      return (
        <div>
          {url ? (
            <video controls src={url} className="max-h-72 w-full rounded-xl" />
          ) : (
            <p className="text-sm text-slate-500">No video URL configured.</p>
          )}
          {block.caption ? <p className="mt-2 text-xs text-slate-500">{block.caption}</p> : null}
        </div>
      );
    }
    case 'EXAMPLE_CONVERSATION': {
      const lines = Array.isArray(payload.lines) ? payload.lines : [];
      return (
        <div className="space-y-2">
          {lines.map((line, index) => {
            const record = asRecord(line);
            return (
              <div key={index} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {String(record.speaker ?? '')}
                </p>
                <p className="text-sm text-slate-700">{String(record.text ?? '')}</p>
              </div>
            );
          })}
        </div>
      );
    }
    case 'MULTIPLE_CHOICE':
    case 'TRUE_FALSE':
      return (
        <pre className="overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-relaxed text-slate-100">
          {JSON.stringify(payload, null, 2)}
        </pre>
      );
    case 'COMPLETION':
      return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Lesson complete</p>
          <p className="mt-1 text-sm text-emerald-800">
            {typeof payload.message === 'string' && payload.message
              ? payload.message
              : 'Great work — keep the momentum going.'}
          </p>
        </div>
      );
    default:
      return <pre className="text-xs">{JSON.stringify(payload, null, 2)}</pre>;
  }
}

export default function LessonDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const { canWriteContent, isSuperAdmin } = useAdminAuth();
  const { data, loading, error, reload } = useApi<Lesson>(id ? `/admin/lessons/${id}` : null);
  const [tab, setTab] = useState<TabKey>('blocks');
  const [actionError, setActionError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [lessonFormOpen, setLessonFormOpen] = useState(false);
  const [lessonForm, setLessonForm] = useState<LessonFormState | null>(null);
  const [lessonSaving, setLessonSaving] = useState(false);
  const [lessonFormError, setLessonFormError] = useState<string | null>(null);

  const [blockForm, setBlockForm] = useState<BlockFormState | null>(null);
  const [editingBlock, setEditingBlock] = useState<LessonBlock | null>(null);
  const [blockSaving, setBlockSaving] = useState(false);
  const [blockFormError, setBlockFormError] = useState<string | null>(null);
  const [reorderingBlock, setReorderingBlock] = useState<string | null>(null);

  const [translationForm, setTranslationForm] = useState<TranslationFormState | null>(null);
  const [translationSaving, setTranslationSaving] = useState(false);
  const [translationFormError, setTranslationFormError] = useState<string | null>(null);

  const [quizForm, setQuizForm] = useState<QuizFormState | null>(null);
  const [quizSaving, setQuizSaving] = useState(false);
  const [quizFormError, setQuizFormError] = useState<string | null>(null);
  const [cloningQuiz, setCloningQuiz] = useState<string | null>(null);

  const { data: mediaAssets } = useApi<Paginated<MediaAsset>>(
    blockForm && isMediaBlock(blockForm.type) ? '/admin/media?page=1&pageSize=100' : null,
  );

  function openLessonForm() {
    if (!data) return;
    setLessonForm({
      slug: data.slug,
      title: data.title,
      summary: data.summary,
      objective: data.objective,
      difficulty: data.difficulty,
      estimatedMinutes: String(data.estimatedMinutes),
      accessTier: data.accessTier,
      primaryLanguage: data.primaryLanguage,
      requiresQuiz: data.requiresQuiz,
    });
    setLessonFormError(null);
    setLessonFormOpen(true);
  }

  async function saveLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lessonForm) return;
    setLessonSaving(true);
    setLessonFormError(null);
    try {
      await apiFetch(`/admin/lessons/${id}`, {
        method: 'PATCH',
        json: {
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

  function openCreateBlock() {
    setEditingBlock(null);
    setBlockForm({ ...emptyBlockForm, lines: [{ speaker: '', text: '' }] });
    setBlockFormError(null);
  }

  function openEditBlock(block: LessonBlock) {
    setEditingBlock(block);
    setBlockForm(blockFormFrom(block));
    setBlockFormError(null);
  }

  function updateBlockForm(patch: Partial<BlockFormState>) {
    setBlockForm((current) => (current ? { ...current, ...patch } : current));
  }

  function updateBlockLine(index: number, patch: Partial<BlockLineForm>) {
    setBlockForm((current) => {
      if (!current) return current;
      return {
        ...current,
        lines: current.lines.map((line, lineIndex) =>
          lineIndex === index ? { ...line, ...patch } : line,
        ),
      };
    });
  }

  async function saveBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!blockForm) return;
    setBlockSaving(true);
    setBlockFormError(null);
    try {
      const payload = buildBlockPayload(blockForm);
      if (isMediaBlock(blockForm.type) && !blockForm.mediaAssetId && !blockForm.url.trim()) {
        throw new Error('Select a media asset or provide an external URL.');
      }
      const body = {
        type: blockForm.type,
        payload,
        mediaAssetId: blockForm.mediaAssetId || null,
        caption: blockForm.caption.trim() || null,
      };
      if (editingBlock) {
        await apiFetch(`/admin/blocks/${editingBlock.id}`, { method: 'PATCH', json: body });
      } else {
        await apiFetch(`/admin/lessons/${id}/blocks`, { method: 'POST', json: body });
      }
      setBlockForm(null);
      setEditingBlock(null);
      await reload(true);
    } catch (cause) {
      setBlockFormError(errorMessage(cause));
    } finally {
      setBlockSaving(false);
    }
  }

  async function moveBlock(block: LessonBlock, direction: -1 | 1) {
    if (!data) return;
    const ids = data.blocks.map((item) => item.id);
    const index = ids.indexOf(block.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;

    setReorderingBlock(block.id);
    setActionError(null);
    try {
      [ids[index], ids[target]] = [ids[target], ids[index]];
      await apiFetch(`/admin/lessons/${id}/blocks/reorder`, { method: 'POST', json: { ids } });
      await reload(true);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setReorderingBlock(null);
    }
  }

  async function deleteBlock(block: LessonBlock) {
    if (!window.confirm('Delete this content block? This cannot be undone.')) return;
    setActionError(null);
    try {
      await apiFetch(`/admin/blocks/${block.id}`, { method: 'DELETE' });
      await reload(true);
    } catch (cause) {
      setActionError(errorMessage(cause));
    }
  }

  function openTranslationForm(translation?: LessonTranslation) {
    if (!data) return;
    const used = new Set(data.translations.map((item) => item.language));
    const fallback = CONTENT_LANGUAGES.find((language) => !used.has(language)) ?? 'ENGLISH';
    setTranslationForm({
      language: translation?.language ?? fallback,
      title: translation?.title ?? '',
      summary: translation?.summary ?? '',
      objective: translation?.objective ?? '',
      contentJson: translation?.content ? JSON.stringify(translation.content, null, 2) : '',
    });
    setTranslationFormError(null);
  }

  async function saveTranslation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!translationForm) return;
    setTranslationSaving(true);
    setTranslationFormError(null);
    try {
      let content: unknown;
      if (translationForm.contentJson.trim()) {
        try {
          content = JSON.parse(translationForm.contentJson);
        } catch {
          throw new Error('Translation content is not valid JSON.');
        }
        if (!content || typeof content !== 'object' || Array.isArray(content)) {
          throw new Error('Translation content must be a JSON object.');
        }
      }

      await apiFetch(`/admin/lessons/${id}/translations/${translationForm.language}`, {
        method: 'POST',
        json: {
          title: translationForm.title.trim(),
          summary: translationForm.summary.trim(),
          objective: translationForm.objective.trim(),
          ...(content !== undefined ? { content } : {}),
        },
      });
      setTranslationForm(null);
      await reload(true);
    } catch (cause) {
      setTranslationFormError(errorMessage(cause));
    } finally {
      setTranslationSaving(false);
    }
  }

  async function deleteTranslation(translation: LessonTranslation) {
    if (!window.confirm(`Delete the ${titleCase(translation.language)} translation?`)) return;
    setActionError(null);
    try {
      await apiFetch(`/admin/lessons/${id}/translations/${translation.language}`, {
        method: 'DELETE',
      });
      await reload(true);
    } catch (cause) {
      setActionError(errorMessage(cause));
    }
  }

  function openQuizForm() {
    if (!data) return;
    setQuizForm({
      ...emptyQuizForm,
      title: `${data.title} knowledge check`,
      description: `Check your understanding of ${data.title}.`,
    });
    setQuizFormError(null);
  }

  async function createQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quizForm) return;
    setQuizSaving(true);
    setQuizFormError(null);
    try {
      await apiFetch('/admin/quizzes', {
        method: 'POST',
        json: {
          lessonId: id,
          title: quizForm.title.trim(),
          description: quizForm.description.trim() || null,
          passingScore: Number(quizForm.passingScore) || 70,
          xpReward: Number(quizForm.xpReward) || 0,
          timeLimitSeconds: quizForm.timeLimitSeconds ? Number(quizForm.timeLimitSeconds) : null,
        },
      });
      setQuizForm(null);
      await reload(true);
    } catch (cause) {
      setQuizFormError(errorMessage(cause));
    } finally {
      setQuizSaving(false);
    }
  }

  async function cloneQuiz(quiz: Quiz) {
    setCloningQuiz(quiz.id);
    setActionError(null);
    try {
      await apiFetch(`/admin/quizzes/${quiz.id}/versions`, { method: 'POST', json: {} });
      await reload(true);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setCloningQuiz(null);
    }
  }

  if (loading && !data) {
    return <PageLoading label="Loading lesson…" />;
  }

  if (error || !data) {
    return (
      <>
        <PageHeader
          title="Lesson"
          back={
            <Link href="/content/lessons" className="text-indigo-600 hover:text-indigo-500">
              ← Lessons
            </Link>
          }
        />
        <Alert variant="error">
          {error ?? 'This lesson could not be found.'}{' '}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => void reload()}>
            Retry
          </Button>
        </Alert>
      </>
    );
  }

  const blocks = data.blocks ?? [];
  const translations = data.translations ?? [];
  const quizzes = data.quizzes ?? [];
  const placement = data.module?.course?.learningPath;
  const mediaForType =
    blockForm && isMediaBlock(blockForm.type)
      ? (mediaAssets?.items ?? []).filter((asset) => asset.type === blockForm.type)
      : [];

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'blocks', label: 'Content blocks', count: blocks.length },
    { key: 'translations', label: 'Translations', count: translations.length },
    { key: 'quizzes', label: 'Quizzes', count: quizzes.length },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Lesson"
        title={data.title}
        description={data.summary}
        back={
          <div className="flex flex-wrap items-center gap-2 text-indigo-600">
            <Link href="/content/lessons" className="hover:text-indigo-500">
              Lessons
            </Link>
            {placement ? (
              <>
                <span className="text-slate-300">/</span>
                <Link
                  href={`/content/learning-paths/${placement.id}`}
                  className="hover:text-indigo-500"
                >
                  {placement.title}
                </Link>
              </>
            ) : null}
            {data.module?.course ? (
              <>
                <span className="text-slate-300">/</span>
                <Link
                  href={`/content/courses/${data.module.course.id}`}
                  className="hover:text-indigo-500"
                >
                  {data.module.course.title}
                </Link>
              </>
            ) : null}
            {data.module ? (
              <>
                <span className="text-slate-300">/</span>
                <Link href={`/content/modules/${data.module.id}`} className="hover:text-indigo-500">
                  {data.module.title}
                </Link>
              </>
            ) : null}
          </div>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setPreviewOpen(true)}>
              Preview
            </Button>
            {canWriteContent ? (
              <>
                <Button variant="secondary" size="sm" onClick={openLessonForm}>
                  Edit lesson
                </Button>
                <StatusActions
                  kind="lessons"
                  id={data.id}
                  status={data.status}
                  onChanged={() => reload(true)}
                  onError={setActionError}
                />
              </>
            ) : null}
            <DeleteAction
              kind="lessons"
              id={data.id}
              onDeleted={() => router.push(`/content/modules/${data.moduleId}`)}
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

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} />
            <Badge>/{data.slug}</Badge>
            <Badge>{titleCase(data.difficulty)}</Badge>
            <Badge>{titleCase(data.accessTier)}</Badge>
            <Badge>{data.estimatedMinutes} min</Badge>
            <Badge>{titleCase(data.primaryLanguage)}</Badge>
            {data.requiresQuiz ? (
              <Badge tone="bg-amber-50 text-amber-700 ring-amber-600/20">Quiz gated</Badge>
            ) : null}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-700">{data.objective}</p>
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
            Lesson contents
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-2xl font-semibold text-slate-900">{blocks.length}</p>
              <p className="text-xs text-slate-500">Blocks</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-2xl font-semibold text-slate-900">{translations.length}</p>
              <p className="text-xs text-slate-500">Languages</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-2xl font-semibold text-slate-900">{quizzes.length}</p>
              <p className="text-xs text-slate-500">Quizzes</p>
            </div>
          </div>
          {data.createdBy ? (
            <p className="mt-4 text-xs text-slate-500">
              Created by <span className="font-medium text-slate-700">{data.createdBy.name}</span>
            </p>
          ) : null}
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={
              tab === item.key
                ? 'rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white'
                : 'rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100'
            }
          >
            {item.label} <span className="ml-1 text-xs opacity-70">{item.count}</span>
          </button>
        ))}
      </div>

      {tab === 'blocks' ? (
        <Card className="overflow-hidden">
          <SectionHeader
            title="Content blocks"
            description="Blocks are rendered in order. Reorder them to shape the lesson."
            actions={
              canWriteContent ? (
                <Button size="sm" onClick={openCreateBlock}>
                  Add block
                </Button>
              ) : undefined
            }
            className="border-b border-slate-200 px-5 py-4"
          />
          {blocks.length === 0 ? (
            <EmptyState
              title="No content blocks yet"
              description="Add a heading or paragraph to start building this lesson."
              action={
                canWriteContent ? (
                  <Button onClick={openCreateBlock}>Add first block</Button>
                ) : undefined
              }
              className="m-5"
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {blocks.map((block, index) => (
                <li key={block.id} className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="flex items-center gap-1 sm:w-20">
                      <span className="w-5 text-xs text-slate-400">{block.order}</span>
                      {canWriteContent ? (
                        <div className="flex flex-col">
                          <MiniIconButton
                            label="Move block up"
                            disabled={index === 0 || reorderingBlock === block.id}
                            onClick={() => void moveBlock(block, -1)}
                          >
                            <ChevronIcon direction="up" />
                          </MiniIconButton>
                          <MiniIconButton
                            label="Move block down"
                            disabled={index === blocks.length - 1 || reorderingBlock === block.id}
                            onClick={() => void moveBlock(block, 1)}
                          >
                            <ChevronIcon direction="down" />
                          </MiniIconButton>
                        </div>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge>{titleCase(block.type)}</Badge>
                        {block.mediaAsset ? (
                          <Badge>{titleCase(block.mediaAsset.type)} asset</Badge>
                        ) : null}
                      </div>
                      <BlockPreview block={block} compact />
                    </div>
                    {canWriteContent ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <Button variant="ghost" size="xs" onClick={() => openEditBlock(block)}>
                          Edit
                        </Button>
                        <Button
                          variant="dangerGhost"
                          size="xs"
                          onClick={() => void deleteBlock(block)}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === 'translations' ? (
        <Card className="overflow-hidden">
          <SectionHeader
            title="Translations"
            description="Provide localized lesson metadata in Hindi, Hinglish or English."
            actions={
              canWriteContent ? (
                <Button size="sm" onClick={() => openTranslationForm()}>
                  Add translation
                </Button>
              ) : undefined
            }
            className="border-b border-slate-200 px-5 py-4"
          />
          {translations.length === 0 ? (
            <EmptyState
              title="No translations yet"
              description="The primary language is shown by default. Add a translation to reach more learners."
              action={
                canWriteContent ? (
                  <Button onClick={() => openTranslationForm()}>Add translation</Button>
                ) : undefined
              }
              className="m-5"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Language</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Summary</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {translations.map((translation) => (
                    <tr key={translation.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <Badge>{titleCase(translation.language)}</Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{translation.title}</td>
                      <td className="max-w-md px-4 py-3 text-xs text-slate-500">
                        {translation.summary}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatRelative(translation.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        {canWriteContent ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => openTranslationForm(translation)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="dangerGhost"
                              size="xs"
                              onClick={() => void deleteTranslation(translation)}
                            >
                              Delete
                            </Button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'quizzes' ? (
        <Card className="overflow-hidden">
          <SectionHeader
            title="Quiz versions"
            description="Only one version can be published at a time. Clone a version before making structural changes."
            actions={
              canWriteContent ? (
                <Button size="sm" onClick={openQuizForm}>
                  Add quiz
                </Button>
              ) : undefined
            }
            className="border-b border-slate-200 px-5 py-4"
          />
          {quizzes.length === 0 ? (
            <EmptyState
              title="No quizzes yet"
              description={
                data.requiresQuiz
                  ? 'This lesson is quiz-gated, so add a quiz and publish it before learners can complete the lesson.'
                  : 'Add a quiz to this lesson to check learner understanding.'
              }
              action={
                canWriteContent ? <Button onClick={openQuizForm}>Create quiz</Button> : undefined
              }
              className="m-5"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Version</th>
                    <th className="px-4 py-3">Quiz</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Questions</th>
                    <th className="px-4 py-3">Attempts</th>
                    <th className="px-4 py-3">Passing</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quizzes.map((quiz) => (
                    <tr key={quiz.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-medium text-slate-800">v{quiz.version}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/content/quizzes/${quiz.id}`}
                          className="font-medium text-slate-900 hover:text-indigo-600"
                        >
                          {quiz.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-400">/{quiz.slug}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={quiz.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{quiz._count?.questions ?? 0}</td>
                      <td className="px-4 py-3 text-slate-600">{quiz._count?.attempts ?? 0}</td>
                      <td className="px-4 py-3 text-slate-600">{quiz.passingScore}%</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {canWriteContent ? (
                            <>
                              <StatusActions
                                kind="quizzes"
                                id={quiz.id}
                                status={quiz.status}
                                compact
                                onChanged={() => reload(true)}
                                onError={setActionError}
                              />
                              <Button
                                variant="ghost"
                                size="xs"
                                loading={cloningQuiz === quiz.id}
                                onClick={() => void cloneQuiz(quiz)}
                              >
                                Clone
                              </Button>
                            </>
                          ) : null}
                          <Link
                            href={`/content/quizzes/${quiz.id}`}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                          >
                            Open →
                          </Link>
                          {isSuperAdmin ? (
                            <DeleteAction
                              kind="quizzes"
                              id={quiz.id}
                              size="xs"
                              label="Delete"
                              onDeleted={() => reload(true)}
                              onError={setActionError}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={data.title}
        description={`${formatDateTime(data.updatedAt)} · ${titleCase(data.primaryLanguage)}`}
        size="xl"
        footer={
          <Button variant="secondary" onClick={() => setPreviewOpen(false)}>
            Close preview
          </Button>
        }
      >
        <article className="space-y-5">
          <div>
            <p className="text-xs font-semibold tracking-wide text-indigo-600 uppercase">
              Lesson preview
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">{data.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{data.objective}</p>
          </div>
          {blocks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              This lesson has no content blocks yet.
            </p>
          ) : (
            blocks.map((block) => (
              <div key={block.id} className="rounded-xl border border-slate-100 p-4">
                <p className="mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  {titleCase(block.type)}
                </p>
                <BlockPreview block={block} />
              </div>
            ))
          )}
          {quizzes.length > 0 ? (
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Quiz available
              </p>
              {quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="font-medium text-slate-800">
                    {quiz.title} · v{quiz.version}
                  </span>
                  <StatusBadge status={quiz.status} />
                </div>
              ))}
            </div>
          ) : null}
        </article>
      </Modal>

      <Modal
        open={lessonFormOpen}
        onClose={() => setLessonFormOpen(false)}
        title="Edit lesson"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLessonFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="edit-lesson-form" loading={lessonSaving}>
              Save changes
            </Button>
          </>
        }
      >
        {lessonForm ? (
          <form id="edit-lesson-form" className="space-y-4" onSubmit={saveLesson}>
            {lessonFormError ? <Alert variant="error">{lessonFormError}</Alert> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor="edit-lesson-title" required>
                <Input
                  id="edit-lesson-title"
                  value={lessonForm.title}
                  onChange={(event) => setLessonForm({ ...lessonForm, title: event.target.value })}
                  required
                />
              </Field>
              <Field label="Slug" htmlFor="edit-lesson-slug" required>
                <Input
                  id="edit-lesson-slug"
                  value={lessonForm.slug}
                  onChange={(event) => setLessonForm({ ...lessonForm, slug: event.target.value })}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                />
              </Field>
            </div>
            <Field label="Summary" htmlFor="edit-lesson-summary" required>
              <Input
                id="edit-lesson-summary"
                value={lessonForm.summary}
                onChange={(event) => setLessonForm({ ...lessonForm, summary: event.target.value })}
                required
              />
            </Field>
            <Field label="Objective" htmlFor="edit-lesson-objective" required>
              <Textarea
                id="edit-lesson-objective"
                value={lessonForm.objective}
                onChange={(event) =>
                  setLessonForm({ ...lessonForm, objective: event.target.value })
                }
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Difficulty" htmlFor="edit-lesson-difficulty">
                <Select
                  id="edit-lesson-difficulty"
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
              <Field label="Access" htmlFor="edit-lesson-access">
                <Select
                  id="edit-lesson-access"
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
              <Field label="Estimated minutes" htmlFor="edit-lesson-minutes">
                <Input
                  id="edit-lesson-minutes"
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
              <Field label="Primary language" htmlFor="edit-lesson-language">
                <Select
                  id="edit-lesson-language"
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
        ) : null}
      </Modal>

      <Modal
        open={Boolean(blockForm)}
        onClose={() => {
          setBlockForm(null);
          setEditingBlock(null);
        }}
        title={editingBlock ? 'Edit content block' : 'Add content block'}
        description="Choose a block type and fill in its content."
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setBlockForm(null);
                setEditingBlock(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="block-form" loading={blockSaving}>
              {editingBlock ? 'Save block' : 'Add block'}
            </Button>
          </>
        }
      >
        {blockForm ? (
          <form id="block-form" className="space-y-4" onSubmit={saveBlock}>
            {blockFormError ? <Alert variant="error">{blockFormError}</Alert> : null}
            <Field label="Block type" htmlFor="block-type" required>
              <Select
                id="block-type"
                value={blockForm.type}
                onChange={(event) =>
                  updateBlockForm({ type: event.target.value as ContentBlockType })
                }
              >
                {CONTENT_BLOCK_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {titleCase(type)}
                  </option>
                ))}
              </Select>
            </Field>

            {blockForm.type === 'HEADING' || blockForm.type === 'PARAGRAPH' ? (
              <Field label="Text" htmlFor="block-text" required>
                <Textarea
                  id="block-text"
                  value={blockForm.text}
                  onChange={(event) => updateBlockForm({ text: event.target.value })}
                  required
                />
              </Field>
            ) : null}

            {blockForm.type === 'BULLET_LIST' || blockForm.type === 'RECAP' ? (
              <Field label="Items" htmlFor="block-items" hint="One item per line." required>
                <Textarea
                  id="block-items"
                  value={blockForm.items}
                  onChange={(event) => updateBlockForm({ items: event.target.value })}
                  required
                />
              </Field>
            ) : null}

            {blockForm.type === 'CALLOUT' ? (
              <>
                <Field label="Title" htmlFor="block-callout-title" required>
                  <Input
                    id="block-callout-title"
                    value={blockForm.title}
                    onChange={(event) => updateBlockForm({ title: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Text" htmlFor="block-callout-text" required>
                  <Textarea
                    id="block-callout-text"
                    value={blockForm.text}
                    onChange={(event) => updateBlockForm({ text: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Language" htmlFor="block-callout-language">
                  <Select
                    id="block-callout-language"
                    value={blockForm.language}
                    onChange={(event) => updateBlockForm({ language: event.target.value })}
                  >
                    <option value="">No language tag</option>
                    {CONTENT_LANGUAGES.map((language) => (
                      <option key={language} value={language}>
                        {titleCase(language)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            ) : null}

            {isMediaBlock(blockForm.type) ? (
              <>
                <Field
                  label="Media asset"
                  htmlFor="block-media"
                  hint="Optional if you provide an external URL."
                >
                  <Select
                    id="block-media"
                    value={blockForm.mediaAssetId}
                    onChange={(event) => updateBlockForm({ mediaAssetId: event.target.value })}
                  >
                    <option value="">No library asset</option>
                    {mediaForType.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.key} · {asset.mimeType}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="External URL"
                  htmlFor="block-media-url"
                  hint="Leave blank when using a library asset."
                >
                  <Input
                    id="block-media-url"
                    type="url"
                    value={blockForm.url}
                    onChange={(event) => updateBlockForm({ url: event.target.value })}
                  />
                </Field>
                <Field label="Caption" htmlFor="block-media-caption">
                  <Input
                    id="block-media-caption"
                    value={blockForm.caption}
                    onChange={(event) => updateBlockForm({ caption: event.target.value })}
                  />
                </Field>
              </>
            ) : null}

            {blockForm.type === 'EXAMPLE_CONVERSATION' ? (
              <Field label="Conversation lines" hint="Each line needs a speaker and text." required>
                <div className="space-y-2">
                  {blockForm.lines.map((line, index) => (
                    <div key={index} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                      <Input
                        placeholder="Speaker"
                        value={line.speaker}
                        onChange={(event) =>
                          updateBlockLine(index, { speaker: event.target.value })
                        }
                        aria-label={`Speaker for line ${index + 1}`}
                      />
                      <Input
                        placeholder="Text"
                        value={line.text}
                        onChange={(event) => updateBlockLine(index, { text: event.target.value })}
                        aria-label={`Text for line ${index + 1}`}
                      />
                      <Button
                        variant="dangerGhost"
                        size="sm"
                        onClick={() =>
                          updateBlockForm({
                            lines:
                              blockForm.lines.length === 1
                                ? [{ speaker: '', text: '' }]
                                : blockForm.lines.filter((_, lineIndex) => lineIndex !== index),
                          })
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      updateBlockForm({ lines: [...blockForm.lines, { speaker: '', text: '' }] })
                    }
                  >
                    Add line
                  </Button>
                </div>
              </Field>
            ) : null}

            {blockForm.type === 'MULTIPLE_CHOICE' || blockForm.type === 'TRUE_FALSE' ? (
              <Field
                label="Payload JSON"
                htmlFor="block-json"
                hint="Inline knowledge-check payload."
                required
              >
                <Textarea
                  id="block-json"
                  value={blockForm.json}
                  onChange={(event) => updateBlockForm({ json: event.target.value })}
                  className="min-h-48 font-mono text-xs"
                  required
                />
              </Field>
            ) : null}

            {blockForm.type === 'COMPLETION' ? (
              <Field label="Completion message" htmlFor="block-message">
                <Input
                  id="block-message"
                  value={blockForm.message}
                  onChange={(event) => updateBlockForm({ message: event.target.value })}
                />
              </Field>
            ) : null}
          </form>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(translationForm)}
        onClose={() => setTranslationForm(null)}
        title={
          translationForm && translations.some((item) => item.language === translationForm.language)
            ? 'Edit translation'
            : 'Add translation'
        }
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTranslationForm(null)}>
              Cancel
            </Button>
            <Button type="submit" form="translation-form" loading={translationSaving}>
              Save translation
            </Button>
          </>
        }
      >
        {translationForm ? (
          <form id="translation-form" className="space-y-4" onSubmit={saveTranslation}>
            {translationFormError ? <Alert variant="error">{translationFormError}</Alert> : null}
            <Field label="Language" htmlFor="translation-language" required>
              <Select
                id="translation-language"
                value={translationForm.language}
                onChange={(event) =>
                  setTranslationForm({
                    ...translationForm,
                    language: event.target.value as ContentLanguage,
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
            <Field label="Title" htmlFor="translation-title" required>
              <Input
                id="translation-title"
                value={translationForm.title}
                onChange={(event) =>
                  setTranslationForm({ ...translationForm, title: event.target.value })
                }
                required
              />
            </Field>
            <Field label="Summary" htmlFor="translation-summary" required>
              <Input
                id="translation-summary"
                value={translationForm.summary}
                onChange={(event) =>
                  setTranslationForm({ ...translationForm, summary: event.target.value })
                }
                required
              />
            </Field>
            <Field label="Objective" htmlFor="translation-objective" required>
              <Textarea
                id="translation-objective"
                value={translationForm.objective}
                onChange={(event) =>
                  setTranslationForm({ ...translationForm, objective: event.target.value })
                }
                required
              />
            </Field>
            <Field
              label="Translated content JSON"
              htmlFor="translation-content"
              hint="Optional structured block translations. Leave blank to fall back to the primary lesson."
            >
              <Textarea
                id="translation-content"
                value={translationForm.contentJson}
                onChange={(event) =>
                  setTranslationForm({ ...translationForm, contentJson: event.target.value })
                }
                className="min-h-32 font-mono text-xs"
              />
            </Field>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(quizForm)}
        onClose={() => setQuizForm(null)}
        title="Add quiz"
        description="A new quiz version starts in draft. Add questions after saving."
        footer={
          <>
            <Button variant="secondary" onClick={() => setQuizForm(null)}>
              Cancel
            </Button>
            <Button type="submit" form="lesson-quiz-form" loading={quizSaving}>
              Create quiz
            </Button>
          </>
        }
      >
        {quizForm ? (
          <form id="lesson-quiz-form" className="space-y-4" onSubmit={createQuiz}>
            {quizFormError ? <Alert variant="error">{quizFormError}</Alert> : null}
            <Field label="Title" htmlFor="lesson-quiz-title" required>
              <Input
                id="lesson-quiz-title"
                value={quizForm.title}
                onChange={(event) => setQuizForm({ ...quizForm, title: event.target.value })}
                required
              />
            </Field>
            <Field label="Description" htmlFor="lesson-quiz-description">
              <Textarea
                id="lesson-quiz-description"
                value={quizForm.description}
                onChange={(event) => setQuizForm({ ...quizForm, description: event.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Passing score %" htmlFor="lesson-quiz-passing">
                <Input
                  id="lesson-quiz-passing"
                  type="number"
                  min={1}
                  max={100}
                  value={quizForm.passingScore}
                  onChange={(event) =>
                    setQuizForm({ ...quizForm, passingScore: event.target.value })
                  }
                />
              </Field>
              <Field label="XP reward" htmlFor="lesson-quiz-xp">
                <Input
                  id="lesson-quiz-xp"
                  type="number"
                  min={0}
                  max={1000}
                  value={quizForm.xpReward}
                  onChange={(event) => setQuizForm({ ...quizForm, xpReward: event.target.value })}
                />
              </Field>
              <Field label="Time limit (seconds)" htmlFor="lesson-quiz-time">
                <Input
                  id="lesson-quiz-time"
                  type="number"
                  min={30}
                  max={86400}
                  value={quizForm.timeLimitSeconds}
                  onChange={(event) =>
                    setQuizForm({ ...quizForm, timeLimitSeconds: event.target.value })
                  }
                />
              </Field>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
