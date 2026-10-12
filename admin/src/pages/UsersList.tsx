import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type AdminUser, type Role, type UserRoleFilter } from '../api/client';
import { ConfirmModal } from '../components/ConfirmModal';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';

/** Admins aren't listed here; they have their own page. */
const ROLE_FILTERS: { value: UserRoleFilter; label: string }[] = [
  { value: 'non-admin', label: 'All accounts' },
  { value: 'user', label: 'Customers' },
  { value: 'store', label: 'Store owners' },
];

const BADGE_CLASS: Record<Role, string> = {
  admin: 'badge-admin',
  store: 'badge-store',
  user: 'badge-user',
};

export function UsersListPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>('non-admin');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [promoteTarget, setPromoteTarget] = useState<AdminUser | null>(null);
  const [updating, setUpdating] = useState(false);

  async function load(query = '', role: UserRoleFilter = roleFilter) {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.listUsers(query, role);
      setUsers(res.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load(search.trim(), roleFilter);
    }, 250);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter]);

  async function confirmPromote() {
    if (!promoteTarget) return;
    setUpdating(true);
    setError('');
    try {
      await adminApi.updateUser(promoteTarget.id, { role: 'admin' });
      setMessage(`${promoteTarget.email} is now an admin. You'll find them on the Admins page.`);
      setPromoteTarget(null);
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
        subtitle="Mobile app customers and store owners. Admins are on the Admins page."
        actions={
          <>
            <SearchBar
              placeholder="Search email or name…"
              value={search}
              onChange={setSearch}
            />
            <select
              className="filter-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRoleFilter)}
              aria-label="Filter by role"
            >
              {ROLE_FILTERS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </>
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
                    <span className={`badge ${BADGE_CLASS[user.role] ?? 'badge-user'}`}>
                      {user.role === 'user' ? 'customer' : user.role}
                    </span>
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    {user.role === 'store' ? (
                      <Link to="/stores" className="muted small">
                        Managed on Stores
                      </Link>
                    ) : (
                      <button type="button" className="btn btn-ghost" onClick={() => setPromoteTarget(user)}>
                        Make admin
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
        open={Boolean(promoteTarget)}
        title="Make admin"
        message={
          promoteTarget
            ? `Promote “${promoteTarget.email}” to admin? They will get access to the admin console.`
            : ''
        }
        confirmLabel="Make admin"
        busy={updating}
        onClose={() => {
          if (!updating) setPromoteTarget(null);
        }}
        onConfirm={confirmPromote}
      />
    </div>
  );
}
