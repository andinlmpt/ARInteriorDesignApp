import { useEffect, useState } from 'react';
import { api, type AdminUser } from '../api/client';
import { ConfirmModal } from '../components/ConfirmModal';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';

export function UsersListPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
  const [updating, setUpdating] = useState(false);

  async function load(query = '') {
    setLoading(true);
    setError('');
    try {
      const res = await api.listUsers(query);
      setUsers(res.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load(search.trim());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search]);

  const nextRole = roleTarget?.role === 'admin' ? 'user' : 'admin';
  const isPromoting = nextRole === 'admin';

  async function confirmRoleChange() {
    if (!roleTarget) return;
    setUpdating(true);
    setError('');
    try {
      await api.updateUser(roleTarget.id, { role: nextRole });
      setMessage(`Updated ${roleTarget.email} to ${nextRole}`);
      setRoleTarget(null);
      await load(search.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Registered customer accounts in the mobile app."
        actions={
          <SearchBar
            placeholder="Search email or name…"
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
        ) : users.length === 0 ? (
          <div className="empty-state">
            <h3>No users found</h3>
            <p>{search ? `No matches for “${search}”.` : 'No registered users yet.'}</p>
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
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.name || '—'}</td>
                  <td>
                    <span className={`badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button type="button" className="btn btn-ghost" onClick={() => setRoleTarget(user)}>
                      {user.role === 'admin' ? 'Make user' : 'Make admin'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        open={Boolean(roleTarget)}
        title={isPromoting ? 'Make admin' : 'Make user'}
        message={
          roleTarget
            ? isPromoting
              ? `Promote “${roleTarget.email}” to admin? They will get access to the admin console.`
              : `Remove admin access from “${roleTarget.email}”? They will become a regular user.`
            : ''
        }
        confirmLabel={isPromoting ? 'Make admin' : 'Make user'}
        busy={updating}
        onClose={() => {
          if (!updating) setRoleTarget(null);
        }}
        onConfirm={confirmRoleChange}
      />
    </div>
  );
}
