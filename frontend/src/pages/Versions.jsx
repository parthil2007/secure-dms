import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, History, Search as SearchIcon } from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { formatBytes, formatDate } from '../lib/format.js';
import {
  Button,
  EmptyState,
  ErrorBox,
  PageLoader,
  StatusBadge,
  TypeBadge,
} from '../components/ui.jsx';

export default function Versions() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/documents', { params: { limit: 100, sort: 'recent' } });
      setDocuments(res.data?.documents || []);
    } catch (err) {
      setError(errorMessage(err, 'Could not load documents'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? documents.filter(
          (doc) =>
            (doc.title || '').toLowerCase().includes(q) ||
            (doc.docNumber || '').toLowerCase().includes(q) ||
            (doc.caseNumber || '').toLowerCase().includes(q) ||
            (doc.caseTitle || '').toLowerCase().includes(q)
        )
      : documents;
    return [...list].sort(
      (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    );
  }, [documents, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Versions</h1>
        <p className="text-sm text-slate-500">
          Revision history across the library — jump into any document to see every stored version.
        </p>
      </div>

      <div className="card p-5">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by title, document number or case…"
            className="input-base pl-9"
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Showing {filtered.length} of {documents.length} document
          {documents.length === 1 ? '' : 's'}
        </p>
      </div>

      {error ? <ErrorBox onDismiss={() => setError('')}>{error}</ErrorBox> : null}

      {loading ? <PageLoader label="Loading documents…" /> : null}

      {!loading && filtered.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title={query ? 'No documents match your filter' : 'No documents yet'}
          hint={
            query
              ? 'Try a different keyword or clear the filter.'
              : 'Upload evidence to start tracking versions.'
          }
          action={
            query ? (
              <Button variant="secondary" className="mt-2" onClick={() => setQuery('')}>
                Clear filter
              </Button>
            ) : null
          }
        />
      ) : null}

      {!loading && filtered.length > 0 ? (
        <div className="card overflow-x-auto scrollbar-thin">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-[#263354]">
                <th className="px-5 py-3 font-medium">Document</th>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Version</th>
                <th className="px-3 py-3 font-medium">Updated</th>
                <th className="px-5 py-3 text-right font-medium">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#263354]">
              {filtered.map((doc) => (
                <tr key={doc.id} className="transition hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="px-5 py-3">
                    <Link to={`/documents/${doc.id}`} className="block">
                      <span className="font-mono text-xs text-navy-600 dark:text-navy-300">
                        {doc.docNumber ?? '—'}
                      </span>
                      <span className="block truncate font-semibold text-slate-800 dark:text-slate-100">
                        {doc.title ?? '—'}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {doc.caseNumber
                          ? `${doc.caseNumber} · ${doc.caseTitle ?? ''}`
                          : 'No linked case'}
                        {' · '}
                        {formatBytes(doc.sizeBytes)}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <TypeBadge type={doc.docType} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={doc.status} />
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-lg bg-navy-600/10 px-2 py-1 font-mono text-xs font-semibold text-navy-700 dark:text-navy-300">
                      v{doc.version ?? 1}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-500">
                    {formatDate(doc.updatedAt, { withTime: true })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/documents/${doc.id}/versions`}>
                      <Button variant="secondary" size="sm">
                        <History className="h-3.5 w-3.5" /> View history
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
