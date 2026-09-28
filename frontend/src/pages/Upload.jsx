import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileUp, File, X, ShieldCheck } from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { formatBytes } from '../lib/format.js';
import { Button, ErrorBox, SectionTitle } from '../components/ui.jsx';

const TYPES = [
  ['evidence', 'Evidence'],
  ['court_order', 'Court order'],
  ['legal_filing', 'Legal filing'],
  ['statement', 'Statement'],
  ['report', 'Report'],
  ['photo', 'Photograph'],
  ['video', 'Video'],
  ['audio', 'Audio'],
  ['correspondence', 'Correspondence'],
  ['other', 'Other'],
];

const CONF = [
  ['internal', 'Internal'],
  ['public', 'Public'],
  ['confidential', 'Confidential'],
  ['restricted', 'Restricted'],
];

export default function Upload() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preselectedCase = params.get('caseId') || '';

  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [cases, setCases] = useState([]);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    docType: 'evidence',
    caseId: preselectedCase,
    confidentiality: 'internal',
    status: 'stored',
    tags: '',
    source: '',
    location: '',
    collectedAt: '',
  });

  useEffect(() => {
    api
      .get('/cases', { params: { limit: 100 } })
      .then((res) => setCases(res.data.cases))
      .catch(() => setCases([]));
  }, []);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function acceptFile(next) {
    if (!next) return;
    if (next.size > 100 * 1024 * 1024) {
      setError('File exceeds the 100 MB limit.');
      return;
    }
    setError('');
    setFile(next);
    setForm((f) => ({
      ...f,
      title: f.title || next.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
    }));
  }

  const prettyName = useMemo(() => file?.name || '', [file]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError('Select the evidence file to upload.');
      return;
    }
    setUploading(true);
    setError('');
    setProgress(0);

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', form.title.trim());
      if (form.description) fd.append('description', form.description);
      fd.append('docType', form.docType);
      fd.append('confidentiality', form.confidentiality);
      fd.append('status', form.status);
      if (form.caseId) fd.append('caseId', form.caseId);
      if (form.source) fd.append('source', form.source);
      if (form.location) fd.append('location', form.location);
      if (form.collectedAt) fd.append('collectedAt', form.collectedAt);
      const tags = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (tags.length) fd.append('tags', JSON.stringify(tags));

      const { data } = await api.post('/documents/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
        onUploadProgress: (ev) => {
          if (ev.total) setProgress(Math.round((ev.loaded / ev.total) * 100));
        },
      });

      setDone(data.document);
      setUploading(false);
      setProgress(100);
    } catch (err) {
      setError(errorMessage(err, 'Upload failed'));
      setUploading(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl space-y-6 pt-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Evidence sealed successfully
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            The file was hashed with SHA-256 and appended to the tamper-evident custody chain.
          </p>
        </div>

        <div className="card space-y-3 p-5 text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-400">Document</span>
            <span className="font-mono text-xs text-navy-600 dark:text-navy-400">
              {done.docNumber}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{done.title}</p>
          <div className="break-all rounded-lg bg-slate-50 p-3 font-mono text-[11px] text-slate-600 dark:bg-white/5 dark:text-slate-300">
            sha256: {done.hashSha256}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
            <span>Size: {formatBytes(done.sizeBytes)}</span>
            <span>Status: {done.status?.replace('_', ' ')}</span>
          </div>
        </div>

        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={() => navigate('/documents/upload')}>
            Upload another
          </Button>
          <Button onClick={() => navigate(`/documents/${done.id}`)}>Open document</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to="/documents"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-600 hover:underline dark:text-navy-400"
        >
          <ArrowLeft className="h-4 w-4" /> Document library
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Upload evidence
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Files are hashed on arrival and chained to the previous record — any later modification is
          detectable.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <ErrorBox onDismiss={() => setError('')}>{error}</ErrorBox>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            acceptFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => inputRef.current?.click()}
          className={`card flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-12 text-center transition ${
            dragging
              ? 'border-navy-500 bg-navy-50 dark:bg-navy-950/50'
              : 'border-slate-300 hover:border-navy-400 dark:border-[#263354]'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />

          {file ? (
            <>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-600/10 text-navy-600 dark:text-navy-400">
                <File className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {prettyName}
                </p>
                <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-navy-600 dark:text-navy-400">
                Click to replace
              </span>
            </>
          ) : (
            <>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-600/10 text-navy-600 dark:text-navy-400">
                <FileUp className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Drop a file here, or click to browse
                </p>
                <p className="text-xs text-slate-500">
                  Documents, images, audio, video, archives · max 100 MB
                </p>
              </div>
            </>
          )}
        </div>

        {file ? (
          <button
            type="button"
            onClick={() => setFile(null)}
            className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
          >
            <X className="h-3.5 w-3.5" /> Remove selected file
          </button>
        ) : null}

        <section className="card space-y-4 p-5">
          <SectionTitle>Document metadata</SectionTitle>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Title *
            </span>
            <input
              className="input-base"
              value={form.title}
              onChange={update('title')}
              placeholder="e.g. Panchnama — NH44 checkpost seizure"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Description
            </span>
            <textarea
              className="input-base min-h-[90px] resize-y"
              value={form.description}
              onChange={update('description')}
              placeholder="Context, provenance, exhibit number…"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Document type
              </span>
              <select className="input-base" value={form.docType} onChange={update('docType')}>
                {TYPES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Link to case
              </span>
              <select className="input-base" value={form.caseId} onChange={update('caseId')}>
                <option value="">Unfiled</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.caseNumber} — {c.title}
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
                {CONF.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Initial status
              </span>
              <select className="input-base" value={form.status} onChange={update('status')}>
                <option value="stored">Stored</option>
                <option value="pending_review">Pending review</option>
                <option value="verified">Verified</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Source / collecting agency
              </span>
              <input
                className="input-base"
                value={form.source}
                onChange={update('source')}
                placeholder="e.g. FSL Team 2"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Collection location
              </span>
              <input
                className="input-base"
                value={form.location}
                onChange={update('location')}
                placeholder="e.g. NH44 checkpost, km 212"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Collected at
              </span>
              <input
                type="datetime-local"
                className="input-base"
                value={form.collectedAt}
                onChange={update('collectedAt')}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Tags <span className="text-slate-400">(comma separated)</span>
              </span>
              <input
                className="input-base"
                value={form.tags}
                onChange={update('tags')}
                placeholder="seizure, witness, original"
              />
            </label>
          </div>
        </section>

        {uploading ? (
          <div className="card p-5">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span>Transferring &amp; hashing…</span>
              <span className="font-semibold text-navy-600">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-navy-600 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <p className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
            <ShieldCheck className="h-4 w-4 text-navy-600" />
            SHA-256 digest computed server-side on arrival
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate('/documents')}>
              Cancel
            </Button>
            <Button type="submit" loading={uploading} disabled={!file}>
              <FileUp className="h-4 w-4" /> Seal &amp; upload
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
