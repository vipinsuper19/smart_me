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
import { formatDateTime, titleCase } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import {
  QUESTION_TYPES,
  type Question,
  type QuestionOption,
  type QuestionType,
  type Quiz,
} from '@/lib/types';

interface QuizFormState {
  title: string;
  description: string;
  passingScore: string;
  xpReward: string;
  timeLimitSeconds: string;
}

interface QuestionOptionForm {
  text: string;
  feedback: string;
  isCorrect: boolean;
}

interface QuestionFormState {
  type: QuestionType;
  prompt: string;
  scenario: string;
  explanation: string;
  points: string;
  options: QuestionOptionForm[];
}

interface OptionFormState {
  questionId: string;
  optionId: string | null;
  text: string;
  feedback: string;
  isCorrect: boolean;
}

function blankOption(isCorrect = false): QuestionOptionForm {
  return { text: '', feedback: '', isCorrect };
}

function newQuestionForm(): QuestionFormState {
  return {
    type: 'SINGLE_CHOICE',
    prompt: '',
    scenario: '',
    explanation: '',
    points: '10',
    options: [blankOption(true), blankOption(), blankOption(), blankOption()],
  };
}

export default function QuizDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const { canWriteContent } = useAdminAuth();
  const { data, loading, error, reload } = useApi<Quiz>(id ? `/admin/quizzes/${id}` : null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [quizForm, setQuizForm] = useState<QuizFormState | null>(null);
  const [quizSaving, setQuizSaving] = useState(false);
  const [quizFormError, setQuizFormError] = useState<string | null>(null);

  const [questionForm, setQuestionForm] = useState<QuestionFormState | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionSaving, setQuestionSaving] = useState(false);
  const [questionFormError, setQuestionFormError] = useState<string | null>(null);
  const [reorderingQuestion, setReorderingQuestion] = useState<string | null>(null);

  const [optionForm, setOptionForm] = useState<OptionFormState | null>(null);
  const [optionSaving, setOptionSaving] = useState(false);
  const [optionFormError, setOptionFormError] = useState<string | null>(null);
  const [reorderingOption, setReorderingOption] = useState<string | null>(null);

  const [cloning, setCloning] = useState(false);

  function openQuizForm() {
    if (!data) return;
    setQuizForm({
      title: data.title,
      description: data.description ?? '',
      passingScore: String(data.passingScore),
      xpReward: String(data.xpReward),
      timeLimitSeconds: data.timeLimitSeconds ? String(data.timeLimitSeconds) : '',
    });
    setQuizFormError(null);
  }

  async function saveQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quizForm) return;
    setQuizSaving(true);
    setQuizFormError(null);
    try {
      await apiFetch(`/admin/quizzes/${id}`, {
        method: 'PATCH',
        json: {
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

  function openCreateQuestion() {
    setEditingQuestion(null);
    setQuestionForm(newQuestionForm());
    setQuestionFormError(null);
  }

  function openEditQuestion(question: Question) {
    setEditingQuestion(question);
    setQuestionForm({
      type: question.type,
      prompt: question.prompt,
      scenario: question.scenario ?? '',
      explanation: question.explanation,
      points: String(question.points),
      options: [],
    });
    setQuestionFormError(null);
  }

  function updateQuestionForm(patch: Partial<QuestionFormState>) {
    setQuestionForm((current) => (current ? { ...current, ...patch } : current));
  }

  function changeQuestionType(type: QuestionType) {
    setQuestionForm((current) => {
      if (!current) return current;
      if (type === 'TRUE_FALSE') {
        return {
          ...current,
          type,
          options: [
            { text: 'True', feedback: '', isCorrect: true },
            { text: 'False', feedback: '', isCorrect: false },
          ],
        };
      }
      const options =
        current.type === 'TRUE_FALSE'
          ? [blankOption(true), blankOption(), blankOption(), blankOption()]
          : current.options;
      return { ...current, type, options };
    });
  }

  function updateQuestionOption(index: number, patch: Partial<QuestionOptionForm>) {
    setQuestionForm((current) => {
      if (!current) return current;
      return {
        ...current,
        options: current.options.map((option, optionIndex) => {
          if (optionIndex !== index) {
            return patch.isCorrect ? { ...option, isCorrect: false } : option;
          }
          return { ...option, ...patch };
        }),
      };
    });
  }

  async function saveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!questionForm) return;
    setQuestionSaving(true);
    setQuestionFormError(null);
    try {
      if (editingQuestion) {
        await apiFetch(`/admin/questions/${editingQuestion.id}`, {
          method: 'PATCH',
          json: {
            type: questionForm.type,
            prompt: questionForm.prompt.trim(),
            scenario: questionForm.scenario.trim() || null,
            explanation: questionForm.explanation.trim(),
            points: Number(questionForm.points) || 1,
          },
        });
      } else {
        if (questionForm.options.length < 2) {
          throw new Error('Add at least two answer options.');
        }
        if (questionForm.options.some((option) => !option.text.trim())) {
          throw new Error('Every answer option needs text.');
        }
        if (questionForm.options.filter((option) => option.isCorrect).length !== 1) {
          throw new Error('Select exactly one correct option.');
        }
        await apiFetch(`/admin/quizzes/${id}/questions`, {
          method: 'POST',
          json: {
            type: questionForm.type,
            prompt: questionForm.prompt.trim(),
            scenario: questionForm.scenario.trim() || null,
            explanation: questionForm.explanation.trim(),
            points: Number(questionForm.points) || 1,
            options: questionForm.options.map((option) => ({
              text: option.text.trim(),
              feedback: option.feedback.trim() || null,
              isCorrect: option.isCorrect,
            })),
          },
        });
      }
      setQuestionForm(null);
      setEditingQuestion(null);
      await reload(true);
    } catch (cause) {
      setQuestionFormError(errorMessage(cause));
    } finally {
      setQuestionSaving(false);
    }
  }

  async function deleteQuestion(question: Question) {
    if (!window.confirm('Delete this question and all of its options?')) return;
    setActionError(null);
    try {
      await apiFetch(`/admin/questions/${question.id}`, { method: 'DELETE' });
      await reload(true);
    } catch (cause) {
      setActionError(errorMessage(cause));
    }
  }

  async function moveQuestion(question: Question, direction: -1 | 1) {
    if (!data?.questions) return;
    const ids = data.questions.map((item) => item.id);
    const index = ids.indexOf(question.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;

    setReorderingQuestion(question.id);
    setActionError(null);
    try {
      [ids[index], ids[target]] = [ids[target], ids[index]];
      await apiFetch(`/admin/quizzes/${id}/questions/reorder`, { method: 'POST', json: { ids } });
      await reload(true);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setReorderingQuestion(null);
    }
  }

  function openCreateOption(question: Question) {
    setOptionForm({
      questionId: question.id,
      optionId: null,
      text: '',
      feedback: '',
      isCorrect: false,
    });
    setOptionFormError(null);
  }

  function openEditOption(question: Question, option: QuestionOption) {
    setOptionForm({
      questionId: question.id,
      optionId: option.id,
      text: option.text,
      feedback: option.feedback ?? '',
      isCorrect: option.isCorrect,
    });
    setOptionFormError(null);
  }

  async function saveOption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!optionForm) return;
    setOptionSaving(true);
    setOptionFormError(null);
    try {
      const body = {
        text: optionForm.text.trim(),
        feedback: optionForm.feedback.trim() || null,
        isCorrect: optionForm.isCorrect,
      };
      if (optionForm.optionId) {
        await apiFetch(`/admin/options/${optionForm.optionId}`, { method: 'PATCH', json: body });
      } else {
        await apiFetch(`/admin/questions/${optionForm.questionId}/options`, {
          method: 'POST',
          json: body,
        });
      }
      setOptionForm(null);
      await reload(true);
    } catch (cause) {
      setOptionFormError(errorMessage(cause));
    } finally {
      setOptionSaving(false);
    }
  }

  async function deleteOption(option: QuestionOption) {
    if (!window.confirm('Delete this answer option?')) return;
    setActionError(null);
    try {
      await apiFetch(`/admin/options/${option.id}`, { method: 'DELETE' });
      await reload(true);
    } catch (cause) {
      setActionError(errorMessage(cause));
    }
  }

  async function moveOption(question: Question, option: QuestionOption, direction: -1 | 1) {
    const ids = question.options.map((item) => item.id);
    const index = ids.indexOf(option.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;

    setReorderingOption(option.id);
    setActionError(null);
    try {
      [ids[index], ids[target]] = [ids[target], ids[index]];
      await apiFetch(`/admin/questions/${question.id}/options/reorder`, {
        method: 'POST',
        json: { ids },
      });
      await reload(true);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setReorderingOption(null);
    }
  }

  async function cloneVersion() {
    if (!data) return;
    setCloning(true);
    setActionError(null);
    try {
      const created = await apiFetch<Quiz>(`/admin/quizzes/${data.id}/versions`, {
        method: 'POST',
        json: {},
      });
      router.push(`/content/quizzes/${created.id}`);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setCloning(false);
    }
  }

  if (loading && !data) {
    return <PageLoading label="Loading quiz…" />;
  }

  if (error || !data) {
    return (
      <>
        <PageHeader
          title="Quiz"
          back={
            <Link href="/content/lessons" className="text-indigo-600 hover:text-indigo-500">
              ← Lessons
            </Link>
          }
        />
        <Alert variant="error">
          {error ?? 'This quiz could not be found.'}{' '}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => void reload()}>
            Retry
          </Button>
        </Alert>
      </>
    );
  }

  const questions = data.questions ?? [];
  const attempts = data._count?.attempts ?? 0;
  const structuralLock =
    data.status === 'PUBLISHED'
      ? 'Unpublish this quiz before changing questions or options.'
      : attempts > 0
        ? `This quiz already has ${attempts} attempt${attempts === 1 ? '' : 's'}. Clone it into a new version to make structural edits.`
        : null;

  return (
    <>
      <PageHeader
        eyebrow={`Quiz · v${data.version}`}
        title={data.title}
        description={data.description ?? 'Question-by-question quiz editor.'}
        back={
          data.lesson ? (
            <div className="flex flex-wrap items-center gap-2 text-indigo-600">
              <Link href="/content/lessons" className="hover:text-indigo-500">
                Lessons
              </Link>
              <span className="text-slate-300">/</span>
              <Link href={`/content/lessons/${data.lesson.id}`} className="hover:text-indigo-500">
                {data.lesson.title}
              </Link>
            </div>
          ) : (
            <Link href="/content/lessons" className="text-indigo-600 hover:text-indigo-500">
              ← Lessons
            </Link>
          )
        }
        actions={
          <>
            {canWriteContent ? (
              <>
                <Button variant="secondary" size="sm" onClick={openQuizForm}>
                  Edit settings
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={cloning}
                  onClick={() => void cloneVersion()}
                >
                  Clone new version
                </Button>
                <StatusActions
                  kind="quizzes"
                  id={data.id}
                  status={data.status}
                  onChanged={() => reload(true)}
                  onError={setActionError}
                />
              </>
            ) : null}
            <DeleteAction
              kind="quizzes"
              id={data.id}
              label="Delete quiz"
              onDeleted={() =>
                router.push(
                  data.lessonId ? `/content/lessons/${data.lessonId}` : '/content/lessons',
                )
              }
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

      {structuralLock ? (
        <Alert variant="warning" className="mb-4" title="Structural editing locked">
          {structuralLock}
        </Alert>
      ) : null}

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} />
            <Badge>v{data.version}</Badge>
            <Badge>/{data.slug}</Badge>
            <Badge>{data.passingScore}% to pass</Badge>
            <Badge>{data.xpReward} XP</Badge>
            {data.timeLimitSeconds ? (
              <Badge>{data.timeLimitSeconds}s limit</Badge>
            ) : (
              <Badge>No time limit</Badge>
            )}
          </div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Questions
              </dt>
              <dd className="mt-1 text-slate-700">{questions.length}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Learner attempts
              </dt>
              <dd className="mt-1 text-slate-700">{attempts}</dd>
            </div>
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
          <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
            Publish checklist
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className={questions.length > 0 ? 'text-emerald-700' : 'text-slate-500'}>
              {questions.length > 0 ? '✓' : '○'} At least one question
            </li>
            <li
              className={
                questions.every((question) => question.options.length >= 2)
                  ? 'text-emerald-700'
                  : 'text-slate-500'
              }
            >
              {questions.every((question) => question.options.length >= 2) ? '✓' : '○'} Two or more
              options per question
            </li>
            <li
              className={
                questions.every(
                  (question) => question.options.filter((option) => option.isCorrect).length === 1,
                )
                  ? 'text-emerald-700'
                  : 'text-slate-500'
              }
            >
              {questions.every(
                (question) => question.options.filter((option) => option.isCorrect).length === 1,
              )
                ? '✓'
                : '○'}{' '}
              Exactly one correct option per question
            </li>
            <li
              className={
                questions.every(
                  (question) => question.type !== 'TRUE_FALSE' || question.options.length === 2,
                )
                  ? 'text-emerald-700'
                  : 'text-slate-500'
              }
            >
              {questions.every(
                (question) => question.type !== 'TRUE_FALSE' || question.options.length === 2,
              )
                ? '✓'
                : '○'}{' '}
              True/false questions have exactly two options
            </li>
          </ul>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <SectionHeader
          title="Questions"
          description="Order controls the sequence learners see."
          actions={
            canWriteContent && !structuralLock ? (
              <Button size="sm" onClick={openCreateQuestion}>
                Add question
              </Button>
            ) : undefined
          }
          className="border-b border-slate-200 px-5 py-4"
        />
        {questions.length === 0 ? (
          <EmptyState
            title="No questions yet"
            description="Add the first question before publishing this quiz."
            action={
              canWriteContent && !structuralLock ? (
                <Button onClick={openCreateQuestion}>Add question</Button>
              ) : undefined
            }
            className="m-5"
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {questions.map((question, questionIndex) => (
              <li key={question.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex items-center gap-1 sm:w-20">
                    <span className="w-5 text-xs text-slate-400">{question.order}</span>
                    {canWriteContent && !structuralLock ? (
                      <div className="flex flex-col">
                        <MiniIconButton
                          label="Move question up"
                          disabled={questionIndex === 0 || reorderingQuestion === question.id}
                          onClick={() => void moveQuestion(question, -1)}
                        >
                          <ChevronIcon direction="up" />
                        </MiniIconButton>
                        <MiniIconButton
                          label="Move question down"
                          disabled={
                            questionIndex === questions.length - 1 ||
                            reorderingQuestion === question.id
                          }
                          onClick={() => void moveQuestion(question, 1)}
                        >
                          <ChevronIcon direction="down" />
                        </MiniIconButton>
                      </div>
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{titleCase(question.type)}</Badge>
                      <Badge>{question.points} points</Badge>
                      <Badge>{question.options.length} options</Badge>
                      {question._count?.answers ? (
                        <Badge>{question._count.answers} answers</Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-900">{question.prompt}</p>
                    {question.scenario ? (
                      <p className="mt-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                        {question.scenario}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">Why:</span>{' '}
                      {question.explanation}
                    </p>

                    <div className="mt-3 space-y-1.5">
                      {question.options.map((option, optionIndex) => (
                        <div
                          key={option.id}
                          className={
                            option.isCorrect
                              ? 'flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2'
                              : 'flex items-start gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2'
                          }
                        >
                          <span className="mt-0.5 text-xs font-semibold text-slate-400">
                            {optionIndex + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-slate-800">
                              {option.text}
                              {option.isCorrect ? (
                                <span className="ml-2 text-[11px] font-semibold text-emerald-700">
                                  CORRECT
                                </span>
                              ) : null}
                            </p>
                            {option.feedback ? (
                              <p className="mt-0.5 text-xs text-slate-500">{option.feedback}</p>
                            ) : null}
                          </div>
                          {canWriteContent && !structuralLock ? (
                            <div className="flex items-center gap-1">
                              <MiniIconButton
                                label="Move option up"
                                disabled={optionIndex === 0 || reorderingOption === option.id}
                                onClick={() => void moveOption(question, option, -1)}
                              >
                                <ChevronIcon direction="up" />
                              </MiniIconButton>
                              <MiniIconButton
                                label="Move option down"
                                disabled={
                                  optionIndex === question.options.length - 1 ||
                                  reorderingOption === option.id
                                }
                                onClick={() => void moveOption(question, option, 1)}
                              >
                                <ChevronIcon direction="down" />
                              </MiniIconButton>
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => openEditOption(question, option)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="dangerGhost"
                                size="xs"
                                onClick={() => void deleteOption(option)}
                              >
                                Delete
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  {canWriteContent && !structuralLock ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => openCreateOption(question)}
                      >
                        Add option
                      </Button>
                      <Button variant="ghost" size="xs" onClick={() => openEditQuestion(question)}>
                        Edit
                      </Button>
                      <Button
                        variant="dangerGhost"
                        size="xs"
                        onClick={() => void deleteQuestion(question)}
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

      <Modal
        open={Boolean(quizForm)}
        onClose={() => setQuizForm(null)}
        title="Quiz settings"
        description="Settings can be changed even after publishing."
        footer={
          <>
            <Button variant="secondary" onClick={() => setQuizForm(null)}>
              Cancel
            </Button>
            <Button type="submit" form="quiz-settings-form" loading={quizSaving}>
              Save settings
            </Button>
          </>
        }
      >
        {quizForm ? (
          <form id="quiz-settings-form" className="space-y-4" onSubmit={saveQuiz}>
            {quizFormError ? <Alert variant="error">{quizFormError}</Alert> : null}
            <Field label="Title" htmlFor="quiz-title" required>
              <Input
                id="quiz-title"
                value={quizForm.title}
                onChange={(event) => setQuizForm({ ...quizForm, title: event.target.value })}
                required
              />
            </Field>
            <Field label="Description" htmlFor="quiz-description">
              <Textarea
                id="quiz-description"
                value={quizForm.description}
                onChange={(event) => setQuizForm({ ...quizForm, description: event.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Passing score %" htmlFor="quiz-passing">
                <Input
                  id="quiz-passing"
                  type="number"
                  min={1}
                  max={100}
                  value={quizForm.passingScore}
                  onChange={(event) =>
                    setQuizForm({ ...quizForm, passingScore: event.target.value })
                  }
                />
              </Field>
              <Field label="XP reward" htmlFor="quiz-xp">
                <Input
                  id="quiz-xp"
                  type="number"
                  min={0}
                  max={1000}
                  value={quizForm.xpReward}
                  onChange={(event) => setQuizForm({ ...quizForm, xpReward: event.target.value })}
                />
              </Field>
              <Field label="Time limit (seconds)" htmlFor="quiz-time">
                <Input
                  id="quiz-time"
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

      <Modal
        open={Boolean(questionForm)}
        onClose={() => {
          setQuestionForm(null);
          setEditingQuestion(null);
        }}
        title={editingQuestion ? 'Edit question' : 'Add question'}
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setQuestionForm(null);
                setEditingQuestion(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="question-form" loading={questionSaving}>
              {editingQuestion ? 'Save question' : 'Add question'}
            </Button>
          </>
        }
      >
        {questionForm ? (
          <form id="question-form" className="space-y-4" onSubmit={saveQuestion}>
            {questionFormError ? <Alert variant="error">{questionFormError}</Alert> : null}
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <Field label="Question type" htmlFor="question-type">
                <Select
                  id="question-type"
                  value={questionForm.type}
                  onChange={(event) => changeQuestionType(event.target.value as QuestionType)}
                >
                  {QUESTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {titleCase(type)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Points" htmlFor="question-points">
                <Input
                  id="question-points"
                  type="number"
                  min={1}
                  max={100}
                  value={questionForm.points}
                  onChange={(event) => updateQuestionForm({ points: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Prompt" htmlFor="question-prompt" required>
              <Textarea
                id="question-prompt"
                value={questionForm.prompt}
                onChange={(event) => updateQuestionForm({ prompt: event.target.value })}
                required
              />
            </Field>
            <Field
              label="Scenario"
              htmlFor="question-scenario"
              hint="Optional context shown above the prompt."
            >
              <Textarea
                id="question-scenario"
                value={questionForm.scenario}
                onChange={(event) => updateQuestionForm({ scenario: event.target.value })}
              />
            </Field>
            <Field
              label="Explanation"
              htmlFor="question-explanation"
              hint="Shown after the learner answers."
              required
            >
              <Textarea
                id="question-explanation"
                value={questionForm.explanation}
                onChange={(event) => updateQuestionForm({ explanation: event.target.value })}
                required
              />
            </Field>

            {editingQuestion ? (
              <Alert variant="info">
                Answer options are edited separately. Published quizzes and quizzes with attempts
                stay locked.
              </Alert>
            ) : (
              <Field label="Answer options" hint="Select exactly one correct answer." required>
                <div className="space-y-2">
                  {questionForm.options.map((option, index) => (
                    <div key={index} className="rounded-xl border border-slate-200 p-3">
                      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <Input
                          placeholder={`Option ${index + 1}`}
                          value={option.text}
                          onChange={(event) =>
                            updateQuestionOption(index, { text: event.target.value })
                          }
                          aria-label={`Option ${index + 1} text`}
                        />
                        <Input
                          placeholder="Feedback (optional)"
                          value={option.feedback}
                          onChange={(event) =>
                            updateQuestionOption(index, { feedback: event.target.value })
                          }
                          aria-label={`Option ${index + 1} feedback`}
                        />
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                            <input
                              type="radio"
                              name="correct-option"
                              checked={option.isCorrect}
                              onChange={() =>
                                setQuestionForm({
                                  ...questionForm,
                                  options: questionForm.options.map((item, itemIndex) => ({
                                    ...item,
                                    isCorrect: itemIndex === index,
                                  })),
                                })
                              }
                              className="h-4 w-4 text-indigo-600"
                            />
                            Correct
                          </label>
                          <Button
                            variant="dangerGhost"
                            size="xs"
                            disabled={questionForm.options.length <= 2}
                            onClick={() =>
                              setQuestionForm({
                                ...questionForm,
                                options: questionForm.options.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              })
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={questionForm.options.length >= 8}
                    onClick={() =>
                      updateQuestionForm({ options: [...questionForm.options, blankOption()] })
                    }
                  >
                    Add option
                  </Button>
                </div>
              </Field>
            )}
          </form>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(optionForm)}
        onClose={() => setOptionForm(null)}
        title={optionForm?.optionId ? 'Edit answer option' : 'Add answer option'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOptionForm(null)}>
              Cancel
            </Button>
            <Button type="submit" form="option-form" loading={optionSaving}>
              Save option
            </Button>
          </>
        }
      >
        {optionForm ? (
          <form id="option-form" className="space-y-4" onSubmit={saveOption}>
            {optionFormError ? <Alert variant="error">{optionFormError}</Alert> : null}
            <Field label="Option text" htmlFor="option-text" required>
              <Input
                id="option-text"
                value={optionForm.text}
                onChange={(event) => setOptionForm({ ...optionForm, text: event.target.value })}
                required
              />
            </Field>
            <Field
              label="Feedback"
              htmlFor="option-feedback"
              hint="Optional feedback shown when this option is selected."
            >
              <Textarea
                id="option-feedback"
                value={optionForm.feedback}
                onChange={(event) => setOptionForm({ ...optionForm, feedback: event.target.value })}
              />
            </Field>
            <Checkbox
              label="This is the correct option"
              description="Only one option per question can be correct."
              checked={optionForm.isCorrect}
              onChange={(event) =>
                setOptionForm({ ...optionForm, isCorrect: event.target.checked })
              }
            />
          </form>
        ) : null}
      </Modal>
    </>
  );
}
