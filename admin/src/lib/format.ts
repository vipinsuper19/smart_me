export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const ranges: { limit: number; unit: Intl.RelativeTimeFormatUnit; divisor: number }[] = [
    { limit: 60, unit: 'second', divisor: 1 },
    { limit: 3600, unit: 'minute', divisor: 60 },
    { limit: 86_400, unit: 'hour', divisor: 3600 },
    { limit: 604_800, unit: 'day', divisor: 86_400 },
    { limit: 2_419_200, unit: 'week', divisor: 604_800 },
    { limit: 31_536_000, unit: 'month', divisor: 2_629_800 },
  ];

  const absolute = Math.abs(diffSeconds);
  for (const range of ranges) {
    if (absolute < range.limit) {
      return formatter.format(Math.round(diffSeconds / range.divisor), range.unit);
    }
  }
  return formatter.format(Math.round(diffSeconds / 31_536_000), 'year');
}

export function titleCase(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function roleLabel(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super admin';
    case 'CONTENT_EDITOR':
      return 'Content editor';
    case 'ANALYST':
      return 'Analyst';
    default:
      return titleCase(role);
  }
}

export function formatPaise(value: number | null | undefined, currency = 'INR'): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${value.toFixed(digits)}%`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) {
    return '—';
  }
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes === 0) {
    return `${remaining}s`;
  }
  return `${minutes}m ${remaining.toString().padStart(2, '0')}s`;
}

export function truncate(value: string | null | undefined, max = 90): string {
  if (!value) {
    return '—';
  }
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function prettyJson(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return JSON.stringify(value, null, 2);
}

export function statusTone(status: string): string {
  switch (status) {
    case 'PUBLISHED':
    case 'ACTIVE':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
    case 'IN_REVIEW':
    case 'PENDING':
    case 'GRACE_PERIOD':
      return 'bg-amber-50 text-amber-700 ring-amber-600/20';
    case 'DRAFT':
      return 'bg-slate-100 text-slate-700 ring-slate-500/20';
    case 'ARCHIVED':
    case 'EXPIRED':
    case 'CANCELED':
    case 'REFUNDED':
    case 'SUSPENDED':
    case 'DELETED':
      return 'bg-rose-50 text-rose-700 ring-rose-600/20';
    default:
      return 'bg-indigo-50 text-indigo-700 ring-indigo-600/20';
  }
}

export function actionLabel(action: string): string {
  return titleCase(
    action.replace(
      /_(CREATED|UPDATED|DELETED|PUBLISHED|ARCHIVED|SUBMITTED|REORDERED|LOGGED_IN|LOGGED_OUT)/g,
      ' $1',
    ),
  );
}

export function isoDateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}
