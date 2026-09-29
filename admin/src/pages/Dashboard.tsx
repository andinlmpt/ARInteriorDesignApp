import { useMemo, useState, type ComponentType } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { ProductOverview } from '../components/dashboard/ProductOverview';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { RecentlyAddedProducts } from '../components/dashboard/RecentlyAddedProducts';
import {
  IconActivity,
  IconAdmins,
  IconFaqs,
  IconLegal,
  IconPlus,
  IconProducts,
  IconSettings,
  IconUsers,
} from '../components/NavIcons';
import { useDashboardData } from '../hooks/useDashboardData';
import type { DashboardStats } from '../types/dashboard';
import './Dashboard.css';

interface QuickLink {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  keywords?: string;
  primary?: boolean;
  /** Only listed when it matches a search term. */
  searchOnly?: boolean;
}

const QUICK_LINKS: QuickLink[] = [
  { to: '/products?new=1', label: 'Add product', icon: IconPlus, keywords: 'new create furniture', primary: true },
  { to: '/products', label: 'Manage products', icon: IconProducts, keywords: 'furniture catalog inventory' },
  { to: '/users', label: 'View users', icon: IconUsers, keywords: 'customers accounts' },
  { to: '/admins', label: 'Admin accounts', icon: IconAdmins, keywords: 'administrators roles' },
  { to: '/faqs', label: 'Edit FAQs', icon: IconFaqs, keywords: 'questions help' },
  { to: '/legal', label: 'Legal pages', icon: IconLegal, keywords: 'terms privacy policy' },
  { to: '/settings', label: 'Settings', icon: IconSettings, keywords: 'store information' },
  { to: '/activity-logs', label: 'Activity logs', icon: IconActivity, keywords: 'history events', searchOnly: true },
];

const STAT_CARDS: { key: keyof DashboardStats; label: string }[] = [
  { key: 'users', label: 'Total users' },
  { key: 'furniture', label: 'Total products' },
  { key: 'newUsersThisWeek', label: 'New users this week' },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const { stats, categories, activity, recentlyAdded, reloadStats, reloadProducts, reloadActivity } =
    useDashboardData();
  const [search, setSearch] = useState('');

  const filteredLinks = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return QUICK_LINKS.filter((link) => !link.searchOnly);
    return QUICK_LINKS.filter((link) => `${link.label} ${link.keywords ?? ''}`.toLowerCase().includes(term));
  }, [search]);

  function handleSearchSubmit() {
    if (search.trim() && filteredLinks.length > 0) {
      navigate(filteredLinks[0].to);
    }
  }

  return (
    <div className="dashboard">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your Maharlika Furniture admin console."
        actions={
          <SearchBar
            placeholder="Search dashboard…"
            value={search}
            onChange={setSearch}
            onSubmit={handleSearchSubmit}
          />
        }
      />

      {stats.error ? (
        <div className="alert alert-error dashboard-alert" role="alert">
          <span>{stats.error}</span>
          <button type="button" className="btn btn-ghost" onClick={reloadStats}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="stats-grid">
        {STAT_CARDS.map(({ key, label }) => (
          <div key={key} className="card stat-card">
            <h3>{label}</h3>
            {stats.loading ? (
              <span className="skeleton stat-skeleton" aria-label={`Loading ${label.toLowerCase()}`} />
            ) : (
              <p>{stats.data?.[key] ?? '—'}</p>
            )}
          </div>
        ))}
      </div>

      <div className="card dashboard-quick-links">
        <h2 className="section-title">Quick links</h2>
        {filteredLinks.length === 0 ? (
          <p className="page-subtitle">No matches for “{search}”.</p>
        ) : (
          <div className="quick-links">
            {filteredLinks.map(({ to, label, icon: Icon, primary }) => (
              <Link key={to} to={to} className={`quick-link${primary ? ' quick-link-primary' : ''}`}>
                <span className="quick-link-icon">
                  <Icon className="nav-icon" />
                </span>
                <span>{label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-grid">
        <ProductOverview section={categories} onRetry={reloadProducts} />
        <RecentActivity section={activity} onRetry={reloadActivity} />
      </div>

      <RecentlyAddedProducts section={recentlyAdded} onRetry={reloadProducts} />
    </div>
  );
}
