import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Files,
  Briefcase,
  HardDrive,
  ShieldCheck,
  Clock,
  Users,
  ArrowRight,
  Activity,
  FileUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import api, { errorMessage } from '../lib/api.js';
import { formatBytes, timeAgo, STATUS_META } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Avatar,
  CardSkeleton,
  ErrorBox,
  PageLoader,
  SectionTitle,
  StatusBadge,
  TypeBadge,
} from '../components/ui.jsx';

const PIE_COLORS = ['#2f49d6', '#0f766e', '#7c3aed', '#b45309', '#be123c', '#0369a1', '#475569'];

function StatCard({ icon: Icon, label, value, hint, accent = 'bg-navy-600' }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white ${accent}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function ChartCard({ title, action, children, className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <SectionTitle action={action}>{title}</SectionTitle>
      {children}
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  fontSize: 12,
  boxShadow: '0 8px 24px -12px rgba(16,24,40,.18)',
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [s, c] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/dashboard/charts'),
        ]);
        if (!mounted) return;
        setStats(s.data);
        setCharts(c.data);
      } catch (err) {
        if (mounted) setError(errorMessage(err, 'Failed to load dashboard'));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading && !stats) return <PageLoader label="Loading dashboard…" />;

  const t = stats?.totals || {};
  const storageByType = (stats?.storageByType || [])
    .filter((r) => r.sizeBytes > 0)
    .slice(0, 6)
    .map((r) => ({ name: r.type.replace('_', ' '), value: r.sizeBytes }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-600 dark:text-navy-400">
            Overview
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            {user?.name?.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Here is what is happening across the evidence repository.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/documents/upload"
            className="inline-flex items-center gap-2 rounded-xl bg-navy-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-navy-700"
          >
            <FileUp className="h-4 w-4" /> Upload evidence
          </Link>
          <Link
            to="/integrity"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-[#263354] dark:bg-[#121b31] dark:text-slate-200"
          >
            <ShieldCheck className="h-4 w-4" /> Verify integrity
          </Link>
        </div>
      </div>

      {error ? <ErrorBox>{error}</ErrorBox> : null}

      {/* KPIs */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <CardSkeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Files}
            label="Documents"
            value={t.documents ?? 0}
            hint={`${stats?.newDocumentsWeek ?? 0} added this week`}
            accent="bg-navy-600"
          />
          <StatCard
            icon={Briefcase}
            label="Active cases"
            value={t.activeCases ?? 0}
            hint={`${t.cases ?? 0} cases in total`}
            accent="bg-emerald-600"
          />
          <StatCard
            icon={ShieldCheck}
            label="Verified files"
            value={t.verified ?? 0}
            hint={`${t.pendingReview ?? 0} awaiting review`}
            accent="bg-violet-600"
          />
          <StatCard
            icon={HardDrive}
            label="Storage used"
            value={formatBytes(stats?.storageUsed)}
            hint={`${t.users ?? 0} officers · ${t.shares ?? 0} active shares`}
            accent="bg-amber-500"
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Documents added (last 12 months)" className="lg:col-span-2">
          {charts ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={charts.documentsOverTime} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="docs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2f49d6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2f49d6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="count" name="Documents" stroke="#2f49d6" strokeWidth={2.5} fill="url(#docs)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <CardSkeleton className="h-[240px]" />
          )}
        </ChartCard>

        <ChartCard title="Documents by type">
          {stats ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={stats.byType}
                  dataKey="count"
                  nameKey="type"
                  innerRadius={54}
                  outerRadius={82}
                  paddingAngle={2}
                >
                  {stats.byType.map((entry, i) => (
                    <Cell key={entry.type} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>
                      {String(value).replace('_', ' ')}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <CardSkeleton className="h-[240px]" />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent activity */}
        <div className="card p-5 lg:col-span-2">
          <SectionTitle
            action={
              <Link
                to="/audit-trail"
                className="inline-flex items-center gap-1 text-xs font-medium text-navy-600 hover:underline dark:text-navy-400"
              >
                Full audit trail <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            Recent activity
          </SectionTitle>

          {stats ? (
            <ul className="divide-y divide-slate-100 dark:divide-[#263354]">
              {stats.recentActivity.length === 0 ? (
                <li className="py-8 text-center text-sm text-slate-500">No activity yet.</li>
              ) : (
                stats.recentActivity.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-600/10 text-navy-600 dark:text-navy-400">
                      <Activity className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-700 dark:text-slate-200">
                        <span className="font-semibold">{a.userName || 'system'}</span>{' '}
                        <span className="text-navy-600 dark:text-navy-400">
                          {a.action.replace(/_/g, ' ').toLowerCase()}
                        </span>
                        {a.entityName ? <> — {a.entityName}</> : null}
                      </p>
                      <p className="text-xs text-slate-400">{timeAgo(a.createdAt)}</p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          ) : (
            <CardSkeleton className="h-40" />
          )}
        </div>

        {/* Case status + storage */}
        <div className="space-y-4">
          <div className="card p-5">
            <SectionTitle>Case status</SectionTitle>
            {stats ? (
              <ul className="space-y-2.5">
                {stats.caseStatus.length === 0 ? (
                  <li className="text-sm text-slate-500">No cases yet.</li>
                ) : (
                  stats.caseStatus.map((c) => (
                    <li key={c.status} className="flex items-center justify-between">
                      <StatusBadge status={c.status} />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {c.count}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            ) : (
              <CardSkeleton className="h-32" />
            )}
            <Link
              to="/cases"
              className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-navy-600 hover:underline dark:text-navy-400"
            >
              Manage cases <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <ChartCard title="Storage by type">
            {charts ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={storageByType} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatBytes(v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatBytes(v)} />
                  <Bar dataKey="value" fill="#2f49d6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <CardSkeleton className="h-[180px]" />
            )}
          </ChartCard>
        </div>
      </div>

      {/* Latest documents */}
      <div className="card p-5">
        <SectionTitle
          action={
            <Link
              to="/documents"
              className="inline-flex items-center gap-1 text-xs font-medium text-navy-600 hover:underline dark:text-navy-400"
            >
              All documents <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          Recent uploads
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <RecentDocs />
        </div>
      </div>
    </div>
  );
}

function RecentDocs() {
  const [docs, setDocs] = useState(null);

  useEffect(() => {
    api
      .get('/documents', { params: { limit: 6, sort: 'recent' } })
      .then((res) => setDocs(res.data.documents))
      .catch(() => setDocs([]));
  }, []);

  if (!docs) {
    return (
      <>
        {[...Array(3)].map((_, i) => (
          <CardSkeleton key={i} className="h-24" />
        ))}
      </>
    );
  }

  if (docs.length === 0) {
    return <p className="text-sm text-slate-500">No documents uploaded yet.</p>;
  }

  return docs.slice(0, 6).map((d) => (
    <Link
      key={d.id}
      to={`/documents/${d.id}`}
      className="rounded-xl border border-slate-200 p-4 transition hover:border-navy-400 hover:shadow-card dark:border-[#263354]"
    >
      <div className="flex items-center justify-between gap-2">
        <TypeBadge type={d.docType} />
        <StatusBadge status={d.status} />
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
        {d.title}
      </p>
      <p className="mt-0.5 font-mono text-[11px] text-slate-400">{d.docNumber}</p>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
        <Users className="h-3 w-3" />
        <span className="truncate">{d.uploadedByName || 'Unknown'}</span>
        <span className="ml-auto inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeAgo(d.createdAt)}
        </span>
      </div>
    </Link>
  ));
}
