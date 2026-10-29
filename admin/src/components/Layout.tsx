import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { adminApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { resolveAssetUrl } from '../utils/assetUrl';
import { useTableCellLabels } from '../utils/tableLabels';
import {
  IconActivity,
  IconAdmins,
  IconDashboard,
  IconFaqs,
  IconLegal,
  IconMenu,
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
  // Phones: the sidebar is a drawer behind the menu button in the top bar (Layout.css).
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  useTableCellLabels(mainRef);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    // The page behind the open drawer doesn't scroll.
    document.documentElement.classList.add('console-menu-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('console-menu-open');
    };
  }, [menuOpen]);

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
  const storeLogo = isStore && store?.logoUrl ? resolveAssetUrl(store.logoUrl) : '';
  const logo = storeLogo || '/visionspace-mark.png';
  const brandName = isStore ? store?.name || 'Your store' : 'VisionSpace';
  const outletContext: ConsoleOutletContext = { refreshPendingStores };

  return (
    <div className={menuOpen ? 'admin-shell admin-shell--menu-open' : 'admin-shell'}>
      <aside className="sidebar" id="console-nav">
        <div className="brand">
          <img src={logo} alt={brandName} className={storeLogo ? 'brand-logo' : 'brand-logo brand-logo--mark'} />
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

      {menuOpen ? (
        <button type="button" className="drawer-backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
      ) : null}

      <div className="content-column">
        <header className="topbar">
          <button
            type="button"
            className="menu-toggle"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="console-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <IconMenu />
            {pendingStores > 0 ? <span className="menu-toggle-dot" aria-hidden="true" /> : null}
          </button>
          <div className="topbar-brand">
            <img src={logo} alt="" className={storeLogo ? 'brand-logo' : 'brand-logo brand-logo--mark'} />
            <strong>{brandName}</strong>
          </div>
          <div className="topbar-spacer" />
          <ProfileMenu />
        </header>

        <main className="main" ref={mainRef}>
          {isStore && store ? <StoreStatusBanner store={store} /> : null}
          <Outlet context={outletContext} />
        </main>
      </div>
    </div>
  );
}
