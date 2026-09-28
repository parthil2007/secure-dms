import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, History, Search as SearchIcon } from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { formatDate, timeAgo } from '../lib/format.js';
import { Button, EmptyState, ErrorBox, PageLoader, Pill } from '../components/ui.jsx';

const LIMIT = 25;

/** Small colour cue per audit action family. */
function actionColor(action = '') {
  const a = action.toUpperCase();
  if (a.includes('DELETE') || a.includes('TAMPER') || a.includes('REJECT')) {
    return 'bg-red-500/10 text-red-600 dark:text-red-400';
  }
  if (a.includes('VERIFY') || a.includes('LOGIN')) {
    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  }
  if (a.includes('UPLOAD') || a.includes('CREATE') || a.includes('REGISTER')) {
    return 'bg-navy-600/10 text-navy-700 dark:text-navy-300';
  }
  if (a.includes('UPDATE') || a.includes('EDIT') || a.includes('REVOK') || a.includes('SHARE')) {
    return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
  }
  return 'bg-slate-500/10 text-slate-600 dark:text-slate-300';
}

function detailsText(details) {
  if (!details) return '—';
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details);
  } catch {
    return '—';
  }
}

export default function AuditTrail() {
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/audit-logs', {
        params: { q: applied, action, entityType: '', page, limit: LIMIT },
      });
      setData(res.data);
    } catch (err) {
      setData(null);
      setError(errorMessage(err, 'Could not load the audit trail'));
    } finally {
      setLoading(false);
    }
  }, [applied, action, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const submit = (e) => {
    e.preventDefault();
    setPage(1);
    setApplied(q.trim());
  };

  const logs = data?.logs || [];
  const pages = Math.max(1, data?.pages || 1);
  const total = data?.total || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Audit Trail</h1>
        <p className="text-sm text-slate-500">
          Every action recorded in the system — immutable, timestamped and attributable.
        </p>
      </div>

      {/* Filters */}
      <div className="card p-5">
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search action, entity or user…"
              className="input-base pl-9"
            />
          </div>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="input-base sm:w-64"
          >
            <option value="">All actions</option>
            {(data?.actions || []).map((item) => (
              <option key={item.action} value={item.action}>
                {item.action} ({item.count})
              </option>
            ))}
          </select>
          <Button type="submit">Apply</Button>
        </form>
        {total ? (
          <p className="mt-3 text-xs text-slate-500">
            {total} matching event{total === 1 ? '' : 's'}
          </p>
        ) : null}
      </div>

      {error ? <ErrorBox onDismiss={() => setError('')}>{error}</ErrorBox> : null}

      {loading ? <PageLoader label="Loading audit trail…" /> : null}

      {!loading && !error && logs.length === 0 ? (
        <EmptyState
          icon={History}
          title="No audit events found"
          hint="Try clearing the search box or selecting a different action filter."
        />
      ) : null}

      {!loading && logs.length > 0 ? (
        <>
          <div className="card overflow-x-auto scrollbar-thin">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-[#263354]">
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-3 py-3 font-medium">Entity</th>
                  <th className="px-3 py-3 font-medium">User</th>
                  <th className="px-3 py-3 font-medium">Details</th>
                  <th className="px-3 py-3 font-medium">IP</th>
                  <th className="px-5 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#263354]">
                {logs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="px-5 py-3">
                      <Pill className={actionColor(log.action)}>
                        {log.action ?? '—'}
                      </Pill>
                    </td>
                    <td className="px-3 py-3">
                      <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                        {log.entityName ?? '—'}
                      </p>
                      <p className="text-xs capitalize text-slate-500">
                        {log.entityType ?? '—'} · #{log.entityId ?? '—'}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                      {log.userName ?? '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className="block max-w-[18rem] truncate font-mono text-xs text-slate-500"
                        title={detailsText(log.details)}
                      >
                        {detailsText(log.details)}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-500">
                      {log.ipAddress ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="block text-slate-700 dark:text-slate-200"
                        title={formatDate(log.createdAt, { withTime: true })}
                      >
                        {formatDate(log.createdAt, { withTime: true })}
                      </span>
                      <span className="text-xs text-slate-500">{timeAgo(log.createdAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Showing {logs.length} of {total} event{total === 1 ? '' : 's'}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Page {data?.page ?? page} of {pages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
