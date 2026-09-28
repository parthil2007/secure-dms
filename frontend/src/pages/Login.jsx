import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, FileLock2, History, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, ErrorBox, Pill } from '../components/ui.jsx';
import { errorMessage } from '../lib/api.js';

const DEMO = [
  { role: 'Administrator', email: 'admin@secure-dms.gov.in' },
  { role: 'Investigator', email: 'investigator@secure-dms.gov.in' },
  { role: 'Analyst', email: 'analyst@secure-dms.gov.in' },
  { role: 'Prosecutor', email: 'prosecutor@secure-dms.gov.in' },
];

const FEATURES = [
  {
    icon: FileLock2,
    title: 'Tamper-evident vault',
    text: 'Every upload is sealed with a SHA-256 hash and chained to the previous record.',
  },
  {
    icon: History,
    title: 'Immutable chain of custody',
    text: 'Collection, transfer, revision and verification events are logged for life.',
  },
  {
    icon: KeyRound,
    title: 'Role-based access',
    text: 'Investigators, analysts, prosecutors and admins each see only what they should.',
  },
];

export default function Login() {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
  });

  if (loading) return null;
  if (user) return <Navigate to={location.state?.from || '/dashboard'} replace />;

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register({
          name: form.name,
          email: form.email,
          password: form.password,
          department: form.department || undefined,
        });
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Unable to continue'));
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo(email) {
    setMode('login');
    setForm({ name: '', email, password: 'SecureDms@2026', department: '' });
  }

  return (
    <div className="min-h-screen bg-navy-950 lg:grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(700px 400px at 15% 0%, rgba(68,99,240,.35), transparent 65%), radial-gradient(600px 500px at 90% 90%, rgba(47,73,214,.28), transparent 60%)',
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-navy-600 shadow-panel">
              <ShieldCheck className="h-6 w-6 text-white" />
            </span>
            <div>
              <p className="text-lg font-bold text-white">SecureDMS</p>
              <p className="text-[11px] uppercase tracking-[0.22em] text-navy-300">
                Evidence &amp; Legal Documents
              </p>
            </div>
          </div>

          <h1 className="mt-16 max-w-md text-4xl font-bold leading-tight text-white">
            The chain of custody, cryptographically proven.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-navy-200">
            A secure digital document management system for investigation files, court orders and
            forensic evidence — built for tamper detection, auditability and zero-trust access.
          </p>

          <div className="mt-10 space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-navy-200">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-navy-300">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-navy-400">
          SIH 26190 · Smart India Hackathon · Secure Digital Document Management System
        </p>
      </div>

      {/* Form panel */}
      <div className="flex min-h-screen items-center justify-center bg-white px-6 py-12 dark:bg-[#070c1c]">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-600">
              <ShieldCheck className="h-5 w-5 text-white" />
            </span>
            <div>
              <p className="font-bold text-slate-900 dark:text-white">SecureDMS</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Evidence Vault
              </p>
            </div>
          </div>

          <div className="mb-6 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-[#121b31]">
            {['login', 'register'].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError('');
                }}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mode === m
                    ? 'bg-white text-navy-700 shadow-sm dark:bg-navy-600 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {mode === 'login' ? 'Welcome back' : 'Request access'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'login'
              ? 'Authenticate to open the evidence vault.'
              : 'Provision a new officer account for the repository.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <ErrorBox onDismiss={() => setError('')}>{error}</ErrorBox>

            {mode === 'register' && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Full name
                </span>
                <input
                  className="input-base"
                  value={form.name}
                  onChange={update('name')}
                  placeholder="e.g. Ananya Iyer"
                  required
                />
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Official email
              </span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  className="input-base !pl-9"
                  value={form.email}
                  onChange={update('email')}
                  placeholder="you@secure-dms.gov.in"
                  required
                  autoComplete="username"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Password
              </span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-base !pl-9 !pr-10"
                  value={form.password}
                  onChange={update('password')}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {mode === 'register' && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Department <span className="text-slate-400">(optional)</span>
                </span>
                <input
                  className="input-base"
                  value={form.department}
                  onChange={update('department')}
                  placeholder="e.g. Cyber Crime Unit"
                />
              </label>
            )}

            <Button type="submit" loading={submitting} className="w-full" size="lg">
              {mode === 'login' ? 'Sign in securely' : 'Create my account'}
            </Button>
          </form>

          {mode === 'login' && (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-4 dark:border-[#263354]">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-navy-600" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Demo credentials
                </p>
                <Pill className="ml-auto bg-navy-600/10 text-navy-700 dark:text-navy-300">
                  password: SecureDms@2026
                </Pill>
              </div>
              <div className="grid gap-1.5">
                {DEMO.map((d) => (
                  <button
                    key={d.email}
                    onClick={() => fillDemo(d.email)}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-left text-xs transition hover:bg-navy-50 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    <span className="font-mono text-slate-600 dark:text-slate-300">{d.email}</span>
                    <span className="font-medium text-navy-600 dark:text-navy-300">
                      {d.role} →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
