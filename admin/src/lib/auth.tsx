'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  apiFetch,
  clearAdminSession,
  readAdminSession,
  subscribeAdminSession,
  writeAdminSession,
} from './api';
import type { AdminAuthResponse, AdminRole, AdminSession, AdminUser } from './types';

interface AdminAuthContextValue {
  admin: AdminUser | null;
  session: AdminSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: AdminRole[]) => boolean;
  isSuperAdmin: boolean;
  canWriteContent: boolean;
  canViewBusiness: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function canWriteContentRole(role: AdminRole | undefined): boolean {
  return role === 'SUPER_ADMIN' || role === 'CONTENT_EDITOR';
}

export function canViewBusinessRole(role: AdminRole | undefined): boolean {
  return role === 'SUPER_ADMIN' || role === 'ANALYST';
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const stored = readAdminSession();

    if (!stored) {
      setLoading(false);
      return;
    }

    setSession(stored);

    void apiFetch<AdminUser>('/admin/auth/me')
      .then((admin) => {
        if (!active) {
          return;
        }
        const current = readAdminSession() ?? stored;
        const next = { ...current, admin };
        writeAdminSession(next);
        setSession(next);
      })
      .catch(() => {
        if (active) {
          clearAdminSession();
          setSession(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => subscribeAdminSession(setSession), []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiFetch<AdminAuthResponse>('/admin/auth/login', {
      method: 'POST',
      json: { email, password },
      skipAuth: true,
    });

    const next: AdminSession = { admin: response.admin, tokens: response.tokens };
    writeAdminSession(next);
    setSession(next);
  }, []);

  const logout = useCallback(async () => {
    const current = readAdminSession();
    if (current?.tokens.refreshToken) {
      try {
        await apiFetch<void>('/admin/auth/logout', {
          method: 'POST',
          json: { refreshToken: current.tokens.refreshToken },
          skipAuth: true,
          retryOnUnauthorized: false,
        });
      } catch {
        // Local sign-out must still succeed if the API is unreachable.
      }
    }

    clearAdminSession();
    setSession(null);
  }, []);

  const value = useMemo<AdminAuthContextValue>(() => {
    const admin = session?.admin ?? null;
    const hasRole = (...roles: AdminRole[]) => Boolean(admin && roles.includes(admin.role));
    return {
      admin,
      session,
      loading,
      login,
      logout,
      hasRole,
      isSuperAdmin: admin?.role === 'SUPER_ADMIN',
      canWriteContent: canWriteContentRole(admin?.role),
      canViewBusiness: canViewBusinessRole(admin?.role),
    };
  }, [loading, login, logout, session]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  }
  return context;
}
