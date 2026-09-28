import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Briefcase, Plus, Search, ChevronLeft, ChevronRight, Files, User2, Calendar } from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import {
  Button,
  EmptyState,
  ErrorBox,
  PageLoader,
  PriorityBadge,
  StatusBadge,
} from '../components/ui.jsx';

const STATUSES = ['', 'open', 'active', 'under_review', 'closed', 'archived'];
const PRIORITIES = ['', 'critical', 'high', 'medium', 'low'];

export default function Cases() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const q = params.get('q') || '';
  const status = params.get('status') || '';
  const priority = params.get('priority') || '';
  const page = Number(params.get('page') || 1);

  const setParam = useCallback(
    (key, value) => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      setParams(next, { replace: true });
    },
    [params, setParams]
  );

  const fetchCases = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get('/cases', {
        params: { q, status, priority, page, limit: 12 },
      });
      setData(data);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load cases'));
      setData({ cases: [], total: 0, page: 1, pages: 0 });
    }
  }, [q, status, priority, page]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-600 dark:text-navy-400">
            Caseload
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Cases</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data ? `${data.total} case${data.total === 1 ? '' : 's'} in the repository` : 'Loading…'}
          </p>
        </div>
        <Link to="/cases/create">
          <Button>
            <Plus className="h-4 w-4" /> New case
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input-base !py-2 pl-9"
            placeholder="Search by title, case number or description…"
            defaultValue={q}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setParam('q', e.currentTarget.value.trim());
            }}
          />
        </div>

        <select
          className="input-base !w-auto !py-2"
          value={status}
          onChange={(e) => setParam('status', e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s ? s.replace('_', ' ') : 'All statuses'}
            </option>
          ))}
        </select>

        <select
          className="input-base !w-auto !py-2"
          value={priority}
          onChange={(e) => setParam('priority', e.target.value)}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p ? p : 'All priorities'}
            </option>
          ))}
        </select>

        {q || status || priority ? (
          <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}>
            Clear
          </Button>
        ) : null}
      </div>

      {error ? <ErrorBox onDismiss={() => setError('')}>{error}</ErrorBox> : null}

      {!data ? (
        <PageLoader label="Loading cases…" />
      ) : data.cases.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No cases match your filters"
          hint="Adjust the search or create a new case to start tracking an investigation."
          action={
            <Link to="/cases/create">
              <Button className="mt-3">
                <Plus className="h-4 w-4" /> Create case
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.cases.map((c) => (
              <Link
                key={c.id}
                to={`/cases/${c.id}`}
                className="card group p-5 transition hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[11px] text-slate-400">{c.caseNumber}</span>
                  <PriorityBadge priority={c.priority} />
                </div>

                <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-navy-700 dark:text-white dark:group-hover:text-navy-300">
                  {c.title}
                </h3>
                {c.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{c.description}</p>
                ) : null}

                <div className="mt-3 flex items-center gap-2">
                  <StatusBadge status={c.status} />
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-500">
                    <Files className="h-3.5 w-3.5" />
                    {c.documentCount}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-[#263354]">
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <User2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{c.leadOfficerName || 'Unassigned'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(c.filingDate || c.createdAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {data.pages > 1 ? (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setParam('page', String(page - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <span className="text-sm text-slate-500">
                Page {data.page} of {data.pages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= data.pages}
                onClick={() => setParam('page', String(page + 1))}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
