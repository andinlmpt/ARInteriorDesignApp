import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useOutletContext } from 'react-router-dom';
import { adminApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { resolveAssetUrl } from '../utils/assetUrl';
import {
  IconActivity,
  IconAdmins,
  IconDashboard,
  IconFaqs,
  IconLegal,
  IconProducts,
  IconStores,
  IconUsers,
} from './NavIcons';
import { ProfileMenu } from './ProfileMenu';
import { StoreStatusBanner } from './StoreStatusBanner';
import './Layout.css';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  /** Shows the number of store applications waiting for review. */
  pendingBadge?: boolean;
}

const ADMIN_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: IconDashboard, end: true },
  { to: '/stores', label: 'Stores', icon: IconStores, pendingBadge: true },
  { to: '/products', label: 'Products', icon: IconProducts },
  { to: '/users', label: 'Users', icon: IconUsers },
  { to: '/admins', label: 'Admins', icon: IconAdmins },
  { to: '/activity-logs', label: 'Activity Logs', icon: IconActivity },
  { to: '/faqs', label: 'FAQs', icon: IconFaqs },
  { to: '/legal', label: 'Legal', icon: IconLegal },
];

const STORE_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: IconDashboard, end: true },
  { to: '/products', label: 'Products', icon: IconProducts },
  { to: '/profile', label: 'Store profile', icon: IconStores },
];

export interface ConsoleOutletContext {
  /** Re-reads the pending store count shown in the admin sidebar. */
  refreshPendingStores: () => void;
}

export function useConsoleContext() {
  return useOutletContext<ConsoleOutletContext>();
}

export function Layout() {
  const { user, store } = useAuth();
  const isStore = user?.role === 'store';
  const [pendingStores, setPendingStores] = useState(0);

  const refreshPendingStores = useCallback(() => {
    if (isStore) return;
    adminApi
      .getStats()
      .then((res) => setPendingStores(res.stats.pendingStores))
      .catch(() => undefined);
  }, [isStore]);

  useEffect(() => {
    refreshPendingStores();
  }, [refreshPendingStores]);

  const navItems = isStore ? STORE_NAV : ADMIN_NAV;
  const logo = isStore && store?.logoUrl ? resolveAssetUrl(store.logoUrl) : '/maharlika-logo.png';
  const brandName = isStore ? store?.name || 'Your store' : 'Maharlika Furniture';
  const outletContext: ConsoleOutletContext = { refreshPendingStores };

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src={logo} alt={brandName} className="brand-logo" />
          <div className="brand-copy">
            <strong>{brandName}</strong>
            <span>{isStore ? 'Store console' : 'Admin console'}</span>
          </div>
        </div>

        <nav className="nav">
          {navItems.map(({ to, label, icon: Icon, end, pendingBadge }) => (
            <NavLink key={to} to={to} end={end} className="nav-item">
              <Icon className="nav-icon" />
              <span>{label}</span>
              {pendingBadge && pendingStores > 0 ? (
                <span className="nav-count" aria-label={`${pendingStores} waiting for review`}>
                  {pendingStores}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="content-column">
        <header className="topbar">
          <div className="topbar-spacer" />
          <ProfileMenu />
        </header>

        <main className="main">
          {isStore && store ? <StoreStatusBanner store={store} /> : null}
          <Outlet context={outletContext} />
        </main>
      </div>
    </div>
  );
}
