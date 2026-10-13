import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { storeApi, type StoreStats } from '../../api/client';
import { IconPlus, IconProducts, IconStores } from '../../components/NavIcons';
import { PageHeader } from '../../components/PageHeader';
import { useAuth } from '../../context/AuthContext';
import '../Dashboard.css';

const STAT_CARDS: { key: keyof StoreStats; label: string }[] = [
  { key: 'products', label: 'Products' },
  { key: 'live', label: 'Live in the app' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'takenDown', label: 'Taken down by admin' },
  { key: 'lowStock', label: 'Low stock' },
  { key: 'outOfStock', label: 'Out of stock' },
];

const STATUS_LABEL = {
  pending: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Not accepted',
  suspended: 'Suspended',
} as const;

export function StoreDashboardPage() {
  const { store } = useAuth();
  const [stats, setStats] = useState<StoreStats | null>(null);
  const [error, setError] = useState('');
  const canEdit = store?.status === 'approved';

  useEffect(() => {
    storeApi
      .getStats()
      .then((res) => setStats(res.stats))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load stats'));
  }, []);

  return (
    <div className="dashboard">
      <PageHeader
        title="Dashboard"
        subtitle={store ? `${store.name} · ${STATUS_LABEL[store.status]}` : undefined}
      />

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="stats-grid">
        {STAT_CARDS.map(({ key, label }) => (
          <div key={key} className="card stat-card">
            <h3>{label}</h3>
            {stats ? <p>{stats[key]}</p> : <span className="skeleton stat-skeleton" aria-label={`Loading ${label}`} />}
          </div>
        ))}
      </div>

      <div className="card dashboard-quick-links">
        <h2 className="section-title">Quick links</h2>
        <div className="quick-links">
          {canEdit ? (
            <Link to="/products?new=1" className="quick-link quick-link-primary">
              <span className="quick-link-icon">
                <IconPlus className="nav-icon" />
              </span>
              <span>Add product</span>
            </Link>
          ) : null}
          <Link to="/products" className="quick-link">
            <span className="quick-link-icon">
              <IconProducts className="nav-icon" />
            </span>
            <span>Manage products</span>
          </Link>
          <Link to="/profile" className="quick-link">
            <span className="quick-link-icon">
              <IconStores className="nav-icon" />
            </span>
            <span>Store profile</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
