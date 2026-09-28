import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  FileText,
  GitBranch,
  History,
  Plus,
  UploadCloud,
} from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { formatBytes, formatDate, timeAgo } from '../lib/format.js';
import {
  Button,
  ErrorBox,
  Modal,
  PageLoader,
  StatusBadge,
  SuccessBox,
} from '../components/ui.jsx';

export default function DocumentVersions() {
  const { id } = useParams();
  const [docData, setDocData] = useState(null);
  const [versions, setVersions] = useState([]);
  const [custody, setCustody] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const fileRef = useRef(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/documents/${id}`);
      setDocData(res.data?.document || null);
      setVersions(res.data?.versions || []);
      setCustody(res.data?.custody || []);
    } catch (err) {
      setError(errorMessage(err, 'Could not load this document'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const download = async (version) => {
    setDownloading(version.id);
    setError('');
    try {
      const res = await api.get(`/documents/${id}/file`, {
        params: { version: version.versionNumber },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = version.originalName || `version-${version.versionNumber}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      setError(errorMessage(err, 'Download failed'));
    } finally {
      setDownloading(null);
    }
  };

  const uploadVersion = async (e) => {
    e.preventDefault();
    const input = fileRef.current;
    const file = input?.files?.[0];
    if (!file) {
      setError('Choose a file to upload');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (note.trim()) formData.append('note', note.trim());

      await api.post(`/documents/${id}/versions`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess('New version uploaded');
      setNote('');
      if (input) input.value = '';
      setOpen(false);
      fetchAll();
    } catch (err) {
      setError(errorMessage(err, 'Could not upload the new version'));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !docData) return <PageLoader label="Loading version history…" />;

  const doc = docData || {};
  const shortHash = (hash) => (hash ? `${hash.slice(0, 16)}…` : '—');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/documents/${id}`}
            className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-navy-600 hover:underline dark:text-navy-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to document
          </Link>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {doc.title ?? 'Version history'}
          </h1>
          <p className="text-sm text-slate-500">
            <span className="font-mono">{doc.docNumber ?? '—'}</span>
            {doc.caseNumber ? ` · ${doc.caseNumber}` : ''} · current version v
            {doc.version ?? versions[0]?.versionNumber ?? 1}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {doc.status ? <StatusBadge status={doc.status} /> : null}
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Upload new version
          </Button>
        </div>
      </div>

      {error ? <ErrorBox onDismiss={() => setError('')}>{error}</ErrorBox> : null}
      {success ? <SuccessBox onDismiss={() => setSuccess('')}>{success}</SuccessBox> : null}

      {/* Versions table */}
      <div className="card overflow-x-auto scrollbar-thin">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-[#263354]">
              <th className="px-5 py-3 font-medium">Version</th>
              <th className="px-3 py-3 font-medium">File</th>
              <th className="px-3 py-3 font-medium">Size</th>
              <th className="px-3 py-3 font-medium">Uploaded by</th>
              <th className="px-3 py-3 font-medium">Date</th>
              <th className="px-3 py-3 font-medium">SHA-256</th>
              <th className="px-5 py-3 text-right font-medium">Download</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#263354]">
            {versions.map((version) => (
              <tr key={version.id} className="transition hover:bg-slate-50 dark:hover:bg-white/5">
                <td className="px-5 py-3">
                  <span className="rounded-lg bg-navy-600/10 px-2 py-1 font-mono text-xs font-semibold text-navy-700 dark:text-navy-300">
                    v{version.versionNumber ?? '—'}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className="block max-w-[16rem] truncate font-medium text-slate-800 dark:text-slate-100">
                    {version.originalName ?? version.fileName ?? '—'}
                  </span>
                  {version.note ? (
                    <span className="block max-w-[16rem] truncate text-xs text-slate-500">
                      {version.note}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-slate-500">{formatBytes(version.sizeBytes)}</td>
                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                  {version.createdByName ?? '—'}
                </td>
                <td className="px-3 py-3">
                  <span className="block text-slate-700 dark:text-slate-200">
                    {formatDate(version.createdAt, { withTime: true })}
                  </span>
                  <span className="text-xs text-slate-500">{timeAgo(version.createdAt)}</span>
                </td>
                <td className="px-3 py-3">
                  <span
                    className="block max-w-[10rem] truncate font-mono text-xs break-all text-slate-500"
                    title={version.hashSha256 || ''}
                  >
                    {shortHash(version.hashSha256)}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={downloading === version.id}
                    onClick={() => download(version)}
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </td>
              </tr>
            ))}
            {versions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-500">
                  No versions recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Chain of custody */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-navy-600 dark:text-navy-300" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Chain of custody
          </h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {custody.length}
          </span>
        </div>

        {custody.length === 0 ? (
          <div className="card p-5 text-sm text-slate-500">
            No custody events recorded for this document yet.
          </div>
        ) : (
          <div className="card p-5">
            <ol className="relative ml-2 space-y-5 border-l-2 border-slate-200 pl-5 dark:border-[#263354]">
              {custody.map((event, index) => (
                <li key={event.id ?? index} className="relative">
                  <span className="absolute -left-[28px] top-1.5 h-3 w-3 rounded-full bg-navy-600 ring-4 ring-white dark:ring-[#121b31]" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold capitalize text-slate-800 dark:text-slate-100">
                      {(event.action ?? 'event').replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatDate(event.createdAt, { withTime: true })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {event.fromUserName ?? '—'}
                    {event.toUserName ? ` → ${event.toUserName}` : ''}
                    {event.location ? ` · ${event.location}` : ''}
                  </p>
                  {event.notes ? (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{event.notes}</p>
                  ) : null}
                  {event.hashProof ? (
                    <p
                      className="mt-1 max-w-full truncate font-mono text-[11px] text-slate-400"
                      title={event.hashProof}
                    >
                      proof: {event.hashProof}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      {/* Upload new version */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Upload new version"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button form="version-form" type="submit" loading={saving}>
              <UploadCloud className="h-4 w-4" /> Upload
            </Button>
          </>
        }
      >
        <form id="version-form" onSubmit={uploadVersion} className="space-y-4">
          <p className="text-xs text-slate-500">
            The new file replaces the current version, receives the next version number and is
            linked into the SHA-256 hash chain.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              File <span className="text-red-500">*</span>
            </label>
            <input ref={fileRef} type="file" name="file" required className="input-base !py-2" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Change note <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input-base"
              placeholder="e.g. Corrected exhibit list"
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-white/5">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            Current version: v{doc.version ?? versions[0]?.versionNumber ?? 1} ·{' '}
            <GitBranch className="h-3.5 w-3.5 shrink-0" /> {versions.length} revision
            {versions.length === 1 ? '' : 's'} stored
          </div>
        </form>
      </Modal>
    </div>
  );
}
