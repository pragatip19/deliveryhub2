import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import LoginPage      from './pages/LoginPage';
import EmailConfirmed from './pages/EmailConfirmed';
import CheckEmail     from './pages/CheckEmail';
import Layout         from './components/Layout/Layout';
import HubPage        from './components/Hub/HubPage';
import ProjectPage    from './components/Project/ProjectPage';
import AdminPanel     from './components/Admin/AdminPanel';
import DealsPage      from './components/Deals/DealsPage';
import HubSpotPage    from './components/HubSpot/HubSpotPage';

function ProtectedRoute({ children, requireAdmin }) {
  const { user, profile, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (requireAdmin && profile?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"          element={<LoginPage />} />
      <Route path="/email-confirmed" element={<EmailConfirmed />} />
      <Route path="/check-email"    element={<CheckEmail />} />

      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index               element={<HubPage />} />
        <Route path="project/:id/*" element={<ProjectPage />} />
        <Route path="deals/*"       element={<DealsPage />} />
        <Route path="hubspot"       element={<HubSpotPage />} />
        <Route path="admin"         element={
          <ProtectedRoute requireAdmin>
            <AdminPanel />
          </ProtectedRoute>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
