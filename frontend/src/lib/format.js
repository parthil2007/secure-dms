/** Formatting helpers shared across pages. */

export function formatBytes(bytes = 0) {
  const n = Number(bytes) || 0;
  if (n === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const value = n / 1024 ** i;
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function formatDate(value, { withTime = false } = {}) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function timeAgo(value) {
  if (!value) return '';
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export const DOC_TYPE_META = {
  evidence: { label: 'Evidence', color: 'bg-navy-600/10 text-navy-700 dark:text-navy-300' },
  court_order: { label: 'Court Order', color: 'bg-violet-500/10 text-violet-700 dark:text-violet-400' },
  legal_filing: { label: 'Legal Filing', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  statement: { label: 'Statement', color: 'bg-amber-500/10 text-amber-800 dark:text-amber-400' },
  report: { label: 'Report', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  photo: { label: 'Photo', color: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400' },
  video: { label: 'Video', color: 'bg-rose-500/10 text-rose-700 dark:text-rose-400' },
  audio: { label: 'Audio', color: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400' },
  correspondence: { label: 'Correspondence', color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300' },
  financial: { label: 'Financial', color: 'bg-teal-500/10 text-teal-700 dark:text-teal-400' },
  other: { label: 'Other', color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300' },
};

export const STATUS_META = {
  stored: { label: 'Stored', color: 'bg-slate-100 text-slate-700 dark:bg-slate-200/70 dark:text-slate-300' },
  pending_review: { label: 'Pending review', color: 'bg-amber-50 text-amber-800 dark:bg-amber-50/70 dark:text-amber-400' },
  verified: { label: 'Verified', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-50/70 dark:text-emerald-400' },
  rejected: { label: 'Tampered', color: 'bg-red-50 text-red-700 dark:bg-red-50/70 dark:text-red-400' },
  archived: { label: 'Archived', color: 'bg-slate-100 text-slate-600 dark:bg-slate-200/70 dark:text-slate-400' },
  open: { label: 'Open', color: 'bg-blue-500/10 text-blue-700 dark:bg-blue-600/10 dark:text-blue-400' },
  active: { label: 'Active', color: 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
  under_review: { label: 'Under review', color: 'bg-amber-500/10 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400' },
  closed: { label: 'Closed', color: 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400' },
};

export const PRIORITY_META = {
  critical: { label: 'Critical', color: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  high: { label: 'High', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  medium: { label: 'Medium', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  low: { label: 'Low', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
};

export const CONFIDENTIALITY_META = {
  public: { label: 'Public', color: 'bg-emerald-500/10 text-emerald-700' },
  internal: { label: 'Internal', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  confidential: { label: 'Confidential', color: 'bg-amber-500/10 text-amber-800 dark:text-amber-400' },
  restricted: { label: 'Restricted', color: 'bg-red-500/10 text-red-700 dark:text-red-400' },
};
