import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { FurnitureListPage } from './pages/FurnitureList';
import { UsersListPage } from './pages/UsersList';
import { AdminsListPage } from './pages/AdminsList';
import { ActivityLogsPage } from './pages/ActivityLogsPage';
import { FaqsPage } from './pages/FaqsPage';
import { LegalPage } from './pages/LegalPage';
import { StoreInfoPage } from './pages/StoreInfoPage';
import { ProfilePage } from './pages/ProfilePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="container">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="products" element={<FurnitureListPage />} />
        <Route path="products/new" element={<Navigate to="/products" replace />} />
        <Route path="products/:id/edit" element={<Navigate to="/products" replace />} />
        <Route path="furniture" element={<Navigate to="/products" replace />} />
        <Route path="furniture/new" element={<Navigate to="/products" replace />} />
        <Route path="furniture/:id/edit" element={<Navigate to="/products" replace />} />
        <Route path="users" element={<UsersListPage />} />
        <Route path="admins" element={<AdminsListPage />} />
        <Route path="activity-logs" element={<ActivityLogsPage />} />
        <Route path="faqs" element={<FaqsPage />} />
        <Route path="legal" element={<LegalPage />} />
        <Route path="settings" element={<StoreInfoPage />} />
        <Route path="store" element={<Navigate to="/settings" replace />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
