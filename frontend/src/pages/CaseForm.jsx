import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { Button, ErrorBox, PageLoader, SectionTitle } from '../components/ui.jsx';

const CASE_TYPES = [
  ['criminal', 'Criminal'],
  ['civil', 'Civil'],
  ['cyber', 'Cyber'],
  ['financial', 'Financial'],
  ['corruption', 'Corruption'],
  ['narcotics', 'Narcotics'],
  ['other', 'Other'],
];

const STATUSES = [
  ['open', 'Open'],
  ['active', 'Active'],
  ['under_review', 'Under review'],
  ['closed', 'Closed'],
  ['archived', 'Archived'],
];

const PRIORITIES = [
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
  ['critical', 'Critical'],
];

const EMPTY = {
  title: '',
  description: '',
  caseType: 'criminal',
  status: 'open',
  priority: 'medium',
  leadOfficerId: '',
  agency: '',
  court: '',
  filingDate: '',
  dueDate: '',
};

export default function CaseForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/users')
      .then((res) => setUsers(res.data.users))
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    if (!editing) return;
    api
      .get(`/cases/${id}`)
      .then((res) => {
        const c = res.data.case;
        setForm({
          title: c.title || '',
          description: c.description || '',
          caseType: c.caseType || 'criminal',
          status: c.status || 'open',
          priority: c.priority || 'medium',
          leadOfficerId: c.leadOfficerId || '',
          agency: c.agency || '',
          court: c.court || '',
          filingDate: c.filingDate ? String(c.filingDate).slice(0, 10) : '',
          dueDate: c.dueDate ? String(c.dueDate).slice(0, 10) : '',
        });
      })
      .catch((err) => setError(errorMessage(err, 'Failed to load case')))
      .finally(() => setLoading(false));
  }, [editing, id]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        leadOfficerId: form.leadOfficerId ? Number(form.leadOfficerId) : undefined,
        filingDate: form.filingDate || undefined,
        dueDate: form.dueDate || undefined,
      };

      if (editing) {
        await api.put(`/cases/${id}`, payload);
        navigate(`/cases/${id}`);
      } else {
        const { data } = await api.post('/cases', payload);
        navigate(`/cases/${data.case.id}`);
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not save the case'));
      setSaving(false);
    }
  }

  if (loading) return <PageLoader label="Loading case…" />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          to={editing ? `/cases/${id}` : '/cases'}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-600 hover:underline dark:text-navy-400"
        >
          <ArrowLeft className="h-4 w-4" /> Back to {editing ? 'case' : 'cases'}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {editing ? 'Edit case' : 'Create a new case'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Cases group related evidence, statements and court documents together.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <ErrorBox onDismiss={() => setError('')}>{error}</ErrorBox>

        <section className="card space-y-4 p-5">
          <SectionTitle>Core details</SectionTitle>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Case title *
            </span>
            <input
              className="input-base"
              value={form.title}
              onChange={update('title')}
              placeholder="e.g. UPI Phishing Ring — Vishing Network"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Description / summary
            </span>
            <textarea
              className="input-base min-h-[110px] resize-y"
              value={form.description}
              onChange={update('description')}
              placeholder="What is this case about? Include FIR number, jurisdiction, key facts…"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Type
              </span>
              <select className="input-base" value={form.caseType} onChange={update('caseType')}>
                {CASE_TYPES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Status
              </span>
              <select className="input-base" value={form.status} onChange={update('status')}>
                {STATUSES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Priority
              </span>
              <select className="input-base" value={form.priority} onChange={update('priority')}>
                {PRIORITIES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <SectionTitle>Assignment &amp; jurisdiction</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Lead officer
              </span>
              <select
                className="input-base"
                value={form.leadOfficerId}
                onChange={update('leadOfficerId')}
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.role}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Investigating agency
              </span>
              <input
                className="input-base"
                value={form.agency}
                onChange={update('agency')}
                placeholder="e.g. Cyber Crime Unit"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Court
              </span>
              <input
                className="input-base"
                value={form.court}
                onChange={update('court')}
                placeholder="e.g. Sessions Court, Mumbai"
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Filing date
                </span>
                <input
                  type="date"
                  className="input-base"
                  value={form.filingDate}
                  onChange={update('filingDate')}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Due date
                </span>
                <input
                  type="date"
                  className="input-base"
                  value={form.dueDate}
                  onChange={update('dueDate')}
                />
              </label>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(editing ? `/cases/${id}` : '/cases')}
          >
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            <Save className="h-4 w-4" /> {editing ? 'Save changes' : 'Create case'}
          </Button>
        </div>
      </form>
    </div>
  );
}
