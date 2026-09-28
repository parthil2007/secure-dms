import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  Briefcase,
  CheckCircle2,
  Database,
  Download,
  Files,
  Printer,
  RefreshCw,
  Share2,
  ShieldAlert,
  Users,
} from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { formatBytes, formatDate, STATUS_META } from '../lib/format.js';
import {
  Avatar,
  Button,
  ErrorBox,
  PageLoader,
  PriorityBadge,
  SectionTitle,
  StatusBadge,
} from '../components/ui.jsx';

const CHART_COLORS = [
  '#2f49d6',
  '#4464f0',
  '#8b5cf6',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
];

const AXIS_FILL = '#94a3b8';
const TOOLTIP_STYLE = {
  backgroundColor: '#0b1229',
  border: 'none',
  borderRadius: 12,
  color: '#e8edf7',
  fontSize: 12,
};

function Kpi({ label, value, hint, icon: Icon }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <Icon className="h-4 w-4 shrink-0 text-navy-600 dark:text-navy-300" />
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/reports');
      setData(res.data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load the report'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  if (loading && !data) return <PageLoader label="Compiling report…" />;

  if (error && !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Reports</h1>
          <p className="text-sm text-slate-500">Operational statistics for the evidence vault.</p>
        </div>
        <ErrorBox onDismiss={() => setError('')}>{error}</ErrorBox>
        <Button variant="secondary" onClick={fetchReports}>
          Try again
        </Button>
      </div>
    );
  }

  const o = data?.overview || {};
  const integrity = data?.integrity || [];
  const confidentiality = data?.confidentiality || [];

  const integrityLabel = (status) => STATUS_META[status]?.label || status || '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Reports</h1>
          <p className="text-sm text-slate-500">
            Operational statistics for the evidence vault
            {data?.generatedAt ? ` · generated ${formatDate(data.generatedAt, { withTime: true })}` : ''}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="secondary" onClick={fetchReports} loading={loading}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print / Export
          </Button>
        </div>
      </div>

      {error ? <ErrorBox onDismiss={() => setError('')}>{error}</ErrorBox> : null}

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Documents" value={o.documents ?? 0} hint={`${o.last7Days ?? 0} added this week`} icon={Files} />
        <Kpi label="Cases" value={o.cases ?? 0} hint={`${o.last30Days ?? 0} documents in 30 days`} icon={Briefcase} />
        <Kpi label="Users" value={o.users ?? 0} hint={`${o.shares ?? 0} active shares`} icon={Users} />
        <Kpi label="Storage used" value={formatBytes(o.storageBytes)} hint="All stored revisions" icon={Database} />
        <Kpi label="Verified" value={o.verified ?? 0} hint="Chain & file checks passed" icon={CheckCircle2} />
        <Kpi label="Tampering flags" value={o.rejected ?? 0} hint="Requires investigation" icon={ShieldAlert} />
        <Kpi label="Active shares" value={o.shares ?? 0} hint="Not revoked" icon={Share2} />
        <Kpi label="New in 30 days" value={o.last30Days ?? 0} hint={`${o.last7Days ?? 0} in the last 7 days`} icon={BarChart3} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <SectionTitle>Documents added per month</SectionTitle>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.documentsByMonth || []} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.25)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: AXIS_FILL, fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: AXIS_FILL, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(47,73,214,.08)' }} />
                <Bar dataKey="count" name="Documents" fill="#2f49d6" radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <SectionTitle>Cases by type</SectionTitle>
          <div className="h-72 w-full">
            {(data?.casesByType || []).length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">
                No case data yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.casesByType}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={2}
                  >
                    {data.casesByType.map((entry, index) => (
                      <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: 11, color: AXIS_FILL }}
                    formatter={(value) => String(value).replace(/_/g, ' ')}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card overflow-x-auto scrollbar-thin">
          <div className="px-5 pt-5">
            <SectionTitle>Busiest cases</SectionTitle>
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-[#263354]">
                <th className="px-5 py-3 font-medium">Case</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Priority</th>
                <th className="px-3 py-3 text-right font-medium">Docs</th>
                <th className="px-5 py-3 text-right font-medium">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#263354]">
              {(data?.topCases || []).map((c) => (
                <tr key={c.id} className="transition hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="px-5 py-3">
                    <Link to={`/cases/${c.id}`} className="block">
                      <span className="font-mono text-xs text-navy-600 dark:text-navy-300">
                        {c.caseNumber ?? '—'}
                      </span>
                      <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {c.title ?? '—'}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-3 py-3">
                    <PriorityBadge priority={c.priority} />
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-slate-700 dark:text-slate-200">
                    {c.documentCount ?? 0}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-500">{formatBytes(c.sizeBytes)}</td>
                </tr>
              ))}
              {(data?.topCases || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-500">
                    No cases yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="card overflow-x-auto scrollbar-thin">
          <div className="px-5 pt-5">
            <SectionTitle>Top contributing officers</SectionTitle>
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-[#263354]">
                <th className="px-5 py-3 font-medium">Officer</th>
                <th className="px-3 py-3 font-medium">Role</th>
                <th className="px-3 py-3 font-medium">Department</th>
                <th className="px-5 py-3 text-right font-medium">Documents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#263354]">
              {(data?.officers || []).map((u) => (
                <tr key={u.id} className="transition hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} color={u.avatarColor} size="h-8 w-8" />
                      <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                        {u.name ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 capitalize text-slate-600 dark:text-slate-300">
                    {u.role ?? '—'}
                  </td>
                  <td className="px-3 py-3 text-slate-500">{u.department ?? '—'}</td>
                  <td className="px-5 py-3 text-right font-medium text-slate-700 dark:text-slate-200">
                    {u.documentCount ?? 0}
                  </td>
                </tr>
              ))}
              {(data?.officers || []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-sm text-slate-500">
                    No officers on record.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Integrity + confidentiality breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <SectionTitle>Document integrity</SectionTitle>
          <ul className="space-y-2">
            {integrity.map((row) => (
              <li
                key={row.status}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-2.5 dark:border-[#263354]"
              >
                <StatusBadge status={row.status} />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {row.count ?? 0}{' '}
                  <span className="font-normal text-slate-500">({integrityLabel(row.status)})</span>
                </span>
              </li>
            ))}
            {integrity.length === 0 ? (
              <li className="text-sm text-slate-500">No documents to classify yet.</li>
            ) : null}
          </ul>
        </div>

        <div className="card p-5">
          <SectionTitle>Confidentiality mix</SectionTitle>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-[#263354]">
                  <th className="py-2 font-medium">Level</th>
                  <th className="py-2 text-right font-medium">Documents</th>
                  <th className="py-2 text-right font-medium">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#263354]">
                {confidentiality.map((row) => (
                  <tr key={row.label}>
                    <td className="py-2.5 capitalize text-slate-700 dark:text-slate-200">
                      {row.label ?? '—'}
                    </td>
                    <td className="py-2.5 text-right text-slate-600 dark:text-slate-300">
                      {row.count ?? 0}
                    </td>
                    <td className="py-2.5 text-right text-slate-500">{formatBytes(row.sizeBytes)}</td>
                  </tr>
                ))}
                {confidentiality.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-sm text-slate-500">
                      No documents yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="no-print flex justify-end">
        <Button variant="secondary" onClick={() => window.print()}>
          <Download className="h-4 w-4" /> Export this report
        </Button>
      </div>
    </div>
  );
}
