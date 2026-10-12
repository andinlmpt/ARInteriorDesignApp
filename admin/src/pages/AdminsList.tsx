import { useEffect, useMemo, useState } from 'react';
import { adminApi, type AdminUser } from '../api/client';
import { ConfirmModal } from '../components/ConfirmModal';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { useAuth } from '../context/AuthContext';

export function AdminsListPage() {
  const { user: me } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [demoteTarget, setDemoteTarget] = useState<AdminUser | null>(null);
  const [updating, setUpdating] = useState(false);

  async function load() {
    try {
      const res = await adminApi.listUsers('', 'admin');
      setAdmins(res.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function confirmDemote() {
    if (!demoteTarget) return;
    setUpdating(true);
    setError('');
    try {
      await adminApi.updateUser(demoteTarget.id, { role: 'user' });
      setMessage(`${demoteTarget.email} is now a customer. You'll find them on the Users page.`);
      setDemoteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdating(false);
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return admins;
    return admins.filter((admin) =>
      [admin.email, admin.name, admin.role].join(' ').toLowerCase().includes(term)
    );
  }, [admins, search]);

  return (
    <div>
      <PageHeader
        title="Admins"
        subtitle="Accounts with access to this admin console."
        actions={
          <SearchBar
            placeholder="Search admins…"
            value={search}
            onChange={setSearch}
          />
        }
      />

      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}

      <div className="card">
        {loading ? (
          <p>Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3>No admin accounts</h3>
            <p>
              {search
                ? `No matches for “${search}”.`
                : 'Promote a user to admin from the Users page.'}
            </p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((admin) => (
                <tr key={admin.id}>
                  <td>{admin.email}</td>
                  <td>{admin.name || '—'}</td>
                  <td>
                    <span className="badge badge-admin">admin</span>
                  </td>
                  <td>{new Date(admin.createdAt).toLocaleDateString()}</td>
                  <td>
                    {admin.id === me?.id ? (
                      <span className="muted small">You</span>
                    ) : (
                      <button type="button" className="btn btn-ghost" onClick={() => setDemoteTarget(admin)}>
                        Make customer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        open={Boolean(demoteTarget)}
        title="Make customer"
        message={
          demoteTarget
            ? `Remove admin access from “${demoteTarget.email}”? They will become a regular customer.`
            : ''
        }
        confirmLabel="Make customer"
        busy={updating}
        onClose={() => {
          if (!updating) setDemoteTarget(null);
        }}
        onConfirm={confirmDemote}
      />
    </div>
  );
}
