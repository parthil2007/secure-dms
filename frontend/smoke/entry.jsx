/**
 * Headless render smoke test.
 *
 * Mounts every route of the app in jsdom, driving it against the LIVE backend
 * (http://localhost:5000) so every shape it reads is the real contract rather
 * than a hand-written fixture. Flags any render crash, thrown exception or
 * React error logged while a route is on screen.
 *
 * Run:  npm run smoke        (wraps this in `node --require ./smoke/preload.cjs`)
 */
import { JSDOM } from 'jsdom';

const API = process.env.SDMS_API || 'http://localhost:5000';
const EMAIL = process.env.SDMS_EMAIL || 'admin@secure-dms.gov.in';
const PASSWORD = process.env.SDMS_PASSWORD || 'SecureDms@2026';

/** Messages that are artefacts of having no real layout/browser, not app bugs. */
const IGNORED = [
  // recharts: jsdom reports 0x0 for every container (no layout engine)
  /width\(\d+\) and height\(\d+\) of chart should be greater than 0/,
  /add a minWidth\(0\) or minHeight/,
  // react-router v6 → v7 opt-in notices
  /React Router Future Flag Warning/,
];

/**
 * Each route must render ITS OWN page — matched against innerHTML so that
 * placeholder attributes count. Markers were chosen to be page-specific (not
 * labels that also appear in the sidebar nav).
 */
const EXPECT = {
  '/login': 'Recent uploads', // authenticated → redirects to /dashboard
  '/dashboard': 'Recent uploads',
  '/cases': 'Caseload',
  '/cases/create': 'e.g. UPI Phishing Ring',
  '/cases/1': 'Case metadata',
  '/cases/1/edit': 'Edit case',
  '/documents': 'Document library',
  '/documents/upload': 'e.g. Panchnama',
  '/documents/1': 'Integrity fingerprint',
  '/documents/1/versions': 'Upload new version',
  '/search?q=locker': 'Title, document number, tag',
  '/reports': 'Print / Export',
  '/sharing': 'New share',
  '/audit-trail': 'Search action, entity or user',
  '/integrity': 'Run deep verification',
  '/versions': 'View history',
  '/settings': 'Appearance',
  '/admin': 'Roles breakdown',
  '/totally-missing-route': 'Page not found',
};

/* ------------------------------------------------------------------ *
 * 1. Authenticate against the live backend                           *
 * ------------------------------------------------------------------ */
const loginRes = await fetch(`${API}/api/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!loginRes.ok) {
  console.error('Cannot reach the backend API — is it running on :5000?');
  process.exit(2);
}
const { token } = await loginRes.json();

/* ------------------------------------------------------------------ *
 * 2. Browser environment (normally pre-installed by smoke/preload.cjs)*
 * ------------------------------------------------------------------ */
const dom =
  globalThis.__sdmsDom ||
  new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost:5173/login',
    pretendToBeVisual: true,
  });
globalThis.__sdmsDom = dom;

const w = dom.window;
globalThis.window ??= w;
globalThis.document ??= w.document;
globalThis.localStorage ??= w.localStorage;
globalThis.HTMLElement ??= w.HTMLElement;
globalThis.HTMLInputElement ??= w.HTMLInputElement;
globalThis.Element ??= w.Element;
globalThis.Node ??= w.Node;
globalThis.getComputedStyle ??= w.getComputedStyle.bind(w);
globalThis.requestAnimationFrame ??= (cb) => setTimeout(() => cb(Date.now()), 16);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

/* ------------------------------------------------------------------ *
 * 3. Route every api.get() call to the live backend                  *
 * ------------------------------------------------------------------ */
const { default: api } = await import('../src/lib/api.js');

let calls = 0;
api.get = async (url, config = {}) => {
  calls += 1;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(config.params || {})) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  const res = await fetch(`${API}/api${url}${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `${res.status} ${url}`);
    err.response = { status: res.status, data: body };
    throw err;
  }
  return { data: body };
};

/* ------------------------------------------------------------------ *
 * 4. Render every route                                              *
 * ------------------------------------------------------------------ */
// Seed the session so AuthProvider hydrates the real user from /profile
// instead of bouncing every protected route to /login.
globalThis.localStorage.setItem('sdms_token', token);

const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { AuthProvider } = await import('../src/context/AuthContext.jsx');
const App = (await import('../src/App.jsx')).default;

const ROUTES = [
  '/login',
  '/dashboard',
  '/cases',
  '/cases/create',
  '/cases/1',
  '/cases/1/edit',
  '/documents',
  '/documents/upload',
  '/documents/1',
  '/documents/1/versions',
  '/search?q=locker',
  '/reports',
  '/sharing',
  '/audit-trail',
  '/integrity',
  '/versions',
  '/settings',
  '/admin',
  '/totally-missing-route',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let currentRoute = '';
const captured = [];

// Anything React logs as an error while a route is mounted counts against it.
const realError = console.error;
const realWarn = console.warn;
const record = (text) => captured.push({ route: currentRoute, text });
console.error = (...args) => {
  record(args.map(String).join(' '));
  realError(...args);
};
console.warn = (...args) => {
  record(args.map(String).join(' '));
  realWarn(...args);
};

for (const route of ROUTES) {
  currentRoute = route;
  captured.length = 0;

  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  const expected = EXPECT[route];

  let thrown = null;
  try {
    root.render(
      React.createElement(
        MemoryRouter,
        { initialEntries: [route] },
        React.createElement(AuthProvider, null, React.createElement(App))
      )
    );
    // let effects, fetches and re-renders settle
    await sleep(450);
    // Some pages need a second round-trip before their marker appears
    // (admin stats, report totals). Poll a little longer instead of failing
    // on a fixed timeout — a busy machine produced false FAILs otherwise.
    for (let i = 0; i < 6 && expected && !host.innerHTML.includes(expected); i++) {
      await sleep(400);
    }
  } catch (err) {
    thrown = err;
  }

  const html = host.innerHTML;
  let text = '';
  try {
    text = host.textContent || '';
  } catch {
    text = '';
  }

  try {
    root.unmount();
  } catch {
    /* ignore */
  }
  host.remove();

  const routeErrors = captured.filter(
    (c) => c.route === route && !IGNORED.some((re) => re.test(c.text))
  );
  const missing = expected && !html.includes(expected) ? expected : null;
  const failed = Boolean(thrown) || routeErrors.length > 0 || Boolean(missing);
  const reason = thrown
    ? String(thrown.message || thrown)
    : missing
      ? `expected content not found: "${missing}"`
      : routeErrors[0]?.text.slice(0, 300);

  results.push({
    route,
    ok: !failed,
    content: missing ? 'MISS' : 'ok',
    domBytes: html.length,
    textLen: text.trim().length,
    errors: routeErrors.length,
    reason,
  });
}

console.error = realError;
console.warn = realWarn;

/* ------------------------------------------------------------------ *
 * 5. Report                                                          *
 * ------------------------------------------------------------------ */
console.log(`\nRendered ${results.length} routes with ${calls} live API calls\n`);
console.log('route                      status   content   DOM      text');
console.log('────────────────────────── ──────── ───────── ──────── ─────');
for (const r of results) {
  const status = r.ok ? 'OK' : 'FAIL';
  console.log(
    `${r.route.padEnd(26)} ${status.padEnd(8)} ${r.content.padEnd(9)} ` +
      `${String(r.domBytes).padEnd(8)} ${r.textLen}` +
      (r.reason ? `\n      ↳ ${r.reason}` : '')
  );
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${failed.length === 0 ? 'ALL ROUTES RENDERED CLEANLY' : `${failed.length} ROUTE(S) FAILED`}`
);
process.exit(failed.length === 0 ? 0 : 1);
