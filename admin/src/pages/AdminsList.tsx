import { useEffect, useMemo, useState } from 'react';
import { api, type AdminUser } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';

export function AdminsListPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api
      .listUsers()
      .then((res) => setAdmins(res.users.filter((user) => user.role === 'admin')))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load admins'))
      .finally(() => setLoading(false));
  }, []);

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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
