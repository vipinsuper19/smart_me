'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAdminAuth } from '@/lib/auth';
import { roleLabel } from '@/lib/format';
import { Badge, Button, Spinner, cn } from './ui';

type NavIconName =
  | 'dashboard'
  | 'path'
  | 'course'
  | 'module'
  | 'lesson'
  | 'media'
  | 'review'
  | 'users'
  | 'subscriptions'
  | 'analytics'
  | 'audit';

interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const contentItems: NavGroup = {
  label: 'Content',
  items: [
    { href: '/content/learning-paths', label: 'Learning paths', icon: 'path' },
    { href: '/content/courses', label: 'Courses', icon: 'course' },
    { href: '/content/modules', label: 'Modules', icon: 'module' },
    { href: '/content/lessons', label: 'Lessons', icon: 'lesson' },
    { href: '/media', label: 'Media library', icon: 'media' },
    { href: '/review', label: 'Review queue', icon: 'review' },
  ],
};

function NavIcon({ name }: { name: NavIconName }) {
  const common = {
    className: 'h-4 w-4 shrink-0',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
  };

  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5.5 9.5V21h13V9.5" />
          <path d="M9.5 21v-6h5v6" />
        </svg>
      );
    case 'path':
      return (
        <svg {...common}>
          <circle cx="6" cy="5" r="2" />
          <circle cx="6" cy="19" r="2" />
          <circle cx="18" cy="12" r="2" />
          <path d="M8 5h4a4 4 0 0 1 4 4v1" />
          <path d="M8 19h4a4 4 0 0 0 4-4v-1" />
        </svg>
      );
    case 'course':
      return (
        <svg {...common}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
          <path d="M4 19a2 2 0 0 1 2-2h14" />
        </svg>
      );
    case 'module':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="6" rx="1.5" />
          <rect x="3" y="14" width="18" height="6" rx="1.5" />
          <path d="M7 7h.01M7 17h.01" />
        </svg>
      );
    case 'lesson':
      return (
        <svg {...common}>
          <path d="M5 4h11l3 3v13H5z" />
          <path d="M9 11h6M9 15h6" />
        </svg>
      );
    case 'media':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="9" r="1.5" />
          <path d="m4 17 5-5 4 4 2-2 5 5" />
        </svg>
      );
    case 'review':
      return (
        <svg {...common}>
          <path d="M9 4h9a2 2 0 0 1 2 2v9" />
          <path d="M9 4a2 2 0 0 0-2 2v2" />
          <path d="M4 8h9v12H4z" />
          <path d="m7 14 2 2 4-4" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5a3 3 0 0 1 0 6" />
          <path d="M17.5 14.5A5.5 5.5 0 0 1 21 20" />
        </svg>
      );
    case 'subscriptions':
      return (
        <svg {...common}>
          <rect x="2.5" y="5" width="19" height="14" rx="2" />
          <path d="M2.5 10h19" />
          <path d="M6.5 15h3" />
        </svg>
      );
    case 'analytics':
      return (
        <svg {...common}>
          <path d="M4 20V10" />
          <path d="M10 20V4" />
          <path d="M16 20v-7" />
          <path d="M22 20H2" />
        </svg>
      );
    case 'audit':
      return (
        <svg {...common}>
          <path d="M9 4h10v16H5V4h2" />
          <path d="M9 2h4v4H9z" />
          <path d="M8 11h8M8 15h6" />
        </svg>
      );
  }
}

function SidebarLink({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
        active
          ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      )}
    >
      <NavIcon name={item.icon} />
      {item.label}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, logout, canViewBusiness, isSuperAdmin } = useAdminAuth();
  const [signingOut, setSigningOut] = useState(false);

  const isActive = (item: NavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  // Only mirror navigation the role can actually open; otherwise the console
  // offers links that answer 403.
  const groups: NavGroup[] = [];
  if (canViewBusiness) {
    groups.push({
      label: 'Overview',
      items: [{ href: '/dashboard', label: 'Dashboard', icon: 'dashboard', exact: true }],
    });
  }
  groups.push(contentItems);

  if (canViewBusiness) {
    groups.push({
      label: 'Business',
      items: [
        { href: '/analytics', label: 'Analytics', icon: 'analytics' },
        { href: '/users', label: 'Learners', icon: 'users' },
        { href: '/subscriptions', label: 'Subscriptions', icon: 'subscriptions' },
      ],
    });
  }

  if (isSuperAdmin) {
    groups.push({
      label: 'Governance',
      items: [{ href: '/audit', label: 'Audit log', icon: 'audit' }],
    });
  }

  async function handleLogout() {
    setSigningOut(true);
    await logout();
    router.replace('/login');
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-sm">
          SM
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-slate-900">SmartMe</p>
          <p className="text-xs text-slate-500">Admin console</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  active={isActive(item)}
                  onClick={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              {admin?.name?.slice(0, 2).toUpperCase() ?? 'AD'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{admin?.name}</p>
              <p className="truncate text-xs text-slate-500">{admin?.email}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <Badge
              tone={
                admin?.role === 'SUPER_ADMIN'
                  ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20'
                  : admin?.role === 'ANALYST'
                    ? 'bg-sky-50 text-sky-700 ring-sky-600/20'
                    : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
              }
            >
              {roleLabel(admin?.role ?? '')}
            </Badge>
            <Button variant="ghost" size="xs" loading={signingOut} onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { session, loading } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      const next = encodeURIComponent(pathname || '/dashboard');
      router.replace(`/login?next=${next}`);
    }
  }, [loading, pathname, router, session]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          <Spinner className="h-4 w-4 text-indigo-600" />
          Restoring admin session…
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <SidebarContent onNavigate={() => undefined} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative h-full w-72 max-w-[85vw] border-r border-slate-200 bg-white shadow-xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Open navigation"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
            >
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-slate-900">SmartMe admin</span>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
