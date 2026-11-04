'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageLoading } from '@/components/ui';
import { canViewBusinessRole, useAdminAuth } from '@/lib/auth';

/**
 * The console entry point is role-aware: content editors have no access to the
 * business dashboard, so they start on the content library instead of hitting a
 * 403 on their first page.
 */
export default function HomePage() {
  const router = useRouter();
  const { session, loading } = useAdminAuth();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!session) {
      router.replace('/login');
      return;
    }

    router.replace(
      canViewBusinessRole(session.admin.role) ? '/dashboard' : '/content/learning-paths',
    );
  }, [loading, router, session]);

  return <PageLoading />;
}
