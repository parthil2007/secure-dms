import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Files,
  UploadCloud,
  Search,
  BarChart3,
  Share2,
  History,
  ShieldCheck,
  GitBranch,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar } from './ui.jsx';
import { loadPrefs, savePrefs } from '../lib/api.js';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/cases', label: 'Cases', icon: Briefcase },
  { to: '/documents', label: 'Documents', icon: Files },
  { to: '/documents/upload', label: 'Upload Evidence', icon: UploadCloud },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/sharing', label: 'Sharing', icon: Share2 },
  { to: '/audit-trail', label: 'Audit Trail', icon: History },
  { to: '/integrity', label: 'Integrity', icon: ShieldCheck },
  { to: '/versions', label: 'Versions', icon: GitBranch },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dark, setDark] = useState(() => Boolean(loadPrefs().dark));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    savePrefs({ ...loadPrefs(), dark });
  }, [dark]);

  useEffect(() => {
    setSidebarOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  const submitSearch = (e) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const navItems = user?.role === 'admin' ? [...NAV, { to: '/admin', label: 'Administration', icon: Shield }] : NAV;

  return (
    <div className="min-h-screen bg-surface-light dark:bg-[#070c1c]">
      {/* Sidebar */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy-950 text-white transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <NavLink to="/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-600">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-bold tracking-tight">SecureDMS</span>
              <span className="block text-[10px] uppercase tracking-[0.18em] text-navy-300">
                Evidence Vault
              </span>
            </span>
          </NavLink>
          <button
            className="lg:hidden text-navy-300 hover:text-white"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin">
          <p className="px-3 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-navy-400">
            Workspace
          </p>
          <ul className="space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                      isActive
                        ? 'bg-navy-600 text-white shadow-panel'
                        : 'text-navy-200 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Avatar name={user?.name} color={user?.avatarColor} size="h-9 w-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{user?.name}</p>
              <p className="truncate text-[11px] capitalize text-navy-300">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="rounded-lg p-2 text-navy-300 transition hover:bg-white/10 hover:text-white"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-navy-950/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 dark:border-[#263354] dark:bg-[#0b1229]/90">
          <button
            className="lg:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <form onSubmit={submitSearch} className="relative hidden flex-1 max-w-md sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents, cases, people…"
              className="input-base !py-2 pl-9"
            />
          </form>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setDark((d) => !d)}
              className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-50 dark:border-[#263354] dark:bg-[#121b31] dark:text-slate-300"
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 transition hover:bg-slate-50 dark:border-[#263354] dark:bg-[#121b31] dark:hover:bg-white/5"
              >
                <Avatar name={user?.name} color={user?.avatarColor} size="h-7 w-7" />
                <span className="hidden text-xs font-medium text-slate-700 sm:block dark:text-slate-200">
                  {user?.name?.split(' ')[0]}
                </span>
              </button>

              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel dark:border-[#263354] dark:bg-[#121b31]">
                  <div className="border-b border-slate-100 px-4 py-3 dark:border-[#263354]">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {user?.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => navigate('/settings')}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                  >
                    Profile settings
                  </button>
                  <button
                    onClick={logout}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-50/40"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
