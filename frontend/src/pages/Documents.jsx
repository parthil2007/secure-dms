import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Files,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  FileUp,
  LayoutGrid,
  Rows3,
} from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { formatBytes, timeAgo } from '../lib/format.js';
import {
  Button,
  ConfidentialityBadge,
  EmptyState,
  ErrorBox,
  PageLoader,
  StatusBadge,
  TypeBadge,
} from '../components/ui.jsx';

const TYPES = [
  ['', 'All types'],
  ['evidence', 'Evidence'],
  ['court_order', 'Court order'],
  ['legal_filing', 'Legal filing'],
  ['statement', 'Statement'],
  ['report', 'Report'],
  ['photo', 'Photo'],
  ['video', 'Video'],
  ['audio', 'Audio'],
  ['correspondence', 'Correspondence'],
  ['other', 'Other'],
];

const STATUSES = [
  ['', 'All statuses'],
  ['stored', 'Stored'],
  ['pending_review', 'Pending review'],
  ['verified', 'Verified'],
  ['rejected', 'Tampered'],
  ['archived', 'Archived'],
];

const CONF = [
  ['', 'All classification'],
  ['public', 'Public'],
  ['internal', 'Internal'],
  ['confidential', 'Confidential'],
  ['restricted', 'Restricted'],
];

export default function Documents() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('grid');

  const q = params.get('q') || '';
  const type = params.get('type') || '';
  const status = params.get('status') || '';
  const confidentiality = params.get('confidentiality') || '';
  const caseId = params.get('caseId') || '';
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

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get('/documents', {
        params: {
          q,
          type,
          status,
          confidentiality,
          caseId,
          page,
          limit: 12,
        },
      });
      setData(res.data);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load documents'));
      setData({ documents: [], total: 0, page: 1, pages: 0 });
    }
  }, [q, type, status, confidentiality, caseId, page]);

  useEffect(() => {
    load();
  }, [load]);

  const hasFilters = q || type || status || confidentiality || caseId;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-600 dark:text-navy-400">
            Repository
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Document library
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {data
              ? `${data.total} document${data.total === 1 ? '' : 's'} indexed${
                  hasFilters ? ' matching your filters' : ''
                }`
              : 'Loading…'}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 dark:border-[#263354] dark:bg-[#121b31]">
            <button
              onClick={() => setView('grid')}
              className={`rounded-lg px-2.5 py-1.5 ${view === 'grid' ? 'bg-navy-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`rounded-lg px-2.5 py-1.5 ${view === 'list' ? 'bg-navy-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              title="List view"
            >
              <Rows3 className="h-4 w-4" />
            </button>
          </div>
          <Link to="/documents/upload">
            <Button>
              <FileUp className="h-4 w-4" /> Upload
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card space-y-3 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input-base !py-2 pl-9"
            placeholder="Search titles, descriptions, tags, file names or document numbers…"
            defaultValue={q}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setParam('q', e.currentTarget.value.trim());
            }}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            className="input-base !w-auto !py-2"
            value={type}
            onChange={(e) => setParam('type', e.target.value)}
          >
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>

          <select
            className="input-base !w-auto !py-2"
            value={status}
            onChange={(e) => setParam('status', e.target.value)}
          >
            {STATUSES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>

          <select
            className="input-base !w-auto !py-2"
            value={confidentiality}
            onChange={(e) => setParam('confidentiality', e.target.value)}
          >
            {CONF.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>

          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <ErrorBox onDismiss={() => setError('')}>{error}</ErrorBox> : null}

      {!data ? (
        <PageLoader label="Indexing repository…" />
      ) : data.documents.length === 0 ? (
        <EmptyState
          icon={Files}
          title={hasFilters ? 'No documents match these filters' : 'The repository is empty'}
          hint={
            hasFilters
              ? 'Try broadening your search criteria.'
              : 'Upload your first exhibit to begin building a tamper-evident chain of custody.'
          }
          action={
            hasFilters ? (
              <Button variant="secondary" className="mt-3" onClick={() => setParams({}, { replace: true })}>
                Reset filters
              </Button>
            ) : (
              <Link to="/documents/upload">
                <Button className="mt-3">
                  <Plus className="h-4 w-4" /> Upload evidence
                </Button>
              </Link>
            )
          }
        />
      ) : view === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.documents.map((d) => (
            <Link
              key={d.id}
              to={`/documents/${d.id}`}
              className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className="flex items-center justify-between gap-2">
                <TypeBadge type={d.docType} />
                <StatusBadge status={d.status} />
              </div>

              <h3 className="mt-3 line-clamp-2 flex-1 text-sm font-semibold text-slate-900 group-hover:text-navy-700 dark:text-white dark:group-hover:text-navy-300">
                {d.title}
              </h3>

              <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                {d.caseNumber ? `${d.caseNumber} — ${d.caseTitle || ''}` : 'Unfiled document'}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-[#263354]">
                <ConfidentialityBadge level={d.confidentiality} />
                <span className="ml-auto font-mono text-[11px] text-slate-400">{d.docNumber}</span>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>{formatBytes(d.sizeBytes)}</span>
                <span className="inline-flex items-center gap-1.5">
                  {d.uploadedByName || 'Unknown'} · {timeAgo(d.createdAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto scrollbar-thin">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-[#263354]">
                <th className="px-5 py-3 font-medium">Document</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Case</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Size</th>
                <th className="px-5 py-3 font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#263354]">
              {data.documents.map((d) => (
                <tr key={d.id} className="transition hover:bg-slate-50 dark:hover:bg-white/[.03]">
                  <td className="px-5 py-3">
                    <Link to={`/documents/${d.id}`} className="block">
                      <p className="font-medium text-slate-800 hover:text-navy-700 dark:text-slate-100">
                        {d.title}
                      </p>
                      <p className="font-mono text-[11px] text-slate-400">{d.docNumber}</p>
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <TypeBadge type={d.docType} />
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">{d.caseNumber || '—'}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">{formatBytes(d.sizeBytes)}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{timeAgo(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pages > 1 ? (
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
    </div>
  );
}
