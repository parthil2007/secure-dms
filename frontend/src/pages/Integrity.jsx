import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { formatDate, timeAgo } from '../lib/format.js';
import { Button, ErrorBox, PageLoader, Pill } from '../components/ui.jsx';

function Count({ label, value, tone = 'default' }) {
  const tones = {
    default: 'text-slate-900 dark:text-white',
    good: 'text-emerald-600 dark:text-emerald-400',
    bad: 'text-red-600 dark:text-red-400',
  };
  return (
    <div className="rounded-xl border border-slate-100 px-4 py-3 dark:border-[#263354]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

export default function Integrity() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const verify = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/integrity', { params: { deep: 'true' } });
      setData(res.data);
    } catch (err) {
      setError(errorMessage(err, 'Verification failed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verify();
  }, [verify]);

  if (loading && !data) return <PageLoader label="Verifying the hash chain…" />;

  const ok = Boolean(data?.ok);
  const issues = data?.issues || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Integrity</h1>
          <p className="text-sm text-slate-500">
            Tamper-evidence check across every stored document and its hash chain.
          </p>
        </div>
        <Button onClick={verify} loading={loading}>
          <RefreshCw className="h-4 w-4" /> Run deep verification
        </Button>
      </div>

      {error ? <ErrorBox onDismiss={() => setError('')}>{error}</ErrorBox> : null}

      {data ? (
        <>
          {/* Hero status card */}
          <div
            className={`card flex flex-wrap items-start gap-5 border-l-4 p-6 ${
              ok ? 'border-l-emerald-500' : 'border-l-red-500'
            }`}
          >
            <span
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                ok
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400'
              }`}
            >
              {ok ? <ShieldCheck className="h-7 w-7" /> : <ShieldAlert className="h-7 w-7" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {ok ? 'Chain intact — no tampering detected' : 'Tampering detected'}
                </h2>
                <Pill
                  className={
                    ok
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400'
                  }
                >
                  {ok ? 'Verified' : 'Action required'}
                </Pill>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {ok
                  ? 'Every document hash links correctly to its predecessor and no stored file has changed since registration.'
                  : `${issues.length} document${issues.length === 1 ? '' : 's'} failed the chain or file check. Review the list below.`}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Last verified {formatDate(data.verifiedAt, { withTime: true })}
                {data.verifiedAt ? ` (${timeAgo(data.verifiedAt)})` : ''}
              </p>
            </div>
          </div>

          {/* Counts */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Count label="Documents checked" value={data.checked ?? 0} />
            <Count label="Total documents" value={data.documentsTotal ?? 0} />
            <Count label="Files re-hashed" value={data.fileChecked ?? 0} />
            <Count
              label="Issues found"
              value={issues.length}
              tone={issues.length ? 'bad' : 'good'}
            />
          </div>

          {/* Helper text */}
          <div className="card p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-600/10 text-navy-600 dark:text-navy-300">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="text-sm text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  How the SHA-256 hash chain works
                </p>
                <p className="mt-1 leading-relaxed text-slate-500">
                  Every file is fingerprinted with SHA-256 when it enters the vault. Each new
                  document also stores <span className="font-mono text-xs">chainHash = SHA-256(prevChainHash + fileHash + docNumber)</span>,
                  linking it to the previous record. Verification recomputes those fingerprints from
                  the bytes on disk — if a single byte were altered, the hashes would diverge and the
                  break would surface here.
                </p>
              </div>
            </div>
          </div>

          {/* Issues */}
          {issues.length > 0 ? (
            <div className="card overflow-x-auto scrollbar-thin">
              <div className="px-5 pt-5">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Documents with issues ({issues.length})
                </h2>
              </div>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-[#263354]">
                    <th className="px-5 py-3 font-medium">Document</th>
                    <th className="px-3 py-3 font-medium">Chain</th>
                    <th className="px-3 py-3 font-medium">File</th>
                    <th className="px-3 py-3 font-medium">Stored hash</th>
                    <th className="px-5 py-3 font-medium">Expected hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#263354]">
                  {issues.map((issue) => (
                    <tr
                      key={issue.id}
                      className="transition hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      <td className="px-5 py-3">
                        <Link to={`/documents/${issue.id}`} className="block">
                          <span className="font-mono text-xs text-navy-600 dark:text-navy-300">
                            {issue.docNumber ?? '—'}
                          </span>
                          <span className="block truncate font-semibold text-slate-800 dark:text-slate-100">
                            {issue.title ?? '—'}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <Pill
                          className={
                            issue.chainValid
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400'
                          }
                        >
                          {issue.chainValid ? 'Valid' : 'Broken'}
                        </Pill>
                      </td>
                      <td className="px-3 py-3">
                        <Pill
                          className={
                            issue.fileValid === false
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                              : issue.fileValid === true
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'
                          }
                        >
                          {issue.fileValid === false
                            ? 'Changed'
                            : issue.fileValid === true
                              ? 'Match'
                              : 'Skipped'}
                        </Pill>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="block max-w-[12rem] truncate font-mono text-xs text-red-600 dark:text-red-400"
                          title={issue.storedChain || ''}
                        >
                          {issue.storedChain ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="block max-w-[12rem] truncate font-mono text-xs text-slate-500"
                          title={issue.expectedChain || ''}
                        >
                          {issue.expectedChain ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card flex items-center gap-3 p-5">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" />
              <p className="text-sm text-slate-600 dark:text-slate-300">
                No issues found. All {data.checked ?? 0} documents passed chain verification
                {data.fileChecked ? ` and ${data.fileChecked} files were re-hashed from disk` : ''}.
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
