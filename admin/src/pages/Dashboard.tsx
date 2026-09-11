import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import {
  IconAdmins,
  IconFaqs,
  IconLegal,
  IconProducts,
  IconSettings,
  IconUsers,
} from '../components/NavIcons';

export function DashboardPage() {
  const [stats, setStats] = useState<{ users: number; furniture: number; activeFurniture: number } | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api
      .getStats()
      .then((res) => setStats(res.stats))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load stats'));
  }, []);

  const quickLinks = [
    { to: '/products', label: 'Manage products', icon: IconProducts },
    { to: '/users', label: 'View users', icon: IconUsers },
    { to: '/admins', label: 'Admin accounts', icon: IconAdmins },
    { to: '/faqs', label: 'Edit FAQs', icon: IconFaqs },
    { to: '/legal', label: 'Legal pages', icon: IconLegal },
    { to: '/settings', label: 'Settings', icon: IconSettings },
  ];

  const filteredLinks = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return quickLinks;
    return quickLinks.filter((link) => link.label.toLowerCase().includes(term));
  }, [search]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your Maharlika Furniture admin console."
        actions={
          <SearchBar
            placeholder="Search dashboard…"
            value={search}
            onChange={setSearch}
          />
        }
      />

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="stats-grid">
        <div className="card stat-card">
          <h3>Total users</h3>
          <p>{stats?.users ?? '—'}</p>
        </div>
        <div className="card stat-card">
          <h3>Total products</h3>
          <p>{stats?.furniture ?? '—'}</p>
        </div>
        <div className="card stat-card">
          <h3>Active in app</h3>
          <p>{stats?.activeFurniture ?? '—'}</p>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Quick links</h2>
        {filteredLinks.length === 0 ? (
          <p className="page-subtitle">No matches for “{search}”.</p>
        ) : (
          <div className="quick-links">
            {filteredLinks.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className="quick-link">
                <span className="quick-link-icon">
                  <Icon className="nav-icon" />
                </span>
                <span>{label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
