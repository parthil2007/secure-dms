import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  ShieldCheck,
  ShieldAlert,
  Pencil,
  Trash2,
  GitBranch,
  Share2,
  History,
  RefreshCw,
  Copy,
  Lock,
  MapPin,
  Calendar,
  User2,
} from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { formatDate, formatBytes, timeAgo } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Button,
  ConfidentialityBadge,
  ErrorBox,
  Modal,
  PageLoader,
  SectionTitle,
  StatusBadge,
  SuccessBox,
  TypeBadge,
} from '../components/ui.jsx';

const TABS = [
  ['overview', 'Overview'],
  ['versions', 'Versions'],
  ['custody', 'Chain of custody'],
  ['activity', 'Activity'],
];

function InfoRow({ icon: Icon, label, value, mono = false }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className={`truncate text-sm text-slate-700 dark:text-slate-200 ${mono ? 'font-mono text-xs' : ''}`}>
          {value || '—'}
        </p>
      </div>
    </div>
  );
}

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/documents/${id}`);
      setData(res.data);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Failed to load document'));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function download() {
    try {
      const res = await api.get(`/documents/${id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.document.originalName || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNotice('Download logged to the audit trail.');
    } catch (err) {
      setError(errorMessage(err, 'Download failed'));
    }
  }

  async function verify() {
    setVerifying(true);
    try {
      const res = await api.post(`/documents/${id}/verify`);
      setVerifyResult(res.data);
      await load();
      setNotice(
        res.data.intact
          ? 'Integrity verified — file hash and custody chain both match.'
          : 'Integrity check FAILED. This document has been flagged as tampered.'
      );
    } catch (err) {
      setError(errorMessage(err, 'Verification failed'));
    } finally {
      setVerifying(false);
    }
  }

  async function removeDoc() {
    setBusy(true);
    try {
      await api.delete(`/documents/${id}`);
      navigate('/documents');
    } catch (err) {
      setError(errorMessage(err, 'Could not delete document'));
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  function copyHash(hash) {
    if (!hash) return;
    navigator.clipboard?.writeText(hash);
    setNotice('SHA-256 hash copied to clipboard.');
  }

  if (!data && !error) return <PageLoader label="Opening secure document…" />;

  if (!data) {
    return (
      <div className="space-y-4">
        <ErrorBox>{error}</ErrorBox>
        <Link to="/documents">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" /> Back to library
          </Button>
        </Link>
      </div>
    );
  }

  const d = data.document;
  const canDelete = user?.id === d.uploadedBy || user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/documents"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-600 hover:underline dark:text-navy-400"
          >
            <ArrowLeft className="h-4 w-4" /> Document library
          </Link>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-400">{d.docNumber}</span>
            <TypeBadge type={d.docType} />
            <StatusBadge status={d.status} />
            <ConfidentialityBadge level={d.confidentiality} />
          </div>

          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {d.title}
          </h1>
          {d.description ? (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {d.description}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={download}>
            <Download className="h-4 w-4" /> Download
          </Button>
          <Button onClick={verify} loading={verifying}>
            <ShieldCheck className="h-4 w-4" /> Verify integrity
          </Button>
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          {canDelete ? (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {notice ? <SuccessBox onDismiss={() => setNotice('')}>{notice}</SuccessBox> : null}
      {error ? <ErrorBox onDismiss={() => setError('')}>{error}</ErrorBox> : null}

      {verifyResult ? (
        <div
          className={`flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-4 text-sm ${
            verifyResult.intact
              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-50/40 dark:text-emerald-300'
              : 'border-red-200 bg-red-50/70 text-red-700 dark:border-red-400/30 dark:bg-red-50/40 dark:text-red-400'
          }`}
        >
          {verifyResult.intact ? (
            <ShieldCheck className="h-5 w-5 shrink-0" />
          ) : (
            <ShieldAlert className="h-5 w-5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-semibold">
              {verifyResult.intact ? 'Document is intact' : 'Tampering detected'}
            </p>
            <p className="text-xs opacity-80">
              File hash {verifyResult.fileValid === null ? 'unavailable (missing file)' : verifyResult.fileValid ? 'matches' : 'does NOT match'} ·
              custody chain {verifyResult.chainValid ? 'valid' : 'BROKEN'}
            </p>
          </div>
          <button
            onClick={() => setVerifyResult(null)}
            className="ml-auto text-xs underline opacity-70 hover:opacity-100"
          >
            dismiss
          </button>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-[#263354]">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition ${
              tab === key
                ? 'text-navy-700 dark:text-navy-300'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            {label}
            {tab === key ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-navy-600" />
            ) : null}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="card p-5">
              <SectionTitle
                action={
                  <button
                    onClick={() => copyHash(d.hashSha256)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-navy-600 hover:underline dark:text-navy-400"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                }
              >
                Integrity fingerprint
              </SectionTitle>

              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">
                    SHA-256 content hash
                  </p>
                  <p className="break-all rounded-xl bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700 dark:bg-white/5 dark:text-slate-300">
                    {d.hashSha256 || 'Not hashed yet'}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">
                      Previous link
                    </p>
                    <p className="break-all rounded-xl bg-slate-50 p-3 font-mono text-[11px] text-slate-600 dark:bg-white/5 dark:text-slate-400">
                      {d.prevHash || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">
                      Chain hash
                    </p>
                    <p className="break-all rounded-xl bg-navy-600/5 p-3 font-mono text-[11px] text-navy-700 dark:bg-navy-600/10 dark:text-navy-300">
                      {d.chainHash || '—'}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  The chain hash is <code className="font-mono">SHA256(prev | content | docNumber)</code>,
                  so editing either the file or the register entry breaks verification for every
                  later document too.
                </p>
              </div>
            </div>

            <div className="card p-5">
              <SectionTitle>File details</SectionTitle>
              <div className="divide-y divide-slate-100 dark:divide-[#263354]">
                <InfoRow icon={File2Icon} label="File name" value={d.originalName} mono />
                <InfoRow icon={GitBranch} label="Current version" value={`v${d.version}`} />
                <InfoRow icon={Calendar} label="Uploaded" value={formatDate(d.createdAt, { withTime: true })} />
                <InfoRow icon={RefreshCw} label="Last updated" value={timeAgo(d.updatedAt)} />
                <InfoRow icon={User2} label="Uploaded by" value={d.uploadedByName} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card p-5">
              <SectionTitle>Properties</SectionTitle>
              <div className="divide-y divide-slate-100 dark:divide-[#263354]">
                <InfoRow
                  icon={Lock}
                  label="Classification"
                  value={<ConfidentialityBadge level={d.confidentiality} />}
                />
                <InfoRow icon={MapPin} label="Source" value={d.source} />
                <InfoRow icon={MapPin} label="Collection location" value={d.location} />
                <InfoRow icon={Calendar} label="Collected at" value={formatDate(d.collectedAt)} />
                <InfoRow
                  icon={History}
                  label="Size"
                  value={`${formatBytes(d.sizeBytes)} · ${d.mimeType}`}
                />
              </div>
            </div>

            <div className="card p-5">
              <SectionTitle>Case linkage</SectionTitle>
              {d.caseId ? (
                <Link
                  to={`/cases/${d.caseId}`}
                  className="block rounded-xl border border-slate-200 p-3 transition hover:border-navy-400 dark:border-[#263354]"
                >
                  <p className="font-mono text-[11px] text-slate-400">{d.caseNumber}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {d.caseTitle}
                  </p>
                </Link>
              ) : (
                <p className="text-sm text-slate-500">Not linked to a case.</p>
              )}
            </div>

            {d.tags?.length ? (
              <div className="card p-5">
                <SectionTitle>Tags</SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  {d.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-white/10 dark:text-slate-300"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'versions' ? (
        <div className="card overflow-x-auto scrollbar-thin">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-[#263354]">
                <th className="px-5 py-3 font-medium">Version</th>
                <th className="px-5 py-3 font-medium">File</th>
                <th className="px-5 py-3 font-medium">Hash</th>
                <th className="px-5 py-3 font-medium">By</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#263354]">
              {data.versions.map((v) => (
                <tr key={v.id}>
                  <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-100">
                    v{v.versionNumber}
                    {v.versionNumber === d.version ? (
                      <span className="ml-2 rounded-full bg-navy-600/10 px-2 py-0.5 text-[10px] text-navy-700 dark:text-navy-300">
                        current
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-300">
                    <p className="max-w-[220px] truncate">{v.originalName}</p>
                    <p className="text-[11px] text-slate-400">{formatBytes(v.sizeBytes)}</p>
                  </td>
                  <td className="px-5 py-3 font-mono text-[11px] text-slate-500">
                    {v.hashSha256 ? `${v.hashSha256.slice(0, 16)}…` : '—'}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">{v.createdByName || '—'}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {formatDate(v.createdAt, { withTime: true })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button size="sm" variant="secondary" onClick={download}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end border-t border-slate-100 px-5 py-4 dark:border-[#263354]">
            <Link to={`/documents/${id}/versions`}>
              <Button variant="secondary" size="sm">
                <GitBranch className="h-4 w-4" /> Manage versions
              </Button>
            </Link>
          </div>
        </div>
      ) : null}

      {tab === 'custody' ? (
        <div className="card p-5">
          <SectionTitle>Chain of custody</SectionTitle>
          {data.custody.length === 0 ? (
            <p className="text-sm text-slate-500">No custody events recorded.</p>
          ) : (
            <ol className="relative space-y-5 border-l border-slate-200 pl-6 dark:border-[#263354]">
              {data.custody.map((c, i) => (
                <li key={c.id} className="relative">
                  <span
                    className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white dark:border-[#121b31] ${
                      i === 0 ? 'bg-navy-600' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-navy-600/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-navy-700 dark:text-navy-300">
                      {c.action}
                    </span>
                    <span className="text-xs text-slate-500">
                      {c.fromUserName || 'system'} · {formatDate(c.createdAt, { withTime: true })}
                    </span>
                  </div>
                  {c.notes ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{c.notes}</p> : null}
                  {c.location ? (
                    <p className="mt-0.5 text-xs text-slate-400">Location: {c.location}</p>
                  ) : null}
                  {c.hashProof ? (
                    <p className="mt-1 break-all font-mono text-[10px] text-slate-400">
                      proof: {c.hashProof.slice(0, 48)}…
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}

      {tab === 'activity' ? (
        <div className="card p-5">
          <SectionTitle>Audit events for this document</SectionTitle>
          {data.activity.length === 0 ? (
            <p className="text-sm text-slate-500">No audit events yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-[#263354]">
              {data.activity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    {a.action}
                  </span>
                  <span className="text-xs text-slate-500">{a.userName || 'system'}</span>
                  <span className="ml-auto text-xs text-slate-400">
                    {formatDate(a.createdAt, { withTime: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/audit-trail"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-navy-600 hover:underline dark:text-navy-400"
          >
            <History className="h-3.5 w-3.5" /> Open full audit trail
          </Link>
        </div>
      ) : null}

      <EditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        document={d}
        onSaved={() => {
          setEditOpen(false);
          setNotice('Document metadata updated.');
          load();
        }}
      />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete document?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={removeDoc}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <strong>{d.title}</strong> and all {data.versions.length} version
          {data.versions.length === 1 ? '' : 's'} will be removed from disk. The deletion itself is
          written to the audit trail.
        </p>
      </Modal>
    </div>
  );
}

function File2Icon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0 text-slate-400"
      {...props}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function EditModal({ open, onClose, document: d, onSaved }) {
  const [form, setForm] = useState({
    title: d?.title || '',
    description: d?.description || '',
    docType: d?.docType || 'evidence',
    status: d?.status || 'stored',
    confidentiality: d?.confidentiality || 'internal',
    category: d?.category || '',
    tags: (d?.tags || []).join(', '),
    source: d?.source || '',
    location: d?.location || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && d) {
      setForm({
        title: d.title || '',
        description: d.description || '',
        docType: d.docType || 'evidence',
        status: d.status || 'stored',
        confidentiality: d.confidentiality || 'internal',
        category: d.category || '',
        tags: (d.tags || []).join(', '),
        source: d.source || '',
        location: d.location || '',
      });
      setError('');
    }
  }, [open, d]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.put(`/documents/${d.id}`, {
        ...form,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Update failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit document metadata" wide>
      <form onSubmit={save} className="space-y-4">
        <ErrorBox>{error}</ErrorBox>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Title</span>
          <input className="input-base" value={form.title} onChange={update('title')} required />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Description
          </span>
          <textarea
            className="input-base min-h-[80px] resize-y"
            value={form.description}
            onChange={update('description')}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Type</span>
            <select className="input-base" value={form.docType} onChange={update('docType')}>
              {['evidence', 'court_order', 'legal_filing', 'statement', 'report', 'photo', 'video', 'audio', 'correspondence', 'other'].map(
                (t) => (
                  <option key={t} value={t}>
                    {t.replace('_', ' ')}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Status</span>
            <select className="input-base" value={form.status} onChange={update('status')}>
              {['stored', 'pending_review', 'verified', 'rejected', 'archived'].map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Classification
            </span>
            <select
              className="input-base"
              value={form.confidentiality}
              onChange={update('confidentiality')}
            >
              {['public', 'internal', 'confidential', 'restricted'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Source</span>
            <input className="input-base" value={form.source} onChange={update('source')} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Location
            </span>
            <input className="input-base" value={form.location} onChange={update('location')} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Tags (comma separated)
          </span>
          <input className="input-base" value={form.tags} onChange={update('tags')} />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
