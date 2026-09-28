import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Files,
  HardDrive,
  Calendar,
  User2,
  Building2,
  Gavel,
  Plus,
  Activity,
} from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { formatDate, formatBytes, timeAgo } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Button,
  CardSkeleton,
  EmptyState,
  ErrorBox,
  Modal,
  PageLoader,
  PriorityBadge,
  SectionTitle,
  StatusBadge,
  SuccessBox,
  TypeBadge,
} from '../components/ui.jsx';

function MetaRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-sm text-slate-700 dark:text-slate-200">{value || '—'}</p>
      </div>
    </div>
  );
}

export default function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/cases/${id}`);
      setData(res.data);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Failed to load case'));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/cases/${id}`);
      navigate('/cases');
    } catch (err) {
      setError(errorMessage(err, 'Could not delete case'));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (!data && !error) return <PageLoader label="Loading case file…" />;
  if (!data) {
    return (
      <div className="space-y-4">
        <ErrorBox>{error}</ErrorBox>
        <Link to="/cases">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" /> Back to cases
          </Button>
        </Link>
      </div>
    );
  }

  const c = data.case;
  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/cases"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-600 hover:underline dark:text-navy-400"
          >
            <ArrowLeft className="h-4 w-4" /> All cases
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-400">{c.caseNumber}</span>
            <StatusBadge status={c.status} />
            <PriorityBadge priority={c.priority} />
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {c.title}
          </h1>
          {c.description ? (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {c.description}
            </p>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Link to={`/documents/upload?caseId=${c.id}`}>
            <Button variant="secondary">
              <Plus className="h-4 w-4" /> Add evidence
            </Button>
          </Link>
          <Link to={`/cases/${c.id}/edit`}>
            <Button variant="secondary">
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          </Link>
          {isAdmin ? (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <SuccessBox onDismiss={() => setNotice('')}>{notice}</SuccessBox>
      ) : null}
      {error && data ? (
        <ErrorBox onDismiss={() => setError('')}>{error}</ErrorBox>
      ) : null}

      {/* Summary tiles */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-600/10 text-navy-600 dark:text-navy-400">
              <Files className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {c.documentCount}
              </p>
              <p className="text-xs text-slate-500">Documents</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <HardDrive className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatBytes(c.sizeBytes)}
              </p>
              <p className="text-xs text-slate-500">Case storage</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Calendar className="h-5 w-5" />
            </span>
            <div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {formatDate(c.filingDate || c.createdAt)}
              </p>
              <p className="text-xs text-slate-500">Filed / opened</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Documents */}
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-5">
            <SectionTitle
              action={
                <Link
                  to={`/documents?caseId=${c.id}`}
                  className="text-xs font-medium text-navy-600 hover:underline dark:text-navy-400"
                >
                  Open in library
                </Link>
              }
            >
              Evidence &amp; documents
            </SectionTitle>

            {data.documents.length === 0 ? (
              <EmptyState
                icon={Files}
                title="No documents attached yet"
                hint="Upload statements, forensic reports, photographs or any digital exhibit."
                action={
                  <Link to={`/documents/upload?caseId=${c.id}`}>
                    <Button className="mt-3">
                      <Plus className="h-4 w-4" /> Upload evidence
                    </Button>
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#263354]">
                {data.documents.map((d) => (
                  <li key={d.id}>
                    <Link
                      to={`/documents/${d.id}`}
                      className="group flex items-center gap-3 py-3 transition hover:bg-slate-50 dark:hover:bg-white/[.03]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-navy-700 dark:text-slate-100 dark:group-hover:text-navy-300">
                          {d.title}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className="font-mono">{d.docNumber}</span>
                          <span>·</span>
                          <span>{formatBytes(d.sizeBytes)}</span>
                          <span>·</span>
                          <span>{d.uploadedByName || 'Unknown'}</span>
                        </p>
                      </div>
                      <TypeBadge type={d.docType} />
                      <StatusBadge status={d.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-5">
            <SectionTitle>Case metadata</SectionTitle>
            <div className="divide-y divide-slate-100 dark:divide-[#263354]">
              <MetaRow icon={User2} label="Lead officer" value={c.leadOfficerName} />
              <MetaRow icon={Building2} label="Agency" value={c.agency} />
              <MetaRow icon={Gavel} label="Court" value={c.court} />
              <MetaRow icon={Calendar} label="Filing date" value={formatDate(c.filingDate)} />
              <MetaRow icon={Calendar} label="Due date" value={formatDate(c.dueDate)} />
              <MetaRow icon={User2} label="Created by" value={c.createdByName} />
            </div>
          </div>

          <div className="card p-5">
            <SectionTitle>Case activity</SectionTitle>
            {data.activity.length === 0 ? (
              <CardSkeleton className="h-24" />
            ) : (
              <ol className="space-y-3">
                {data.activity.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-navy-600" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                        {a.action.replace(/_/g, ' ').toLowerCase()}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {a.userName || 'system'} · {timeAgo(a.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <Link
              to="/audit-trail"
              className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-navy-600 hover:underline dark:text-navy-400"
            >
              <Activity className="h-3.5 w-3.5" /> Full audit trail
            </Link>
          </div>
        </div>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this case?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <strong>{c.title}</strong> and its link to {c.documentCount} document
          {c.documentCount === 1 ? '' : 's'} will be removed from the case register. The documents
          themselves remain in the repository. This action is recorded in the audit trail.
        </p>
      </Modal>
    </div>
  );
}
