import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Briefcase, Files, Search as SearchIcon, Users } from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { formatBytes, formatDate } from '../lib/format.js';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorBox,
  PageLoader,
  Pill,
  PriorityBadge,
  StatusBadge,
  TypeBadge,
} from '../components/ui.jsx';

const TABS = [
  { key: 'all', label: 'All results' },
  { key: 'documents', label: 'Documents' },
  { key: 'cases', label: 'Cases' },
  { key: 'users', label: 'People' },
];

/** One grouped result section (Documents / Cases / People). */
function Group({ title, icon: Icon, count, children }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-navy-600 dark:text-navy-300" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {title}
        </h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
          {count}
        </span>
      </div>
      <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-[#263354]">
        {children}
      </div>
    </section>
  );
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';

  const [input, setInput] = useState(query);
  const [type, setType] = useState('all');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setInput(query);
  }, [query]);

  const fetchResults = useCallback(async () => {
    if (!query.trim()) {
      setResults(null);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/search', { params: { q: query, type } });
      setResults(res.data);
    } catch (err) {
      setResults(null);
      setError(errorMessage(err, 'Search failed'));
    } finally {
      setLoading(false);
    }
  }, [query, type]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const submit = (e) => {
    e.preventDefault();
    const next = input.trim();
    setParams(next ? { q: next } : {});
  };

  const docs = results?.documents || [];
  const cases = results?.cases || [];
  const people = results?.users || [];
  const total = results ? docs.length + cases.length + people.length : 0;

  const counts = {
    all: total,
    documents: docs.length,
    cases: cases.length,
    users: people.length,
  };

  const showDocs = type === 'all' || type === 'documents';
  const showCases = type === 'all' || type === 'cases';
  const showUsers = type === 'all' || type === 'users';
  const empty = Boolean(results) && !loading && total === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Search</h1>
        <p className="text-sm text-slate-500">
          Search documents, cases and people across the evidence vault.
        </p>
      </div>

      {/* Search box + type tabs */}
      <div className="card p-5">
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Title, document number, tag, case number, email…"
              className="input-base pl-9"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit">Search</Button>
            {query ? (
              <Button variant="secondary" type="button" onClick={() => setParams({})}>
                Clear
              </Button>
            ) : null}
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setType(tab.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                type === tab.key
                  ? 'bg-navy-600 text-white shadow-panel'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#263354] dark:bg-[#121b31] dark:text-slate-300 dark:hover:bg-white/5'
              }`}
            >
              {tab.label}
              {results ? (
                <span className="ml-1.5 opacity-70">{counts[tab.key] ?? 0}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {error ? <ErrorBox onDismiss={() => setError('')}>{error}</ErrorBox> : null}

      {loading ? <PageLoader label="Searching…" /> : null}

      {!loading && !query ? (
        <EmptyState
          icon={SearchIcon}
          title="Start typing to search the vault"
          hint="Try a document number, case title, officer name or an email address."
        />
      ) : null}

      {!loading && empty ? (
        <EmptyState
          icon={SearchIcon}
          title={`No results for “${query}”`}
          hint="Check the spelling, try a shorter keyword, or switch the filter tabs above."
        />
      ) : null}

      {!loading && results && total > 0 ? (
        <div className="space-y-6">
          {showDocs && docs.length > 0 ? (
            <Group title="Documents" icon={Files} count={docs.length}>
              {docs.map((doc) => (
                <Link
                  key={doc.id}
                  to={`/documents/${doc.id}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      <span className="font-mono text-xs text-navy-600 dark:text-navy-300">
                        {doc.docNumber ?? '—'}
                      </span>{' '}
                      · {doc.title ?? 'Untitled'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {doc.caseNumber
                        ? `${doc.caseNumber} · ${doc.caseTitle ?? ''}`
                        : 'No linked case'}{' '}
                      · {formatBytes(doc.sizeBytes)} · {formatDate(doc.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <TypeBadge type={doc.docType} />
                    <StatusBadge status={doc.status} />
                  </div>
                </Link>
              ))}
            </Group>
          ) : null}

          {showCases && cases.length > 0 ? (
            <Group title="Cases" icon={Briefcase} count={cases.length}>
              {cases.map((item) => (
                <Link
                  key={item.id}
                  to={`/cases/${item.id}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      <span className="font-mono text-xs text-navy-600 dark:text-navy-300">
                        {item.caseNumber ?? '—'}
                      </span>{' '}
                      · {item.title ?? 'Untitled'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Pill className="bg-navy-600/10 text-navy-700 dark:text-navy-300">
                      {(item.caseType || 'other').replace(/_/g, ' ')}
                    </Pill>
                    <StatusBadge status={item.status} />
                    <PriorityBadge priority={item.priority} />
                  </div>
                </Link>
              ))}
            </Group>
          ) : null}

          {showUsers && people.length > 0 ? (
            <Group title="People" icon={Users} count={people.length}>
              {people.map((person) => (
                <div key={person.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={person.name} color={person.avatarColor} size="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {person.name ?? '—'}
                    </p>
                    <p className="truncate text-xs text-slate-500">{person.email ?? '—'}</p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    <Pill className="bg-slate-500/10 text-slate-600 dark:text-slate-300">
                      {(person.role || '').replace(/_/g, ' ')}
                    </Pill>
                    <Pill className="bg-navy-600/10 text-navy-700 dark:text-navy-300">
                      {person.department || '—'}
                    </Pill>
                  </div>
                </div>
              ))}
            </Group>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
