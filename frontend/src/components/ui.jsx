import { Loader2 } from 'lucide-react';
import {
  STATUS_META,
  DOC_TYPE_META,
  PRIORITY_META,
  CONFIDENTIALITY_META,
} from '../lib/format.js';

/** Pill used by every badge on the site. */
export function Pill({ className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status || '—', color: 'bg-slate-100 text-slate-600' };
  return <Pill className={meta.color}>{meta.label}</Pill>;
}

export function TypeBadge({ type }) {
  const meta = DOC_TYPE_META[type] || DOC_TYPE_META.other;
  return <Pill className={meta.color}>{meta.label}</Pill>;
}

export function PriorityBadge({ priority }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.medium;
  return <Pill className={meta.color}>{meta.label}</Pill>;
}

export function ConfidentialityBadge({ level }) {
  const meta = CONFIDENTIALITY_META[level] || CONFIDENTIALITY_META.internal;
  return <Pill className={meta.color}>{meta.label}</Pill>;
}

/** Full-page / inline loading spinner. */
export function Spinner({ className = 'h-6 w-6' }) {
  return <Loader2 className={`animate-spin text-navy-600 ${className}`} />;
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-500">
      <Spinner className="h-8 w-8" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function CardSkeleton({ className = 'h-28' }) {
  return <div className={`skeleton ${className}`} />;
}

/** Friendly empty state with an optional call to action. */
export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {Icon ? (
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-50 text-navy-600 dark:bg-navy-950/60">
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      {hint ? <p className="max-w-sm text-sm text-slate-500">{hint}</p> : null}
      {action}
    </div>
  );
}

/** Inline error banner. */
export function ErrorBox({ children, onDismiss }) {
  if (!children) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-50/40 dark:text-red-400">
      <span>{children}</span>
      {onDismiss ? (
        <button onClick={onDismiss} className="font-medium underline opacity-70 hover:opacity-100">
          dismiss
        </button>
      ) : null}
    </div>
  );
}

/** Success banner. */
export function SuccessBox({ children, onDismiss }) {
  if (!children) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-300/30 dark:bg-emerald-50/40 dark:text-emerald-300">
      <span>{children}</span>
      {onDismiss ? (
        <button onClick={onDismiss} className="font-medium underline opacity-70 hover:opacity-100">
          dismiss
        </button>
      ) : null}
    </div>
  );
}

/** Modal dialog. */
export function Modal({ open, onClose, title, children, footer, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-navy-950/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`card relative z-10 max-h-[85vh] w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} overflow-y-auto scrollbar-thin animate-fadeUp`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#263354]">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-[#263354]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Primary / secondary / danger buttons. */
export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  children,
  ...rest
}) {
  const variants = {
    primary: 'bg-navy-600 text-white hover:bg-navy-700 disabled:bg-navy-300',
    secondary:
      'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#263354] dark:bg-[#121b31] dark:text-slate-200 dark:hover:bg-white/5',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
    ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-sm',
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-70 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

/** Avatar with initials. */
export function Avatar({ name = '', color = '#2f49d6', size = 'h-9 w-9', className = '' }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${size} ${className}`}
      style={{ backgroundColor: color }}
    >
      {initials || '?'}
    </span>
  );
}

/** Section heading used across detail pages. */
export function SectionTitle({ children, action }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {children}
      </h2>
      {action}
    </div>
  );
}
