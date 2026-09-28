import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Plus, Share2, XCircle } from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import {
  Button,
  EmptyState,
  ErrorBox,
  Modal,
  PageLoader,
  Pill,
  SuccessBox,
  TypeBadge,
} from '../components/ui.jsx';

const EMPTY_FORM = {
  documentId: '',
  email: '',
  permission: 'view',
  message: '',
  expiresAt: '',
};

const PERMISSION_META = {
  view: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  download: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  edit: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
};

/** Active / expired / revoked visual state for a share row. */
function ShareState({ share }) {
  let label = 'Inactive';
  let color = 'bg-slate-500/10 text-slate-600 dark:text-slate-300';
  if (share.revokedAt) {
    label = 'Revoked';
    color = 'bg-red-500/10 text-red-600 dark:text-red-400';
  } else if (share.expired) {
    label = 'Expired';
    color = 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
  } else if (share.active) {
    label = 'Active';
    color = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  }
  return <Pill className={color}>{label}</Pill>;
}

export default function Sharing() {
  const [shares, setShares] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const fetchShares = useCallback(async () => {
    setError('');
    try {
      const res = await api.get('/shares');
      setShares(res.data?.shares || []);
    } catch (err) {
      setError(errorMessage(err, 'Could not load shares'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await api.get('/documents', { params: { limit: 100, sort: 'title' } });
      setDocuments(res.data?.documents || []);
    } catch {
      // The picker degrades gracefully — the form still validates the id.
    }
  }, []);

  useEffect(() => {
    fetchShares();
    fetchDocuments();
  }, [fetchShares, fetchDocuments]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const createShare = async (e) => {
    e.preventDefault();
    if (!form.documentId) {
      setError('Choose a document to share');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        documentId: Number(form.documentId),
        email: form.email.trim(),
        permission: form.permission,
      };
      if (form.message.trim()) payload.message = form.message.trim();
      if (form.expiresAt) payload.expiresAt = form.expiresAt;

      await api.post('/shares', payload);
      setSuccess(`Share created for ${payload.email}`);
      setForm(EMPTY_FORM);
      setOpen(false);
      fetchShares();
    } catch (err) {
      setError(errorMessage(err, 'Could not create the share'));
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (share) => {
    const who = share.sharedWithEmail || share.email || 'this recipient';
    if (!window.confirm(`Revoke access for ${who}? They will immediately lose access.`)) return;
    setBusyId(share.id);
    setError('');
    setSuccess('');
    try {
      await api.delete(`/shares/${share.id}`);
      setSuccess('Share revoked');
      fetchShares();
    } catch (err) {
      setError(errorMessage(err, 'Could not revoke the share'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <PageLoader label="Loading shares…" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Sharing</h1>
          <p className="text-sm text-slate-500">
            Control who can view, download or edit your documents — and revoke access at any time.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New share
        </Button>
      </div>

      {error ? <ErrorBox onDismiss={() => setError('')}>{error}</ErrorBox> : null}
      {success ? <SuccessBox onDismiss={() => setSuccess('')}>{success}</SuccessBox> : null}

      {shares.length === 0 ? (
        <EmptyState
          icon={Share2}
          title="No shares yet"
          hint="Share a document with a colleague and their access will appear here."
          action={
            <Button className="mt-2" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New share
            </Button>
          }
        />
      ) : (
        <div className="card overflow-x-auto scrollbar-thin">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-[#263354]">
                <th className="px-5 py-3 font-medium">Document</th>
                <th className="px-3 py-3 font-medium">Shared with</th>
                <th className="px-3 py-3 font-medium">By</th>
                <th className="px-3 py-3 font-medium">Expires</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#263354]">
              {shares.map((share) => (
                <tr key={share.id} className="transition hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="px-5 py-3">
                    {share.documentId ? (
                      <Link to={`/documents/${share.documentId}`} className="block">
                        <span className="font-mono text-xs text-navy-600 dark:text-navy-300">
                          {share.docNumber ?? '—'}
                        </span>
                        <span className="block truncate font-semibold text-slate-800 dark:text-slate-100">
                          {share.documentTitle ?? '—'}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {share.caseNumber
                            ? `${share.caseNumber} · ${share.caseTitle ?? ''}`
                            : 'No linked case'}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <TypeBadge type={share.docType} />
                      <Pill className={PERMISSION_META[share.permission] || PERMISSION_META.view}>
                        {(share.permission || 'view').replace(/_/g, ' ')}
                      </Pill>
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                      {share.sharedWithEmail ?? share.email ?? '—'}
                    </p>
                    {share.message ? (
                      <p className="mt-0.5 max-w-[16rem] truncate text-xs text-slate-500" title={share.message}>
                        {share.message}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                    {share.sharedByName ?? '—'}
                  </td>
                  <td className="px-3 py-3 text-slate-500">
                    {share.expiresAt ? formatDate(share.expiresAt, { withTime: true }) : 'Never'}
                  </td>
                  <td className="px-3 py-3">
                    <ShareState share={share} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="danger"
                      size="sm"
                      loading={busyId === share.id}
                      disabled={Boolean(share.revokedAt)}
                      onClick={() => revoke(share)}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Share a document"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button form="share-form" type="submit" loading={saving}>
              <Link2 className="h-4 w-4" /> Create share
            </Button>
          </>
        }
      >
        <form id="share-form" onSubmit={createShare} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Document
            </label>
            <select
              value={form.documentId}
              onChange={set('documentId')}
              className="input-base"
              required
            >
              <option value="">Select a document…</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.docNumber} — {doc.title}
                </option>
              ))}
            </select>
            {documents.length === 0 ? (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                No documents loaded — try refreshing the page.
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Recipient email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              className="input-base"
              placeholder="officer@agency.gov"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Permission
            </label>
            <select value={form.permission} onChange={set('permission')} className="input-base">
              <option value="view">View only</option>
              <option value="download">View &amp; download</option>
              <option value="edit">Edit</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Message <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              value={form.message}
              onChange={set('message')}
              className="input-base min-h-[80px]"
              placeholder="Why are you sharing this?"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Expires at <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={set('expiresAt')}
              className="input-base"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
