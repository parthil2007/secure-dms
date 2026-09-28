import { useCallback, useEffect, useState } from 'react';
import { Moon, Palette, Save, ShieldCheck, Sun, UserRound } from 'lucide-react';
import api, { errorMessage, loadPrefs, savePrefs } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Avatar,
  Button,
  ErrorBox,
  PageLoader,
  Pill,
  SuccessBox,
} from '../components/ui.jsx';

const TABS = [
  { key: 'profile', label: 'Profile', icon: UserRound },
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'account', label: 'Account', icon: ShieldCheck },
];

const EMPTY_FORM = {
  name: '',
  department: '',
  phone: '',
  badgeId: '',
  avatarColor: '#2f49d6',
  currentPassword: '',
  newPassword: '',
};

export default function Settings() {
  const { user, setUser } = useAuth();
  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dark, setDark] = useState(() => Boolean(loadPrefs().dark));

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/profile');
      const u = res.data?.user || {};
      setProfile(u);
      setForm({
        name: u.name || '',
        department: u.department || '',
        phone: u.phone || '',
        badgeId: u.badgeId || '',
        avatarColor: u.avatarColor || '#2f49d6',
        currentPassword: '',
        newPassword: '',
      });
    } catch (err) {
      setError(errorMessage(err, 'Could not load your profile'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggleDark = (value) => {
    setDark(value);
    document.documentElement.classList.toggle('dark', value);
    savePrefs({ ...loadPrefs(), dark: value });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        name: form.name,
        department: form.department,
        phone: form.phone,
        badgeId: form.badgeId,
        avatarColor: form.avatarColor,
      };
      // Only send password fields when the user actually typed them.
      if (form.newPassword) {
        payload.newPassword = form.newPassword;
        payload.currentPassword = form.currentPassword;
      }
      const res = await api.put('/profile', payload);
      const updated = res.data?.user || {};
      setProfile((p) => ({ ...(p || {}), ...updated }));
      setUser({ ...(user || {}), ...updated });
      setForm((f) => ({ ...f, currentPassword: '', newPassword: '' }));
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(errorMessage(err, 'Could not save your profile'));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !profile) return <PageLoader label="Loading settings…" />;

  const account = profile || user || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500">
          Manage your profile, appearance and account details.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === key
                ? 'bg-navy-600 text-white shadow-panel'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#263354] dark:bg-[#121b31] dark:text-slate-300 dark:hover:bg-white/5'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {error ? <ErrorBox onDismiss={() => setError('')}>{error}</ErrorBox> : null}
      {success ? <SuccessBox onDismiss={() => setSuccess('')}>{success}</SuccessBox> : null}

      {/* (a) Profile */}
      {tab === 'profile' ? (
        <form onSubmit={submit} className="card space-y-5 p-5">
          <div className="flex items-center gap-4">
            <Avatar name={form.name || account.name} color={form.avatarColor} size="h-14 w-14" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {form.name || account.name || '—'}
              </p>
              <p className="text-xs text-slate-500">{account.email ?? '—'}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Full name
              </label>
              <input value={form.name} onChange={set('name')} className="input-base" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Department
              </label>
              <input value={form.department} onChange={set('department')} className="input-base" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Phone
              </label>
              <input value={form.phone} onChange={set('phone')} className="input-base" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Badge ID
              </label>
              <input value={form.badgeId} onChange={set('badgeId')} className="input-base" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Avatar colour
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.avatarColor}
                  onChange={set('avatarColor')}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 dark:border-[#263354] dark:bg-[#121b31]"
                />
                <span className="font-mono text-xs text-slate-500">{form.avatarColor}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 dark:border-[#263354]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Change password
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Current password
                </label>
                <input
                  type="password"
                  value={form.currentPassword}
                  onChange={set('currentPassword')}
                  className="input-base"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  New password
                </label>
                <input
                  type="password"
                  value={form.newPassword}
                  onChange={set('newPassword')}
                  className="input-base"
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Leave both blank to keep your current password.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              <Save className="h-4 w-4" /> Save changes
            </Button>
          </div>
        </form>
      ) : null}

      {/* (b) Appearance */}
      {tab === 'appearance' ? (
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-600/10 text-navy-600 dark:text-navy-300">
                {dark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Dark mode
                </p>
                <p className="text-xs text-slate-500">
                  {dark ? 'Dark theme is active across the app.' : 'Light theme is active across the app.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={dark}
              onClick={() => toggleDark(!dark)}
              className={`relative h-7 w-[3.25rem] shrink-0 rounded-full transition ${
                dark ? 'bg-navy-600' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  dark ? 'left-[calc(100%-1.5rem)]' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => toggleDark(false)}
              className={`rounded-xl border p-4 text-left transition ${
                !dark
                  ? 'border-navy-600 ring-2 ring-navy-600/20'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-[#263354] dark:hover:bg-white/5'
              }`}
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <Sun className="h-4 w-4" /> Light
              </div>
              <div className="rounded-lg bg-[#f5f7fb] p-3">
                <div className="mb-2 h-2 w-1/3 rounded bg-slate-300" />
                <div className="mb-1.5 h-2 w-2/3 rounded bg-slate-300" />
                <div className="h-2 w-1/2 rounded bg-navy-600" />
              </div>
            </button>
            <button
              type="button"
              onClick={() => toggleDark(true)}
              className={`rounded-xl border p-4 text-left transition ${
                dark
                  ? 'border-navy-600 ring-2 ring-navy-600/20'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-[#263354] dark:hover:bg-white/5'
              }`}
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <Moon className="h-4 w-4" /> Dark
              </div>
              <div className="rounded-lg bg-[#070c1c] p-3">
                <div className="mb-2 h-2 w-1/3 rounded bg-slate-600" />
                <div className="mb-1.5 h-2 w-2/3 rounded bg-slate-600" />
                <div className="h-2 w-1/2 rounded bg-navy-500" />
              </div>
            </button>
          </div>
        </div>
      ) : null}

      {/* (c) Account info */}
      {tab === 'account' ? (
        <div className="card p-5">
          <div className="flex items-center gap-4">
            <Avatar name={account.name} color={account.avatarColor} size="h-14 w-14" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                {account.name ?? '—'}
              </p>
              <p className="truncate text-xs text-slate-500">{account.email ?? '—'}</p>
            </div>
            <Pill className="ml-auto bg-navy-600/10 capitalize text-navy-700 dark:text-navy-300">
              {account.role ?? '—'}
            </Pill>
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 px-4 py-3 dark:border-[#263354]">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Role
              </dt>
              <dd className="mt-1 text-sm font-medium capitalize text-slate-800 dark:text-slate-100">
                {(account.role ?? '—').replace(/_/g, ' ')}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-100 px-4 py-3 dark:border-[#263354]">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Badge ID
              </dt>
              <dd className="mt-1 font-mono text-sm text-slate-800 dark:text-slate-100">
                {account.badgeId ?? '—'}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-100 px-4 py-3 dark:border-[#263354]">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Member since
              </dt>
              <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">
                {formatDate(account.createdAt)}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-100 px-4 py-3 dark:border-[#263354]">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Last login
              </dt>
              <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">
                {formatDate(account.lastLogin, { withTime: true })}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
