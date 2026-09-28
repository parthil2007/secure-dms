import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import { PageLoader } from './components/ui.jsx';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Cases from './pages/Cases.jsx';
import CaseForm from './pages/CaseForm.jsx';
import CaseDetail from './pages/CaseDetail.jsx';
import Documents from './pages/Documents.jsx';
import Upload from './pages/Upload.jsx';
import DocumentDetail from './pages/DocumentDetail.jsx';
import DocumentVersions from './pages/DocumentVersions.jsx';
import Search from './pages/Search.jsx';
import Reports from './pages/Reports.jsx';
import Sharing from './pages/Sharing.jsx';
import AuditTrail from './pages/AuditTrail.jsx';
import Integrity from './pages/Integrity.jsx';
import Versions from './pages/Versions.jsx';
import Settings from './pages/Settings.jsx';
import Admin from './pages/Admin.jsx';
import NotFound from './pages/NotFound.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Restoring your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/cases" element={<Protected><Cases /></Protected>} />
      <Route path="/cases/create" element={<Protected><CaseForm /></Protected>} />
      <Route path="/cases/:id" element={<Protected><CaseDetail /></Protected>} />
      <Route path="/cases/:id/edit" element={<Protected><CaseForm /></Protected>} />
      <Route path="/documents" element={<Protected><Documents /></Protected>} />
      <Route path="/documents/upload" element={<Protected><Upload /></Protected>} />
      <Route path="/documents/:id" element={<Protected><DocumentDetail /></Protected>} />
      <Route path="/documents/:id/versions" element={<Protected><DocumentVersions /></Protected>} />
      <Route path="/search" element={<Protected><Search /></Protected>} />
      <Route path="/reports" element={<Protected><Reports /></Protected>} />
      <Route path="/sharing" element={<Protected><Sharing /></Protected>} />
      <Route path="/audit-trail" element={<Protected><AuditTrail /></Protected>} />
      <Route path="/integrity" element={<Protected><Integrity /></Protected>} />
      <Route path="/versions" element={<Protected><Versions /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="/admin" element={<Protected><Admin /></Protected>} />
      <Route path="*" element={<Protected><NotFound /></Protected>} />
    </Routes>
  );
}
