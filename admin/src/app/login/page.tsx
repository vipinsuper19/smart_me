'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { errorMessage } from '@/lib/api';
import { useAdminAuth } from '@/lib/auth';
import { Alert, Button, Field, Input, Spinner } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const { login, session, loading } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) {
      router.replace('/dashboard');
    }
  }, [loading, router, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace('/dashboard');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Spinner className="h-6 w-6 text-indigo-400" />
      </div>
    );
  }

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-white/10 px-12 py-14 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(99,102,241,0.35),transparent_42%),radial-gradient(circle_at_80%_80%,rgba(16,185,129,0.18),transparent_38%)]" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-sm font-bold text-white shadow-lg shadow-indigo-950/50">
              SM
            </div>
            <div>
              <p className="text-sm font-semibold text-white">SmartMe</p>
              <p className="text-xs text-slate-400">Learning operations</p>
            </div>
          </div>

          <div className="mt-24 max-w-lg">
            <p className="text-xs font-semibold tracking-[0.2em] text-indigo-300 uppercase">
              Admin console
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Build learning journeys learners actually finish.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-slate-300">
              Publish structured micro-lessons, tune quizzes, manage media and watch learner
              progress from one focused workspace.
            </p>
          </div>
        </div>

        <div className="relative grid max-w-lg grid-cols-2 gap-3">
          {[
            ['Content workflow', 'Draft → review → publish'],
            ['Quiz versioning', 'Safe edits after attempts'],
            ['Role-based access', 'Super admin, editor, analyst'],
            ['Audit trail', 'Every write is recorded'],
          ].map(([title, detail]) => (
            <div key={title} className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
              <p className="text-sm font-medium text-white">{title}</p>
              <p className="mt-0.5 text-xs text-slate-400">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-sm font-bold text-white">
              SM
            </div>
            <div>
              <p className="text-sm font-semibold text-white">SmartMe</p>
              <p className="text-xs text-slate-400">Admin console</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-black/20 sm:p-8">
            <p className="text-xs font-semibold tracking-wider text-indigo-600 uppercase">
              Welcome back
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              Sign in to admin
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Admin accounts are separate from learner accounts.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {error ? <Alert variant="error">{error}</Alert> : null}

              <Field label="Work email" htmlFor="email" required>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="admin@smartme.local"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoFocus
                />
              </Field>

              <Field label="Password" htmlFor="password" required>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </Field>

              <Button
                type="submit"
                className="w-full"
                loading={submitting}
                disabled={!email || !password}
              >
                Sign in
              </Button>
            </form>

            <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">
              Access is role-based. If you need access or your permissions look wrong, contact a
              SmartMe super admin.
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            SmartMe learning platform · Admin operations
          </p>
        </div>
      </section>
    </main>
  );
}
