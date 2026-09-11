import { NavLink, Outlet } from 'react-router-dom';
import {
  IconActivity,
  IconAdmins,
  IconDashboard,
  IconFaqs,
  IconLegal,
  IconProducts,
  IconSettings,
  IconUsers,
} from './NavIcons';
import { ProfileMenu } from './ProfileMenu';
import './Layout.css';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: IconDashboard, end: true },
  { to: '/products', label: 'Products', icon: IconProducts },
  { to: '/users', label: 'Users', icon: IconUsers },
  { to: '/admins', label: 'Admins', icon: IconAdmins },
  { to: '/activity-logs', label: 'Activity Logs', icon: IconActivity },
  { to: '/faqs', label: 'FAQs', icon: IconFaqs },
  { to: '/legal', label: 'Legal', icon: IconLegal },
  { to: '/settings', label: 'Settings', icon: IconSettings },
] as const;

export function Layout() {
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/maharlika-logo.png" alt="Maharlika Furniture" className="brand-logo" />
          <div className="brand-copy">
            <strong>Maharlika Furniture</strong>
            <span>Admin console</span>
          </div>
        </div>

        <nav className="nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon, ...rest }) => (
            <NavLink key={to} to={to} end={'end' in rest ? rest.end : undefined} className="nav-item">
              <Icon className="nav-icon" />
              <span>{label}</span>
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
