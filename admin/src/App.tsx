import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/Login';
import { StoreRegisterPage } from './pages/StoreRegister';
import { DashboardPage } from './pages/Dashboard';
import { StoresListPage } from './pages/StoresList';
import { ProductsOverviewPage } from './pages/ProductsOverview';
import { UsersListPage } from './pages/UsersList';
import { AdminsListPage } from './pages/AdminsList';
import { ActivityLogsPage } from './pages/ActivityLogsPage';
import { FaqsPage } from './pages/FaqsPage';
import { LegalPage } from './pages/LegalPage';
import { StoreDashboardPage } from './pages/store/StoreDashboard';
import { StoreProductsPage } from './pages/store/StoreProducts';
import { StoreProfilePage } from './pages/store/StoreProfile';

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

/** Admins run the platform; stores manage their own products. Same site, different pages. */
export default function App() {
  const { user } = useAuth();
  const isStore = user?.role === 'store';

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<StoreRegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {isStore ? (
          <>
            <Route index element={<StoreDashboardPage />} />
            <Route path="products" element={<StoreProductsPage />} />
            <Route path="profile" element={<StoreProfilePage />} />
            <Route path="settings" element={<Navigate to="/profile" replace />} />
          </>
        ) : (
          <>
            <Route index element={<DashboardPage />} />
            <Route path="stores" element={<StoresListPage />} />
            <Route path="products" element={<ProductsOverviewPage />} />
            <Route path="users" element={<UsersListPage />} />
            <Route path="admins" element={<AdminsListPage />} />
            <Route path="activity-logs" element={<ActivityLogsPage />} />
            <Route path="faqs" element={<FaqsPage />} />
            <Route path="legal" element={<LegalPage />} />
          </>
        )}
        <Route path="furniture" element={<Navigate to="/products" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
