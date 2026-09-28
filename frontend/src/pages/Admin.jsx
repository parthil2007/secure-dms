import { useCallback, useEffect, useState } from 'react';
import {
  Database,
  HardDrive,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { formatBytes, formatDate, timeAgo } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorBox,
  PageLoader,
  Pill,
  SuccessBox,
} from '../components/ui.jsx';

const ROLES = ['admin', 'investigator', 'analyst', 'prosecutor', 'viewer'];

function Kpi({ label, value, hint, icon: Icon }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-navy-600 dark:text-navy-300" />
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/users'),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data?.users || []);
    } catch (err) {
      setError(errorMessage(err, 'Could not load administration data'));
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Administration</h1>
          <p className="text-sm text-slate-500">User and system management for SecureDMS.</p>
        </div>
        <EmptyState
          icon={Shield}
          title="Administration is restricted"
          hint="Your account does not have the administrator role. Contact a system administrator if you need access."
        />
      </div>
    );
  }

  if (loading && !stats) return <PageLoader label="Loading administration…" />;

  const update = async (id, payload, okMessage) => {
    setBusyId(id);
    setError('');
    setSuccess('');
    try {
      const res = await api.put(`/users/${id}`, payload);
      const updated = res.data?.user || {};
      setUsers((list) =>
        list.map((u) =>
          u.id === id
            ? {
                ...u,
                role: updated.role ?? u.role,
                isActive: updated.isActive ?? u.isActive,
                department: updated.department ?? u.department,
              }
            : u
        )
      );
      if (okMessage) setSuccess(okMessage);
    } catch (err) {
      setError(errorMessage(err, 'Update failed'));
      fetchData();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete ${u.name}'s account? This cannot be undone.`)) return;
    setDeletingId(u.id);
    setError('');
    setSuccess('');
    try {
      await api.delete(`/users/${u.id}`);
      setUsers((list) => list.filter((x) => x.id !== u.id));
      setSuccess(`${u.name} was deleted`);
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the user'));
    } finally {
      setDeletingId(null);
    }
  };

  const s = stats || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Administration</h1>
        <p className="text-sm text-slate-500">
          Manage roles, account status and storage across SecureDMS.
        </p>
      </div>

      {error ? <ErrorBox onDismiss={() => setError('')}>{error}</ErrorBox> : null}
      {success ? <SuccessBox onDismiss={() => setSuccess('')}>{success}</SuccessBox> : null}

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total users" value={s.users?.total ?? 0} hint={`${s.users?.newThisMonth ?? 0} new this month`} icon={Users} />
        <Kpi label="Active accounts" value={s.users?.active ?? 0} hint={`${s.users?.activeWeek ?? 0} active this week`} icon={UserCheck} />
        <Kpi label="Inactive accounts" value={s.users?.inactive ?? 0} hint="Deactivated or dormant" icon={Shield} />
        <Kpi label="Stored files" value={s.storage?.fileCount ?? 0} hint={formatBytes(s.storage?.totalBytes)} icon={HardDrive} />
        <Kpi label="Storage used" value={formatBytes(s.storage?.totalBytes)} hint="All document revisions" icon={HardDrive} />
        <Kpi label="Database size" value={s.storage?.databasePretty ?? '—'} hint="PostgreSQL data + indexes" icon={Database} />
        <Kpi label="New this month" value={s.users?.newThisMonth ?? 0} hint="Registered accounts" icon={UserPlus} />
        <Kpi label="Roles in use" value={(s.roles || []).length} hint="Permission groups" icon={Shield} />
      </div>

      {/* Roles breakdown */}
      <div className="card p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Roles breakdown
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(s.roles || []).map((r) => (
            <div
              key={r.role}
              className="rounded-xl border border-slate-100 px-4 py-3 dark:border-[#263354]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {r.role}
              </p>
              <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{r.count}</p>
            </div>
          ))}
          {(s.roles || []).length === 0 ? (
            <p className="text-sm text-slate-500">No roles on record.</p>
          ) : null}
        </div>
      </div>

      {/* Users management */}
      <div className="card overflow-x-auto scrollbar-thin">
        <div className="px-5 pt-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Users ({users.length})
          </h2>
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-[#263354]">
              <th className="px-5 py-3 font-medium">User</th>
              <th className="px-3 py-3 font-medium">Role</th>
              <th className="px-3 py-3 font-medium">Department</th>
              <th className="px-3 py-3 font-medium">Docs</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Last login</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#263354]">
            {users.map((u) => {
              const isSelf = u.id === user?.id;
              return (
                <tr key={u.id} className="transition hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} color={u.avatarColor} size="h-9 w-9" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
                          {u.name ?? '—'}
                          {isSelf ? (
                            <span className="ml-1.5 text-[10px] uppercase text-navy-600 dark:text-navy-300">
                              (you)
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-slate-500">{u.email ?? '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={u.role || ''}
                      onChange={(e) => update(u.id, { role: e.target.value }, `Role updated for ${u.name}`)}
                      disabled={busyId === u.id}
                      className="input-base !w-40 !py-1.5 text-xs"
                      aria-label={`Role for ${u.name}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3 text-slate-500">{u.department ?? '—'}</td>
                  <td className="px-3 py-3 font-medium text-slate-700 dark:text-slate-200">
                    {u.documentCount ?? 0}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() =>
                        update(u.id, { isActive: !u.isActive }, `${u.name} ${u.isActive ? 'deactivated' : 'activated'}`)
                      }
                      disabled={busyId === u.id}
                      title={u.isActive ? 'Click to deactivate' : 'Click to activate'}
                    >
                      <Pill
                        className={
                          u.isActive
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'
                        }
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </Pill>
                    </button>
                  </td>
                  <td className="px-3 py-3 text-slate-500">
                    {u.lastLogin ? (
                      <span title={formatDate(u.lastLogin, { withTime: true })}>
                        {timeAgo(u.lastLogin)}
                      </span>
                    ) : (
                      'Never'
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={isSelf}
                      loading={deletingId === u.id}
                      title={isSelf ? 'You cannot delete your own account' : 'Delete user'}
                      onClick={() => remove(u)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-500">
                  No users found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
