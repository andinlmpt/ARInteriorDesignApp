import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi, type Store, type StoreStatus } from '../api/client';
import { ConfirmModal } from '../components/ConfirmModal';
import { useConsoleContext } from '../components/Layout';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';

type Tab = StoreStatus | 'all';
type Decision = 'approved' | 'rejected' | 'suspended';

const TABS: { id: Tab; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

const STATUS_LABEL: Record<StoreStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

/** Wording for each decision; reject and suspend need a reason the store will see. */
const DECISIONS: Record<Decision, { title: string; button: string; needsNote: boolean }> = {
  approved: { title: 'Accept store', button: 'Accept', needsNote: false },
  rejected: { title: 'Reject store', button: 'Reject', needsNote: true },
  suspended: { title: 'Suspend store', button: 'Suspend', needsNote: true },
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

export function StoresListPage() {
  const { refreshPendingStores } = useConsoleContext();
  const [stores, setStores] = useState<Store[]>([]);
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [viewing, setViewing] = useState<Store | null>(null);
  const [decision, setDecision] = useState<{ store: Store; status: Decision } | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.listStores('all', search.trim());
      setStores(res.stores);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stores');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const counts = useMemo(() => {
    const map: Record<Tab, number> = { pending: 0, approved: 0, suspended: 0, rejected: 0, all: stores.length };
    stores.forEach((store) => {
      map[store.status] += 1;
    });
    return map;
  }, [stores]);

  const visible = useMemo(() => (tab === 'all' ? stores : stores.filter((s) => s.status === tab)), [stores, tab]);

  function openDecision(store: Store, status: Decision) {
    setViewing(null);
    setNote('');
    setDecision({ store, status });
  }

  async function confirmDecision() {
    if (!decision) return;
    const copy = DECISIONS[decision.status];
    if (copy.needsNote && !note.trim()) {
      setError('Add a reason so the store knows what to fix.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await adminApi.updateStoreStatus(decision.store.id, decision.status, note.trim());
      const verb = { approved: 'Accepted', rejected: 'Rejected', suspended: 'Suspended' }[decision.status];
      setMessage(`${verb} ${decision.store.name}`);
      setDecision(null);
      refreshPendingStores();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  /** Actions available for a store in its current status. */
  function actionsFor(store: Store) {
    switch (store.status) {
      case 'pending':
        return (
          <>
            <button type="button" className="btn btn-dark" onClick={() => openDecision(store, 'approved')}>
              Accept
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => openDecision(store, 'rejected')}>
              Reject
            </button>
          </>
        );
      case 'approved':
        return (
          <button type="button" className="btn btn-ghost" onClick={() => openDecision(store, 'suspended')}>
            Suspend
          </button>
        );
      case 'suspended':
        return (
          <button type="button" className="btn btn-ghost" onClick={() => openDecision(store, 'approved')}>
            Reinstate
          </button>
        );
      case 'rejected':
        return (
          <button type="button" className="btn btn-ghost" onClick={() => openDecision(store, 'approved')}>
            Accept
          </button>
        );
      default:
        return null;
    }
  }

  const decisionCopy = decision ? DECISIONS[decision.status] : null;
  const isReinstate = decision?.status === 'approved' && decision.store.status === 'suspended';

  return (
    <div>
      <PageHeader
        title="Stores"
        subtitle="Review store registrations. A store's products appear in the app only after you accept it."
        actions={<SearchBar placeholder="Search store, email, city…" value={search} onChange={setSearch} />}
      />

      {error && !decision ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}

      <div className="filter-tabs" role="tablist" aria-label="Filter stores by status">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`filter-tab${tab === id ? ' filter-tab-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
            <span className="filter-tab-count">{counts[id]}</span>
          </button>
        ))}
      </div>

      <div className="card table-card">
        {loading ? (
          <p style={{ padding: 20 }}>Loading…</p>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <h3>{tab === 'pending' ? 'No stores waiting for review' : 'No stores found'}</h3>
            <p>
              {search
                ? `No matches for “${search}”.`
                : tab === 'pending'
                  ? 'New registrations will appear here.'
                  : 'Nothing in this list yet.'}
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Owner</th>
                  <th>Business permit</th>
                  <th>Products</th>
                  <th>Registered</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((store) => (
                  <tr key={store.id}>
                    <td>
                      <strong>{store.name}</strong>
                      <div className="muted small">{[store.address, store.city].filter(Boolean).join(', ') || '—'}</div>
                    </td>
                    <td>
                      {store.ownerName || '—'}
                      <div className="muted small">{store.ownerEmail}</div>
                    </td>
                    <td>{store.businessPermit || <span className="muted">Not given</span>}</td>
                    <td>{store.productCount ?? 0}</td>
                    <td>{formatDate(store.createdAt)}</td>
                    <td>
                      <span className={`badge badge-${store.status}`}>{STATUS_LABEL[store.status]}</span>
                      {store.statusNote ? (
                        <div className="muted small" style={{ maxWidth: 200 }}>
                          {store.statusNote}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="btn btn-ghost" onClick={() => setViewing(store)}>
                          View
                        </button>
                        {actionsFor(store)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(viewing)}
        wide
        title={viewing?.name || 'Store'}
        subtitle={viewing ? `${STATUS_LABEL[viewing.status]} · registered ${formatDate(viewing.createdAt)}` : undefined}
        onClose={() => setViewing(null)}
        footer={
          viewing ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setViewing(null)}>
                Close
              </button>
              {actionsFor(viewing)}
            </>
          ) : null
        }
      >
        {viewing ? (
          <dl className="detail-list">
            <dt>Owner</dt>
            <dd>
              {viewing.ownerName || '—'} · {viewing.ownerEmail}
            </dd>
            <dt>Business permit</dt>
            <dd>{viewing.businessPermit || 'Not given'}</dd>
            <dt>Store email</dt>
            <dd>{viewing.email || '—'}</dd>
            <dt>Phone</dt>
            <dd>{viewing.phone || '—'}</dd>
            <dt>Address</dt>
            <dd>{[viewing.address, viewing.city].filter(Boolean).join(', ') || '—'}</dd>
            <dt>About</dt>
            <dd>{viewing.description || '—'}</dd>
            <dt>Tagline</dt>
            <dd>{viewing.tagline || '—'}</dd>
            <dt>Online</dt>
            <dd>{[viewing.website, viewing.facebook, viewing.instagram].filter(Boolean).join(' · ') || '—'}</dd>
            <dt>Business hours</dt>
            <dd>{viewing.businessHours || '—'}</dd>
            <dt>Products</dt>
            <dd>{viewing.productCount ?? 0}</dd>
            {viewing.statusNote ? (
              <>
                <dt>Admin note</dt>
                <dd>{viewing.statusNote}</dd>
              </>
            ) : null}
            <dt>Last reviewed</dt>
            <dd>{formatDate(viewing.reviewedAt)}</dd>
          </dl>
        ) : null}
      </Modal>

      {decision && decisionCopy && !decisionCopy.needsNote ? (
        <ConfirmModal
          open
          title={isReinstate ? 'Reinstate store' : decisionCopy.title}
          message={
            isReinstate
              ? `Reinstate “${decision.store.name}”? Its live products will show in the app again.`
              : `Accept “${decision.store.name}”? The store can then add products, and they will show in the mobile app.`
          }
          confirmLabel={isReinstate ? 'Reinstate' : decisionCopy.button}
          busy={saving}
          onClose={() => {
            if (!saving) setDecision(null);
          }}
          onConfirm={confirmDecision}
        />
      ) : null}

      <Modal
        open={Boolean(decision && decisionCopy?.needsNote)}
        title={decisionCopy?.title || ''}
        subtitle={decision?.store.name}
        onClose={() => {
          if (!saving) setDecision(null);
        }}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDecision(null)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={confirmDecision} disabled={saving}>
              {saving ? 'Please wait…' : decisionCopy?.button}
            </button>
          </>
        }
      >
        {error && decision ? <div className="alert alert-error">{error}</div> : null}
        <p className="confirm-message" style={{ marginBottom: 12 }}>
          {decision?.status === 'suspended'
            ? 'Its products will be hidden from the app, and it can’t make changes until you reinstate it.'
            : 'The store will see this reason and can update its details and resubmit.'}
        </p>
        <div className="field">
          <label htmlFor="decision-note">Reason (shown to the store)</label>
          <textarea
            id="decision-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={decision?.status === 'suspended' ? 'e.g. Repeated customer complaints' : 'e.g. Please add your DTI number'}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}
